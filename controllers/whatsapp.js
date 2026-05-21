const twilio = require("twilio");
const Anthropic = require("@anthropic-ai/sdk");
const User = require("../models/User");
const PendingExpense = require("../models/PendingExpense");
const Bill = require("../models/Bill");
const Category = require("../models/Category");
const PayChannel = require("../models/PayChannel");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CONFIRM_WORDS = ["sí", "si", "yes", "confirmar", "confirm", "ok", "dale", "listo"];
const CANCEL_WORDS  = ["no", "cancelar", "cancel", "nope"];

const twimlReply = (res, message) => {
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(message);
  res.type("text/xml");
  res.send(twiml.toString());
};

const formatCOP = (amount) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount ?? 0);

const webhookHandler = async (req, res) => {
  const from = req.body.From || "";
  const body = (req.body.Body || "").trim();
  const phone = from.replace("whatsapp:", "");

  if (!phone) {
    return twimlReply(res, "No se pudo identificar tu número.");
  }

  // Identify user by registered WhatsApp number
  const user = await User.findOne({ whatsappPhone: phone });

  if (!user) {
    return twimlReply(
      res,
      "❌ Tu número no está registrado.\n\nAbre la app, ve a Configuración y vincula tu número de WhatsApp."
    );
  }

  const normalized = body.toLowerCase().trim();

  // ── Confirmation flow ────────────────────────────────────────────────────────

  if (CONFIRM_WORDS.includes(normalized)) {
    const pending = await PendingExpense.findOne({ userId: user._id });

    if (!pending) {
      return twimlReply(
        res,
        "⚠️ No hay ningún gasto pendiente de confirmación.\n\nDescribe un gasto para registrarlo."
      );
    }

    const bill = new Bill({ uid: user._id.toString(), ...pending.parsed });
    await bill.save();
    await PendingExpense.deleteOne({ userId: user._id });

    const p = pending.parsed;
    const typeLabel =
      p.type === "Crédito" ? `Crédito · ${p.dues} cuotas` : "Contado";

    return twimlReply(
      res,
      `✅ Registrado correctamente\n\n` +
      `📋 ${p.name}\n` +
      `💰 ${formatCOP(p.amount)}\n` +
      `🏷️ ${p.category}\n` +
      `📅 ${p.date}\n` +
      `💳 ${p.paymethod} · ${typeLabel}`
    );
  }

  // ── Cancellation flow ────────────────────────────────────────────────────────

  if (CANCEL_WORDS.includes(normalized)) {
    const result = await PendingExpense.deleteOne({ userId: user._id });

    if (result.deletedCount === 0) {
      return twimlReply(res, "⚠️ No hay ningún gasto pendiente para cancelar.");
    }

    return twimlReply(
      res,
      "❌ Registro cancelado.\n\nPuedes describir un nuevo gasto cuando quieras."
    );
  }

  // ── Parse new expense with Claude ────────────────────────────────────────────

  const [categories, payChannels] = await Promise.all([
    Category.find({ uid: user._id.toString(), type: "gasto" }),
    PayChannel.find({ uid: user._id.toString() }),
  ]);

  const categoryNames  = categories.map((c) => c.name);
  const payChannelNames = payChannels.map((p) => p.name);
  const currentDate    = new Date().toISOString().slice(0, 10);

  const systemPrompt = `Eres un asistente para registro de gastos personales en Colombia.
El usuario va a describir un gasto en lenguaje natural.
Extrae la información y devuelve ÚNICAMENTE un objeto JSON válido, sin texto adicional, sin markdown, sin bloques de código.

Campos a extraer:
- name: nombre corto del gasto (string)
- category: debe ser exactamente una de las disponibles, la más apropiada (string)
- detail: descripción adicional o contexto (string, puede ser igual a name si no hay más info)
- amount: monto en pesos colombianos como número entero (ej: "50 mil" = 50000, "2 millones" = 2000000, "$150.000" = 150000)
- date: fecha en formato YYYY-MM-DD ("ayer" = día anterior a hoy, "hoy" = fecha actual, etc.)
- type: "Contado" si es pago de contado, "Crédito" si es a cuotas
- paymethod: debe ser exactamente uno de los disponibles, el más apropiado según lo descrito
- dues: número de cuotas si type es "Crédito", null si es "Contado"

Fecha de hoy: ${currentDate}
Categorías disponibles: ${categoryNames.length > 0 ? categoryNames.join(", ") : "Comida, Transporte, Salud, Educación, Hogar, Diversión"}
Métodos de pago disponibles: ${payChannelNames.length > 0 ? payChannelNames.join(", ") : "Efectivo, Débito, Nequi"}

Reglas:
- Si no puedes determinar un campo, usa null
- El amount debe ser siempre un número positivo, nunca string
- Usa las categorías y métodos exactamente como aparecen en la lista`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: body }],
    });

    const raw       = message.content[0].text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return twimlReply(
        res,
        "⚠️ No pude interpretar el gasto. Intenta describirlo con más detalle.\n\nEjemplo: \"almuerzo 25 mil con débito hoy\""
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Upsert: replace any existing pending expense for this user
    await PendingExpense.findOneAndUpdate(
      { userId: user._id },
      { userId: user._id, parsed, createdAt: new Date() },
      { upsert: true, new: true }
    );

    const typeLabel =
      parsed.type === "Crédito"
        ? `Crédito · ${parsed.dues ?? "?"} cuotas`
        : "Contado";

    return twimlReply(
      res,
      `¿Confirmas este registro?\n\n` +
      `📋 ${parsed.name ?? "Sin nombre"}\n` +
      `💰 ${formatCOP(parsed.amount)}\n` +
      `🏷️ ${parsed.category ?? "Sin categoría"}\n` +
      `📅 ${parsed.date ?? currentDate}\n` +
      `💳 ${parsed.paymethod ?? "Sin método"} · ${typeLabel}\n\n` +
      `Responde *sí* para guardar o *no* para cancelar`
    );
  } catch (error) {
    console.error("WhatsApp webhook error:", error.message);
    return twimlReply(
      res,
      "⚠️ Hubo un error procesando tu mensaje. Intenta de nuevo en un momento."
    );
  }
};

module.exports = { webhookHandler };