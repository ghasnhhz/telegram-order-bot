// src/index.js
// Entry point: wires up grammY, sessions, the global error handler, and /start.
// Run with:  node --env-file=.env src/index.js   (npm start)

import { Bot, session, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { messages } from "./messages.js";

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

// ---- Commands ----------------------------------------------------------------
bot.command("start", showWelcome);

// Placeholder for the catalog button — fully implemented in Phase 3.
bot.callbackQuery("catalog", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("🛍 Katalog tez orada... (Phase 3)");
});

// Gentle fallback for anything unrecognized (refined in Phase 6).
bot.on("message:text", async (ctx) => {
  if (ctx.session.step) return; // mid-order text is handled by order flow (later phase)
  await ctx.reply(messages.unknown);
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
