// src/messages.js
// ALL customer-facing text lives here (Uzbek, Latin). Edit copy here only —
// never inline user-facing strings in handler logic.

import { config } from "./config.js";

// Format a price like 115000 -> "115 000" (space thousands separator, Uzbek style).
export function formatPrice(amount, currency = "so'm") {
  const grouped = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} ${currency}`;
}

export const messages = {
  // --- Welcome / start ---
  welcome: () =>
    `Assalomu alaykum! 👋\n\n*${config.shopName}* do'koniga xush kelibsiz.\n` +
    `Mahsulotlarni ko'rish va buyurtma berish uchun quyidagi tugmani bosing.`,

  // --- Buttons (labels) ---
  btn: {
    catalog: "🛍 Katalogni ko'rish",
    details: "Batafsil ▶",
    order: "🛒 Buyurtma berish",
    next: "Davom etish ▶",
    confirm: "✅ Tasdiqlash",
    cancel: "❌ Bekor qilish",
    back: "⬅️ Orqaga",
    shareContact: "📞 Raqamni ulashish",
    qtyMinus: "➖",
    qtyPlus: "➕",
  },

  // --- Catalog ---
  chooseCategory: "Kategoriyani tanlang:",
  chooseItem: (category) => `*${category}* — mahsulotni tanlang:`,
  emptyCatalog: "Hozircha katalog bo'sh. Tez orada to'ldiriladi.",

  // Item card (one per item in the category list): name + price.
  itemCard: ({ name, price, currency }) =>
    `*${name}*\n💰 ${formatPrice(price, currency)}`,

  // Item detail screen: name, description, price.
  itemDetail: ({ name, description, price, currency }) =>
    `*${name}*\n\n${description}\n\n💰 ${formatPrice(price, currency)}`,

  // --- Item detail / order steps ---
  chooseSize: "Hajmni tanlang:",
  chooseQty: (qty) => `Sonini tanlang: *${qty}*\n(➖ / ➕ tugmalari yoki raqam yozing)`,
  askName: "Ismingiz va familiyangizni yozing:",
  askPhone:
    "Telefon raqamingizni yuboring.\n" +
    "Pastdagi tugma orqali ulashing yoki qo'lda yozing (masalan: +998 90 123 45 67).",
  invalidPhone:
    "Bu telefon raqamga o'xshamadi. Iltimos, to'g'ri raqam yuboring (masalan: +998 90 123 45 67).",
  phoneSaved: "Raqamingiz qabul qilindi. ✅",
  chooseCity: "Yetkazib berish shahrini tanlang:",
  askAddress: "Yetkazib berish manzilini yozing (ko'cha, uy, mo'ljal):",

  // Nudge when a button-only step (size / city) gets stray typed text.
  useButtons: "Iltimos, yuqoridagi tugmalardan birini tanlang.",

  // --- Confirmation ---
  confirmTitle: "Buyurtmangizni tasdiqlang:",
  orderSummary: ({ item, size, qty, unitPrice, lineTotal, currency, name, phone, city, address }) =>
    `🧾 *Buyurtma*\n` +
    `👕 Mahsulot: ${item}\n` +
    `📏 Hajm: ${size}   |   Soni: ${qty}\n` +
    `💰 Narx: ${formatPrice(unitPrice, currency)}` +
    (qty > 1 ? ` × ${qty} = *${formatPrice(lineTotal, currency)}*` : "") +
    `\n👤 Mijoz: ${name}\n` +
    `📞 Tel: ${phone}\n` +
    `🏙 Shahar: ${city}\n` +
    `📍 Manzil: ${address}`,

  // Payment scaffold note shown on the confirmation screen.
  paymentNote: "💳 To'lov: yetkazib berishda kelishiladi.",

  // --- Admin delivery (SPEC §3) ---
  // The formatted order sent to ADMIN_CHAT_ID. Plain text (no Markdown): it
  // embeds raw customer input. If qty > 1, the price line shows the line total.
  adminOrder: ({ orderId, item, size, qty, unitPrice, lineTotal, currency, name, phone, city, address, time }) =>
    `🆕 YANGI BUYURTMA #${orderId}\n` +
    `👕 Mahsulot: ${item}\n` +
    `📏 Hajm: ${size}    |   Soni: ${qty}\n` +
    `💰 Narx: ${formatPrice(unitPrice, currency)}` +
    (qty > 1 ? ` × ${qty} = ${formatPrice(lineTotal, currency)}` : "") +
    `\n👤 Mijoz: ${name}\n` +
    `📞 Tel: ${phone}\n` +
    `🏙 Shahar: ${city}\n` +
    `📍 Manzil: ${address}\n` +
    `🕒 Vaqt: ${time}`,

  // --- After confirm ---
  thankYou: (orderId) =>
    `Rahmat! ✅ Buyurtmangiz qabul qilindi.\n` +
    `Buyurtma raqamingiz: *#${orderId}*\n` +
    `Tez orada siz bilan bog'lanamiz.` +
    (config.shopContact ? `\n\n📞 Aloqa: ${config.shopContact}` : ""),

  cancelled: "Buyurtma bekor qilindi. Katalogga qaytishingiz mumkin. 🛍",

  // --- Fallbacks / errors ---
  unknown: "Tushunmadim. Katalogni ko'rish uchun /start buyrug'ini bosing.",
  genericError: "Kechirasiz, xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.",
};
