// src/config.js
// Reads all environment + per-shop settings in one place.
// Rebranding for a new client = editing .env, never this file.

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return value.trim();
}

function optional(name, fallback = "") {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

// Comma-separated list -> trimmed array, e.g. "Urganch,Xiva" -> ["Urganch","Xiva"]
function parseList(raw, fallback) {
  if (!raw || raw.trim() === "") return fallback;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  botToken: required("BOT_TOKEN"),
  // Telegram chat IDs are numeric; keep as string for the API but validate it's numeric-ish.
  adminChatId: required("ADMIN_CHAT_ID"),

  // Shop branding / config — drives the whole bot's identity.
  shopName: optional("SHOP_NAME", "Demo Do'kon"),
  shopContact: optional("SHOP_CONTACT", ""),
  cities: parseList(process.env.CITIES, ["Urganch", "Xiva"]),
};

// Light sanity check so misconfig fails loud at boot, not mid-order.
if (!/^-?\d+$/.test(config.adminChatId)) {
  throw new Error(
    `ADMIN_CHAT_ID should be a numeric chat ID (got "${config.adminChatId}"). Use @userinfobot to find yours.`
  );
}
