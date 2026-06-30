// src/index.js
// Entry point: wires up grammY, sessions, the global error handler, and /start.
// Run with:  node --env-file=.env src/index.js   (npm start)

import { Bot, session, InlineKeyboard, InputFile } from "grammy";
import { config } from "./config.js";
import { messages } from "./messages.js";
import {
  getCategories,
  getItemsByCategory,
  getItem,
  isEmpty,
  resolvePhoto,
} from "./catalog.js";
import { orderFlow, cancelOrder } from "./order.js";

// ---- Session shape -----------------------------------------------------------
// One in-memory session per chat. `step` drives the order state machine
// (added in later phases). `order` accumulates the in-progress order.
function initialSession() {
  return {
    step: null, // null = idle (browsing), otherwise an order-flow step
    order: {}, // { itemId, size, qty, name, phone, city, address }
  };
}

// ---- Bot setup ---------------------------------------------------------------
const bot = new Bot(config.botToken);

bot.use(session({ initial: initialSession }));

// Welcome screen (also used by /start mid-flow to reset).
async function showWelcome(ctx) {
  ctx.session = initialSession(); // /start always resets any in-progress order
  const keyboard = new InlineKeyboard().text(messages.btn.catalog, "catalog");
  await ctx.reply(messages.welcome(), {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

// Inline keyboard with a single "open catalog" button — reused by the fallback
// and the idle /cancel reply to keep the bot button-driven.
function catalogButton() {
  return new InlineKeyboard().text(messages.btn.catalog, "catalog");
}

// ---- Commands ----------------------------------------------------------------
// Registered before the order flow so /start and /cancel always win over an
// in-progress step instead of being captured as text input.
bot.command("start", showWelcome);

// /cancel — abort an in-progress order at any point; gentle note if nothing's active.
bot.command("cancel", async (ctx) => {
  if (!ctx.session.step) {
    await ctx.reply(messages.noActiveOrder, { reply_markup: catalogButton() });
    return;
  }
  await cancelOrder(ctx);
});

// ---- Catalog browse (Phase 3) ------------------------------------------------
// Send an item as a photo card when its image exists on disk, otherwise fall
// back to a plain text message. Same call site works before and after Phase 7
// adds the placeholder images. `keyboard` is an InlineKeyboard.
async function sendItemCard(ctx, item, caption, keyboard) {
  const photo = resolvePhoto(item);
  if (photo) {
    await ctx.replyWithPhoto(new InputFile(photo), {
      caption,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } else {
    await ctx.reply(caption, { parse_mode: "Markdown", reply_markup: keyboard });
  }
}

// Category list: one button per derived category.
bot.callbackQuery("catalog", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (isEmpty()) {
    await ctx.reply(messages.emptyCatalog);
    return;
  }
  const keyboard = new InlineKeyboard();
  getCategories().forEach((category, i) => {
    keyboard.text(category, `cat:${i}`).row();
  });
  await ctx.reply(messages.chooseCategory, { reply_markup: keyboard });
});

// Item list for a chosen category: one photo card per item + a back button.
bot.callbackQuery(/^cat:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const category = getCategories()[Number(ctx.match[1])];
  if (!category) {
    await ctx.reply(messages.emptyCatalog);
    return;
  }
  await ctx.reply(messages.chooseItem(category));
  for (const item of getItemsByCategory(category)) {
    const caption = messages.itemCard(item);
    const keyboard = new InlineKeyboard().text(messages.btn.details, `item:${item.id}`);
    await sendItemCard(ctx, item, caption, keyboard);
  }
  const back = new InlineKeyboard().text(messages.btn.back, "catalog");
  await ctx.reply(messages.moreCategories, { reply_markup: back });
});

// Item detail: photo, name, description, price, size buttons, order button.
bot.callbackQuery(/^item:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const item = getItem(ctx.match[1]);
  if (!item) {
    await ctx.reply(messages.unknown);
    return;
  }
  const keyboard = new InlineKeyboard();
  // Sizes first (wired to the real order flow in Phase 4), then the order button.
  item.sizes.forEach((size) => keyboard.text(size, `size:${item.id}:${size}`));
  keyboard.row();
  keyboard.text(messages.btn.order, `order:${item.id}`).row();
  keyboard.text(messages.btn.back, `catalog`);
  await sendItemCard(ctx, item, messages.itemDetail(item), keyboard);
});

// ---- Order flow (Phase 4) ----------------------------------------------------
// Handles size → quantity → name → phone → city → address. Registered before the
// generic text fallback so mid-flow input reaches the flow; non-flow text falls
// through (the composer calls next() when no order step is active).
bot.use(orderFlow);

// Gentle fallback for stray text / unknown commands outside a flow. Mid-flow text
// is consumed by orderFlow (it only calls next() when no step is active), so by
// the time we get here the user is idle — point them back to the catalog.
bot.on("message:text", async (ctx) => {
  await ctx.reply(messages.unknown, { reply_markup: catalogButton() });
});

// Catch-all for stale / unknown inline buttons (e.g. tapping an old keyboard after
// a restart): acknowledge the callback so the client stops its loading spinner.
// Runs last, so real handlers above always take precedence.
bot.on("callback_query", async (ctx) => {
  await ctx.answerCallbackQuery();
});

// ---- Global error handler — never leak stack traces to users -----------------
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`[error] update ${ctx?.update?.update_id}:`, err.error);
  // Best-effort friendly message; ignore failures replying.
  ctx?.reply?.(messages.genericError).catch(() => {});
});

// ---- Launch ------------------------------------------------------------------
bot.start({
  onStart: (info) => console.log(`Bot started as @${info.username}`),
});
