const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** "Trabajo: gastos de mi actividad profesional" — una línea por marca para el prompt. */
const formatTags = (tags) =>
  tags.length === 0
    ? "(el usuario no tiene marcas configuradas)"
    : tags
        .map((t) => `- "${t.name}"${t.description ? `: ${t.description}` : ""}`)
        .join("\n");

const parseExpense = async (req, res) => {
  const { text, categories = [], paymethods = [], tags = [], today } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ ok: false, msg: "text is required" });
  }

  const currentDate = today || new Date().toISOString().slice(0, 10);

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
- paymethod: debe ser exactamente uno de los disponibles (string), el más apropiado según lo descrito
- dues: número de cuotas si type es "Crédito", null si es "Contado"
- tags: array con los nombres de las marcas que apliquen al gasto, o [] si ninguna aplica

Fecha de hoy: ${currentDate}
Categorías disponibles: ${categories.length > 0 ? categories.join(", ") : "Comida, Transporte, Salud, Educación, Hogar, Diversión"}
Métodos de pago disponibles: ${paymethods.length > 0 ? paymethods.join(", ") : "Efectivo, Débito, Nequi"}

Marcas disponibles (aplica solo las que el texto justifique claramente):
${formatTags(tags)}

Reglas:
- Si no puedes determinar un campo, usa null
- El amount debe ser siempre un número positivo, nunca string
- Usa las categorías y métodos exactamente como aparecen en la lista
- tags es siempre un array, nunca null. Usa los nombres de marca exactamente como aparecen y no inventes marcas que no estén en la lista
- Ante la duda, no apliques una marca: es mejor dejarla sin marcar que marcarla mal`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: text.trim() }],
    });

    const raw = message.content[0].text.trim();

    // Extract JSON — handle cases where Claude wraps it despite instructions
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ ok: false, msg: "No se pudo interpretar el texto" });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    res.json({ ok: true, parsed });
  } catch (error) {
    console.error("AI parse error:", error.message);
    res.status(500).json({ ok: false, msg: "Error al procesar con IA" });
  }
};

module.exports = { parseExpense };
