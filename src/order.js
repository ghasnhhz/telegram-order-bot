// src/order.js
// The multi-step, session-backed order flow (SPEC §2 Step 3):
//   size → quantity → name → phone → city → address → (summary review).
// All handlers live on a grammY Composer so index.js can `bot.use(orderFlow)`.
// State is the in-memory session: `ctx.session.step` drives the machine and
// `ctx.session.order` accumulates the collected fields.

import { Composer, InlineKeyboard, Keyboard } from "grammy";
import { config } from "./config.js";
import { messages } from "./messages.js";
import { getItem } from "./catalog.js";
import { saveOrder, sendOrderToAdmin } from "./admin.js";

// ---- Pure helpers (exported for headless unit tests) -------------------------

// Strip spaces / dashes / parens / dots; keep a single optional leading "+".
export function normalizePhone(raw) {
  const trimmed = String(raw).trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/[^\d]/g, "");
}

// A phone "looks valid" if, once normalized, it's an optional + and 7–15 digits.
export function isValidPhone(raw) {
  return /^\+?\d{7,15}$/.test(normalizePhone(raw));
}

// Quantity is always an integer ≥ 1.
export function clampQty(n) {
  const q = Math.floor(Number(n));
  return Number.isFinite(q) && q >= 1 ? q : 1;
}

// ---- Keyboards ---------------------------------------------------------------

function sizeKeyboard(item) {
  const kb = new InlineKeyboard();
  item.sizes.forEach((size) => kb.text(size, `size:${item.id}:${size}`));
  return kb;
}

function qtyKeyboard() {
  return new InlineKeyboard()
    .text(messages.btn.qtyMinus, "qty:dec")
    .text(messages.btn.qtyPlus, "qty:inc")
    .row()
    .text(messages.btn.next, "qty:next");
}

function cityKeyboard() {
  const kb = new InlineKeyboard();
  config.cities.forEach((city, i) => kb.text(city, `city:${i}`).row());
  return kb;
}

// Reply keyboard offering Telegram's native "share contact" button.
function shareContactKeyboard() {
  return new Keyboard().requestContact(messages.btn.shareContact).resized().oneTime();
}

// ---- Step transitions (shared by several entry points) -----------------------

async function goToQuantity(ctx) {
  ctx.session.step = "qty";
  await ctx.reply(messages.chooseQty(ctx.session.order.qty), {
    parse_mode: "Markdown",
    reply_markup: qtyKeyboard(),
  });
}

async function goToCity(ctx) {
  ctx.session.step = "city";
  // First clear the one-time share-contact reply keyboard, then show the city
  // picker (a single message can't both remove a reply keyboard and carry an
  // inline keyboard, so we send the inline picker on its own).
  await ctx.reply(messages.phoneSaved, { reply_markup: { remove_keyboard: true } });
  await ctx.reply(messages.chooseCity, { reply_markup: cityKeyboard() });
}

function confirmKeyboard() {
  return new InlineKeyboard()
    .text(messages.btn.confirm, "confirm:yes")
    .text(messages.btn.cancel, "confirm:no");
}

// Reset to idle (browsing) and drop any in-progress order.
function resetSession(ctx) {
  ctx.session.step = null;
  ctx.session.order = {};
}

// Build and show the order summary with ✅/❌ buttons, then park at the confirm
// step. The actual delivery happens in the confirm:yes handler below.
async function showSummary(ctx) {
  const o = ctx.session.order;
  const item = getItem(o.itemId);
  if (!item) {
    // Catalog changed under us — bail to a sane state instead of crashing.
    resetSession(ctx);
    await ctx.reply(messages.unknown);
    return;
  }
  const unitPrice = item.price;
  const lineTotal = unitPrice * o.qty;
  ctx.session.step = "confirm";
  const summary = messages.orderSummary({
    item: item.name,
    size: o.size,
    qty: o.qty,
    unitPrice,
    lineTotal,
    currency: item.currency,
    name: o.name,
    phone: o.phone,
    city: o.city,
    address: o.address,
  });
  await ctx.reply(`${messages.confirmTitle}\n\n${summary}\n\n${messages.paymentNote}`, {
    parse_mode: "Markdown",
    reply_markup: confirmKeyboard(),
  });
}

// ---- Composer ----------------------------------------------------------------

export const orderFlow = new Composer();

// 🛒 Buyurtma berish → start order, show a dedicated size screen.
orderFlow.callbackQuery(/^order:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const item = getItem(ctx.match[1]);
  if (!item) {
    await ctx.reply(messages.unknown);
    return;
  }
  ctx.session.order = { itemId: item.id };
  ctx.session.step = "size";
  await ctx.reply(messages.chooseSize, { reply_markup: sizeKeyboard(item) });
});

// Tapping a size (on the detail screen or the size screen) starts/continues the
// order with that size and advances to quantity.
orderFlow.callbackQuery(/^size:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const item = getItem(ctx.match[1]);
  if (!item || !item.sizes.includes(ctx.match[2])) {
    await ctx.reply(messages.unknown);
    return;
  }
  ctx.session.order = { itemId: item.id, size: ctx.match[2], qty: 1 };
  await goToQuantity(ctx);
});

// Quantity − / + : edit the message in place.
orderFlow.callbackQuery(/^qty:(dec|inc)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.session.step !== "qty") return;
  const delta = ctx.match[1] === "inc" ? 1 : -1;
  ctx.session.order.qty = clampQty(ctx.session.order.qty + delta);
  try {
    await ctx.editMessageText(messages.chooseQty(ctx.session.order.qty), {
      parse_mode: "Markdown",
      reply_markup: qtyKeyboard(),
    });
  } catch {
    // "message is not modified" (e.g. − at qty 1) — nothing to do.
  }
});

// Quantity confirmed → ask for the name.
orderFlow.callbackQuery("qty:next", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.session.step !== "qty") return;
  ctx.session.step = "name";
  await ctx.reply(messages.askName);
});

// City chosen (config-driven list) → ask for the address.
orderFlow.callbackQuery(/^city:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.session.step !== "city") return;
  const city = config.cities[Number(ctx.match[1])];
  if (!city) {
    await ctx.reply(messages.chooseCity, { reply_markup: cityKeyboard() });
    return;
  }
  ctx.session.order.city = city;
  ctx.session.step = "address";
  await ctx.reply(messages.askAddress);
});

// ✅ Tasdiqlash → persist the order, deliver it to the admin, thank the customer.
orderFlow.callbackQuery("confirm:yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.session.step !== "confirm") return; // stale button — ignore quietly
  const o = ctx.session.order;
  const item = getItem(o.itemId);
  if (!item) {
    // Catalog changed under us — bail to a sane state instead of crashing.
    resetSession(ctx);
    await ctx.reply(messages.unknown);
    return;
  }
  const unitPrice = item.price;
  const lineTotal = unitPrice * o.qty;
  // Persist first (assigns orderId + timestamp), then deliver to the admin. Per
  // SPEC §5 shape — don't invent new fields.
  const saved = await saveOrder({
    item: { id: item.id, name: item.name },
    size: o.size,
    qty: o.qty,
    unitPrice,
    lineTotal,
    currency: item.currency,
    customer: {
      name: o.name,
      phone: o.phone,
      city: o.city,
      address: o.address,
      telegramUserId: ctx.from.id,
    },
  });
  await sendOrderToAdmin(ctx.api, saved);
  // TODO: integrate Click / Payme here (SPEC §6). For the demo, payment is
  // "arranged on delivery" — see messages.paymentNote on the confirm screen.
  await ctx.reply(messages.thankYou(saved.orderId), { parse_mode: "Markdown" });
  resetSession(ctx);
});

// ❌ Bekor qilish → abort the order, clear the session, offer the catalog again.
orderFlow.callbackQuery("confirm:no", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.session.step !== "confirm") return; // stale button — ignore quietly
  resetSession(ctx);
  const keyboard = new InlineKeyboard().text(messages.btn.catalog, "catalog");
  await ctx.reply(messages.cancelled, { reply_markup: keyboard });
});

// Phone via Telegram's "share contact" button (only meaningful at the phone step).
orderFlow.on("message:contact", async (ctx, next) => {
  if (ctx.session.step !== "phone") return next();
  ctx.session.order.phone = normalizePhone(ctx.message.contact.phone_number);
  await goToCity(ctx);
});

// Free-text steps. Anything outside a flow step falls through to index.js's fallback.
orderFlow.on("message:text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  switch (ctx.session.step) {
    case "name":
      ctx.session.order.name = text;
      ctx.session.step = "phone";
      await ctx.reply(messages.askPhone, { reply_markup: shareContactKeyboard() });
      return;
    case "phone":
      if (!isValidPhone(text)) {
        await ctx.reply(messages.invalidPhone);
        return;
      }
      ctx.session.order.phone = normalizePhone(text);
      await goToCity(ctx);
      return;
    case "address":
      ctx.session.order.address = text;
      await showSummary(ctx);
      return;
    case "qty":
      // Allow typing a number instead of using ➖ / ➕.
      ctx.session.order.qty = clampQty(text);
      await ctx.reply(messages.chooseQty(ctx.session.order.qty), {
        parse_mode: "Markdown",
        reply_markup: qtyKeyboard(),
      });
      return;
    case "size":
    case "city":
      // These steps expect a button tap; nudge instead of advancing.
      await ctx.reply(messages.useButtons);
      return;
    default:
      return next(); // not in a flow step — let the generic fallback handle it
  }
});
