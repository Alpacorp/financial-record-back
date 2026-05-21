const twilio    = require("twilio");
const Anthropic = require("@anthropic-ai/sdk");
const User           = require("../models/User");
const PendingExpense = require("../models/PendingExpense");
const Bill           = require("../models/Bill");
const Income         = require("../models/Income");
const Category       = require("../models/Category");
const PayChannel     = require("../models/PayChannel");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CONFIRM_WORDS = ["sí", "si", "yes", "confirmar", "confirm", "ok", "dale", "listo"];
const CANCEL_WORDS  = ["no", "cancelar", "cancel", "nope"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const twimlReply = (res, message) => {
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(message);
  res.type("text/xml");
  res.send(twiml.toString());
};

const formatCOP = (amount) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount ?? 0);

const monthLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1)
    .toLocaleDateString("es-CO", { month: "long", year: "numeric" });
};

const currentDate  = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => currentDate().slice(0, 7);

// ─── Query executor ───────────────────────────────────────────────────────────

const executeQuery = async (uid, queryType, params) => {
  switch (queryType) {

    case "monthly_summary": {
      const month = params.month || currentMonth();
      const bills = await Bill.find({ uid, date: { $regex: `^${month}` }, deletedAt: null });
      if (!bills.length) {
        return `📭 No hay gastos registrados en ${monthLabel(month)}.`;
      }
      const total = bills.reduce((s, b) => s + (b.amount ?? 0), 0);

      const byCat = {};
      for (const b of bills) byCat[b.category] = (byCat[b.category] ?? 0) + (b.amount ?? 0);
      const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const topLines = top.map(([cat, amt]) => `  • ${cat}: ${formatCOP(amt)}`).join("\n");

      return (
        `📊 *Resumen de gastos — ${monthLabel(month)}*\n\n` +
        `💰 Total: ${formatCOP(total)}\n` +
        `📋 ${bills.length} registro${bills.length !== 1 ? "s" : ""}\n\n` +
        `*Top categorías:*\n${topLines}`
      );
    }

    case "income_monthly_summary": {
      const month = params.month || currentMonth();
      const incomes = await Income.find({ uid, date: { $regex: `^${month}` }, deletedAt: null });
      if (!incomes.length) {
        return `📭 No hay ingresos registrados en ${monthLabel(month)}.`;
      }
      const total = incomes.reduce((s, i) => s + (i.amount ?? 0), 0);

      const byCat = {};
      for (const i of incomes) byCat[i.category || "Sin categoría"] = (byCat[i.category || "Sin categoría"] ?? 0) + (i.amount ?? 0);
      const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const topLines = top.map(([cat, amt]) => `  • ${cat}: ${formatCOP(amt)}`).join("\n");

      return (
        `💵 *Resumen de ingresos — ${monthLabel(month)}*\n\n` +
        `💰 Total: ${formatCOP(total)}\n` +
        `📋 ${incomes.length} registro${incomes.length !== 1 ? "s" : ""}\n\n` +
        `*Por categoría:*\n${topLines}`
      );
    }

    case "balance_summary": {
      const month = params.month || currentMonth();
      const [bills, incomes] = await Promise.all([
        Bill.find({ uid, date: { $regex: `^${month}` }, deletedAt: null }),
        Income.find({ uid, date: { $regex: `^${month}` }, deletedAt: null }),
      ]);
      const totalExpenses = bills.reduce((s, b) => s + (b.amount ?? 0), 0);
      const totalIncomes  = incomes.reduce((s, i) => s + (i.amount ?? 0), 0);
      const balance       = totalIncomes - totalExpenses;
      const sign          = balance >= 0 ? "+" : "";

      return (
        `⚖️ *Balance — ${monthLabel(month)}*\n\n` +
        `💵 Ingresos: ${formatCOP(totalIncomes)}\n` +
        `💸 Gastos:   ${formatCOP(totalExpenses)}\n` +
        `─────────────────\n` +
        `${balance >= 0 ? "✅" : "⚠️"} Saldo: ${sign}${formatCOP(balance)}`
      );
    }

    case "recent": {
      const limit = Math.min(params.limit ?? 5, 10);
      const bills = await Bill.find({ uid, deletedAt: null })
        .sort({ date: -1, createdAt: -1 })
        .limit(limit);
      if (!bills.length) return "📭 No tienes gastos registrados aún.";
      const lines = bills.map((b, i) =>
        `${i + 1}. ${b.name} · ${formatCOP(b.amount)}\n   📅 ${b.date} · 🏷️ ${b.category}`
      );
      return `📋 *Últimos ${bills.length} gastos*\n\n${lines.join("\n\n")}`;
    }

    case "recent_incomes": {
      const limit = Math.min(params.limit ?? 5, 10);
      const incomes = await Income.find({ uid, deletedAt: null })
        .sort({ date: -1, createdAt: -1 })
        .limit(limit);
      if (!incomes.length) return "📭 No tienes ingresos registrados aún.";
      const lines = incomes.map((inc, i) =>
        `${i + 1}. ${inc.concept} · ${formatCOP(inc.amount)}\n   📅 ${inc.date} · 🏷️ ${inc.category || "Sin categoría"}`
      );
      return `💵 *Últimos ${incomes.length} ingresos*\n\n${lines.join("\n\n")}`;
    }

    case "last_payment": {
      const term    = params.search_term ?? "";
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex   = `\\b${escaped}`;
      const bill = await Bill.findOne({
        uid, deletedAt: null,
        $or: [
          { name:     { $regex: regex, $options: "i" } },
          { detail:   { $regex: regex, $options: "i" } },
          { category: { $regex: regex, $options: "i" } },
        ],
      }).sort({ date: -1, createdAt: -1 });

      if (!bill) {
        return `🔍 No encontré ningún pago relacionado con *"${term}"*.`;
      }
      const typeLabel = bill.type === "Crédito"
        ? `Crédito · ${bill.dues} cuotas` : "Contado";
      return (
        `🔍 *Último pago: ${bill.name}*\n\n` +
        `💰 ${formatCOP(bill.amount)}\n` +
        `📅 ${bill.date}\n` +
        `🏷️ ${bill.category}\n` +
        `💳 ${bill.paymethod} · ${typeLabel}`
      );
    }

    case "category_summary": {
      const month = params.month || currentMonth();
      const query = { uid, deletedAt: null, date: { $regex: `^${month}` } };
      if (params.category) {
        query.category = { $regex: params.category, $options: "i" };
      }
      const bills = await Bill.find(query);
      if (!bills.length) {
        const catLabel = params.category ?? "esa categoría";
        return `📭 No hay gastos de *${catLabel}* en ${monthLabel(month)}.`;
      }
      const total    = bills.reduce((s, b) => s + (b.amount ?? 0), 0);
      const catLabel = bills[0]?.category ?? params.category ?? "categoría";
      return (
        `📊 *${catLabel} — ${monthLabel(month)}*\n\n` +
        `💰 Total: ${formatCOP(total)}\n` +
        `📋 ${bills.length} registro${bills.length !== 1 ? "s" : ""}`
      );
    }

    case "search": {
      const term = params.search_term ?? "";
      const bills = await Bill.find({
        uid, deletedAt: null,
        $or: [
          { name:   { $regex: term, $options: "i" } },
          { detail: { $regex: term, $options: "i" } },
        ],
      }).sort({ date: -1 }).limit(5);

      if (!bills.length) {
        return `🔍 No encontré gastos relacionados con *"${term}"*.`;
      }
      const lines = bills.map((b) =>
        `• ${b.name} · ${formatCOP(b.amount)} · ${b.date}`
      );
      return `🔍 *Resultados: "${term}"*\n\n${lines.join("\n")}`;
    }

    default:
      return "⚠️ No entendí esa consulta. Escribe *ayuda* para ver qué puedo hacer.";
  }
};

// ─── Claude: classify intent + extract data ───────────────────────────────────

const HELP_MSG =
  `🤖 *¿Qué puedo hacer?*\n\n` +
  `*Registrar un gasto:*\n` +
  `_"gasté 45 mil en almuerzo hoy con débito"_\n\n` +
  `*Registrar un ingreso:*\n` +
  `_"recibí 2 millones de salario hoy por transferencia"_\n` +
  `_"ingresaron 500 mil de freelance ayer"_\n\n` +
  `*Consultas de gastos:*\n` +
  `_"¿cuánto llevo este mes en gastos?"_\n` +
  `_"últimos 5 gastos"_\n` +
  `_"¿cuándo fue la última vez que pagué la luz?"_\n` +
  `_"¿cuánto gasté en transporte en abril?"_\n\n` +
  `*Consultas de ingresos:*\n` +
  `_"¿cuánto ingresé este mes?"_\n` +
  `_"últimos ingresos"_\n\n` +
  `*Balance:*\n` +
  `_"¿cómo va mi balance este mes?"_`;

const classifyMessage = async (body, expenseCategoryNames, incomeCategoryNames, payChannelNames) => {
  const today = currentDate();
  const month = currentMonth();

  const systemPrompt =
`Eres un asistente financiero personal para Colombia.
Clasifica el mensaje y devuelve ÚNICAMENTE un objeto JSON válido, sin texto adicional.

Posibles formatos de respuesta:

GASTO NUEVO (el usuario describe algo que gastó, pagó, compró):
{"intent":"new_expense","parsed":{"name":"...","category":"...","detail":"...","amount":0,"date":"YYYY-MM-DD","type":"Contado","paymethod":"...","dues":null}}

INGRESO NUEVO (el usuario describe dinero que recibió, le pagaron, le transfirieron):
{"intent":"new_income","parsed":{"concept":"...","detail":"...","amount":0,"date":"YYYY-MM-DD","category":"...","channel":"...","paymethod":"..."}}

RESUMEN DE GASTOS DEL MES:
{"intent":"query","query_type":"monthly_summary","params":{"month":"YYYY-MM"}}

RESUMEN DE INGRESOS DEL MES:
{"intent":"query","query_type":"income_monthly_summary","params":{"month":"YYYY-MM"}}

BALANCE DEL MES (gastos vs ingresos):
{"intent":"query","query_type":"balance_summary","params":{"month":"YYYY-MM"}}

ÚLTIMOS GASTOS:
{"intent":"query","query_type":"recent","params":{"limit":5}}

ÚLTIMOS INGRESOS:
{"intent":"query","query_type":"recent_incomes","params":{"limit":5}}

ÚLTIMO PAGO DE ALGO (ej: "última vez que pagué la luz", "cuándo pagué el internet"):
{"intent":"query","query_type":"last_payment","params":{"search_term":"luz"}}

TOTAL GASTOS POR CATEGORÍA:
{"intent":"query","query_type":"category_summary","params":{"category":"Alimentación","month":"YYYY-MM"}}

BUSCAR GASTOS POR NOMBRE:
{"intent":"query","query_type":"search","params":{"search_term":"netflix"}}

AYUDA:
{"intent":"help"}

Fecha de hoy: ${today}
Mes actual: ${month}
Categorías de gastos disponibles: ${expenseCategoryNames.length > 0 ? expenseCategoryNames.join(", ") : "Comida, Transporte, Salud, Educación, Hogar, Diversión"}
Categorías de ingresos disponibles: ${incomeCategoryNames.length > 0 ? incomeCategoryNames.join(", ") : "Salario, Freelance, Inversión, Negocio, Otros"}
Métodos de pago disponibles: ${payChannelNames.length > 0 ? payChannelNames.join(", ") : "Efectivo, Débito, Nequi, Transferencia"}

Reglas para gastos nuevos:
- amount: número entero en COP ("50 mil"=50000, "2 millones"=2000000, "$150.000"=150000)
- date: formato YYYY-MM-DD ("ayer"=día anterior, "hoy"=fecha actual)
- type: "Contado" o "Crédito"
- Usa categorías de gastos exactamente como aparecen en la lista
- dues: número de cuotas si es Crédito, null si es Contado

Reglas para ingresos nuevos:
- concept: nombre o concepto del ingreso (ej: "Salario", "Pago freelance", "Arriendo")
- detail: descripción breve del ingreso
- channel: usa el método de pago/canal de la lista disponible
- paymethod: igual que channel (usa el mismo valor)
- Usa categorías de ingresos exactamente como aparecen en la lista

Reglas para consultas:
- last_payment: extrae el término MÁS ESPECÍFICO posible para evitar falsos positivos. Preferir frases sobre palabras sueltas cortas (ej: "recibo de gas propio" → "gas propio"; "servicio de luz" → "luz"; "internet claro" → "claro"; "arriendo" → "arriendo")
- Si no especifica mes en resumen/categoría/balance, usa el mes actual: ${month}
- limit en recent/recent_incomes: usa el número que pida el usuario, si no especifica usa 5
- Si el usuario pregunta por "balance" o "cómo voy" usa balance_summary`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: "user", content: body }],
  });

  const raw   = msg.content[0].text.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Claude response");
  return JSON.parse(match[0]);
};

// ─── Webhook handler ──────────────────────────────────────────────────────────

const webhookHandler = async (req, res) => {
  const from  = req.body.From || "";
  const body  = (req.body.Body || "").trim();
  const phone = from.replace("whatsapp:", "");

  if (!phone) return twimlReply(res, "No se pudo identificar tu número.");

  const user = await User.findOne({ whatsappPhone: phone });
  if (!user) {
    return twimlReply(
      res,
      "❌ Tu número no está registrado.\n\nAbre la app, ve a Configuración y vincula tu número de WhatsApp."
    );
  }

  const normalized = body.toLowerCase().trim();
  const uid        = user._id.toString();

  // ── Confirmation ─────────────────────────────────────────────────────────────
  if (CONFIRM_WORDS.includes(normalized)) {
    const pending = await PendingExpense.findOne({ userId: user._id });
    if (!pending) {
      return twimlReply(res,
        "⚠️ No hay ningún registro pendiente de confirmación.\n\nDescribe un gasto o ingreso para registrarlo."
      );
    }

    const p = pending.parsed;

    if (pending.recordType === "income") {
      const income = new Income({ uid, ...p });
      await income.save();
      await PendingExpense.deleteOne({ userId: user._id });
      return twimlReply(res,
        `✅ Ingreso registrado correctamente\n\n` +
        `📋 ${p.concept}\n💰 ${formatCOP(p.amount)}\n🏷️ ${p.category || "Sin categoría"}\n📅 ${p.date}\n💳 ${p.paymethod}`
      );
    }

    const bill = new Bill({ uid, ...p });
    await bill.save();
    await PendingExpense.deleteOne({ userId: user._id });
    const typeLabel = p.type === "Crédito" ? `Crédito · ${p.dues} cuotas` : "Contado";
    return twimlReply(res,
      `✅ Gasto registrado correctamente\n\n` +
      `📋 ${p.name}\n💰 ${formatCOP(p.amount)}\n🏷️ ${p.category}\n📅 ${p.date}\n💳 ${p.paymethod} · ${typeLabel}`
    );
  }

  // ── Cancellation ──────────────────────────────────────────────────────────────
  if (CANCEL_WORDS.includes(normalized)) {
    const result = await PendingExpense.deleteOne({ userId: user._id });
    if (result.deletedCount === 0) {
      return twimlReply(res, "⚠️ No hay ningún registro pendiente para cancelar.");
    }
    return twimlReply(res, "❌ Registro cancelado.\n\nPuedes describir un nuevo gasto o ingreso cuando quieras.");
  }

  // ── Classify with Claude ──────────────────────────────────────────────────────
  try {
    const [expenseCategories, incomeCategories, payChannels] = await Promise.all([
      Category.find({ uid, type: "gasto" }),
      Category.find({ uid, type: "ingreso" }),
      PayChannel.find({ uid }),
    ]);
    const expenseCategoryNames = expenseCategories.map((c) => c.name);
    const incomeCategoryNames  = incomeCategories.map((c) => c.name);
    const payChannelNames      = payChannels.map((p) => p.name);

    const classified = await classifyMessage(body, expenseCategoryNames, incomeCategoryNames, payChannelNames);

    // ── Help ────────────────────────────────────────────────────────────────────
    if (classified.intent === "help") {
      return twimlReply(res, HELP_MSG);
    }

    // ── Query ───────────────────────────────────────────────────────────────────
    if (classified.intent === "query") {
      const reply = await executeQuery(uid, classified.query_type, classified.params ?? {});
      return twimlReply(res, reply);
    }

    // ── New expense ─────────────────────────────────────────────────────────────
    if (classified.intent === "new_expense") {
      const parsed = classified.parsed;

      if (!parsed) {
        return twimlReply(res,
          "⚠️ No pude interpretar el gasto. Intenta describirlo con más detalle.\n\nEjemplo: _\"almuerzo 25 mil con débito hoy\"_"
        );
      }

      await PendingExpense.findOneAndUpdate(
        { userId: user._id },
        { userId: user._id, recordType: "expense", parsed, createdAt: new Date() },
        { upsert: true, new: true }
      );

      const typeLabel = parsed.type === "Crédito"
        ? `Crédito · ${parsed.dues ?? "?"} cuotas` : "Contado";

      return twimlReply(res,
        `¿Confirmas este *gasto*?\n\n` +
        `📋 ${parsed.name ?? "Sin nombre"}\n` +
        `💰 ${formatCOP(parsed.amount)}\n` +
        `🏷️ ${parsed.category ?? "Sin categoría"}\n` +
        `📅 ${parsed.date ?? currentDate()}\n` +
        `💳 ${parsed.paymethod ?? "Sin método"} · ${typeLabel}\n\n` +
        `Responde *sí* para guardar o *no* para cancelar`
      );
    }

    // ── New income ──────────────────────────────────────────────────────────────
    if (classified.intent === "new_income") {
      const parsed = classified.parsed;

      if (!parsed) {
        return twimlReply(res,
          "⚠️ No pude interpretar el ingreso. Intenta describirlo con más detalle.\n\nEjemplo: _\"recibí 2 millones de salario hoy por transferencia\"_"
        );
      }

      await PendingExpense.findOneAndUpdate(
        { userId: user._id },
        { userId: user._id, recordType: "income", parsed, createdAt: new Date() },
        { upsert: true, new: true }
      );

      return twimlReply(res,
        `¿Confirmas este *ingreso*?\n\n` +
        `📋 ${parsed.concept ?? "Sin concepto"}\n` +
        `💰 ${formatCOP(parsed.amount)}\n` +
        `🏷️ ${parsed.category ?? "Sin categoría"}\n` +
        `📅 ${parsed.date ?? currentDate()}\n` +
        `💳 ${parsed.paymethod ?? "Sin método"}\n\n` +
        `Responde *sí* para guardar o *no* para cancelar`
      );
    }

    // Fallback
    return twimlReply(res, HELP_MSG);

  } catch (error) {
    console.error("WhatsApp webhook error:", error.message);
    return twimlReply(res, "⚠️ Hubo un error procesando tu mensaje. Intenta de nuevo en un momento.");
  }
};

module.exports = { webhookHandler };
