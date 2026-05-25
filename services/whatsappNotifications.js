const cron   = require("node-cron");
const twilio = require("twilio");
const User    = require("../models/User");
const Bill    = require("../models/Bill");
const Income  = require("../models/Income");
const Budget  = require("../models/Budget");

let _twilioClient = null;
const getClient = () => {
  if (!_twilioClient) {
    _twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return _twilioClient;
};
const FROM = () => `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const prevMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
};

const weekRange = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7) - 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from: fmt(monday), to: fmt(sunday) };
};

const sendWA = async (phone, message) => {
  await getClient().messages.create({
    from: FROM(),
    to:   `whatsapp:${phone}`,
    body: message,
  });
};

// ─── Get all users with WhatsApp linked ───────────────────────────────────────

const getLinkedUsers = () =>
  User.find({ whatsappPhone: { $ne: null, $exists: true } });

// ─── Budget alert (called from webhook after expense confirmation) ─────────────

const checkBudgetAlert = async (uid, phone, category) => {
  const budget = await Budget.findOne({ uid, category });
  if (!budget || budget.amount <= 0) return;

  const month = currentMonth();
  const bills = await Bill.find({ uid, category, date: { $regex: `^${month}` }, deletedAt: null });
  const spent = bills.reduce((s, b) => s + (b.amount ?? 0), 0);

  const pct = spent / budget.amount;

  if (pct >= 1) {
    await sendWA(phone,
      `⚠️ *Presupuesto agotado: ${category}*\n\n` +
      `Has gastado ${formatCOP(spent)} de ${formatCOP(budget.amount)} (${Math.round(pct * 100)}%).\n` +
      `Llevas ${formatCOP(spent - budget.amount)} por encima del límite este mes.`
    );
  } else if (pct >= 0.8) {
    await sendWA(phone,
      `🟡 *Alerta de presupuesto: ${category}*\n\n` +
      `Has gastado ${formatCOP(spent)} de ${formatCOP(budget.amount)} (${Math.round(pct * 100)}%).\n` +
      `Te quedan ${formatCOP(budget.amount - spent)} disponibles este mes.`
    );
  }
};

// ─── Weekly summary ───────────────────────────────────────────────────────────

const sendWeeklySummary = async () => {
  const users = await getLinkedUsers();
  const { from, to } = weekRange();

  for (const user of users) {
    try {
      const uid   = user._id.toString();
      const bills = await Bill.find({
        uid, deletedAt: null,
        date: { $gte: from, $lte: to },
      });

      if (!bills.length) continue;

      const total = bills.reduce((s, b) => s + (b.amount ?? 0), 0);
      const byCat = {};
      for (const b of bills) byCat[b.category] = (byCat[b.category] ?? 0) + (b.amount ?? 0);
      const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const topLines = top.map(([cat, amt]) => `  • ${cat}: ${formatCOP(amt)}`).join("\n");

      const fromLabel = new Date(from + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" });
      const toLabel   = new Date(to   + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" });

      await sendWA(user.whatsappPhone,
        `📊 *Resumen semanal* (${fromLabel} – ${toLabel})\n\n` +
        `💰 Total gastado: ${formatCOP(total)}\n` +
        `📋 ${bills.length} registro${bills.length !== 1 ? "s" : ""}\n\n` +
        `*Top categorías:*\n${topLines}\n\n` +
        `_Escribe *ayuda* para ver qué puedes consultar._`
      );
    } catch (err) {
      console.error(`Weekly summary error for user ${user._id}:`, err.message);
    }
  }
};

// ─── Monthly close ────────────────────────────────────────────────────────────

const sendMonthlyClose = async () => {
  const users = await getLinkedUsers();
  const month = prevMonth();

  for (const user of users) {
    try {
      const uid = user._id.toString();
      const [bills, incomes] = await Promise.all([
        Bill.find({ uid, date: { $regex: `^${month}` }, deletedAt: null }),
        Income.find({ uid, date: { $regex: `^${month}` }, deletedAt: null }),
      ]);

      if (!bills.length && !incomes.length) continue;

      const totalExpenses = bills.reduce((s, b) => s + (b.amount ?? 0), 0);
      const totalIncomes  = incomes.reduce((s, i) => s + (i.amount ?? 0), 0);
      const balance       = totalIncomes - totalExpenses;

      const byCat  = {};
      for (const b of bills) byCat[b.category] = (byCat[b.category] ?? 0) + (b.amount ?? 0);
      const top    = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const topLines = top.map(([cat, amt]) => `  • ${cat}: ${formatCOP(amt)}`).join("\n");

      const sign = balance >= 0 ? "+" : "";

      await sendWA(user.whatsappPhone,
        `📅 *Cierre de ${monthLabel(month)}*\n\n` +
        `💵 Ingresos: ${formatCOP(totalIncomes)}\n` +
        `💸 Gastos:   ${formatCOP(totalExpenses)}\n` +
        `${balance >= 0 ? "✅" : "⚠️"} Balance:  ${sign}${formatCOP(balance)}\n\n` +
        (top.length ? `*Top gastos:*\n${topLines}\n\n` : "") +
        `_¡Buen mes! Sigue registrando tus movimientos._`
      );
    } catch (err) {
      console.error(`Monthly close error for user ${user._id}:`, err.message);
    }
  }
};

// ─── Register cron jobs ───────────────────────────────────────────────────────

const registerCrons = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn("[cron] Twilio credentials missing — WhatsApp notifications disabled");
    return;
  }

  // Every Monday at 8:00 AM (Colombia = UTC-5, so 13:00 UTC)
  cron.schedule("0 13 * * 1", () => {
    console.log("[cron] Running weekly summary");
    sendWeeklySummary().catch((e) => console.error("[cron] weekly summary failed:", e.message));
  });

  // First day of every month at 8:00 AM Colombia time (13:00 UTC)
  cron.schedule("0 13 1 * *", () => {
    console.log("[cron] Running monthly close");
    sendMonthlyClose().catch((e) => console.error("[cron] monthly close failed:", e.message));
  });

  console.log("[cron] WhatsApp notification jobs registered");
};

module.exports = { registerCrons, checkBudgetAlert };
