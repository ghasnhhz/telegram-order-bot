// src/admin.js
// Order delivery layer (SPEC §2 Step 5, §3, §5): persist a confirmed order to
// data/orders.json and send a clean formatted message to ADMIN_CHAT_ID.
// Keep all order I/O + admin formatting here so a later DB swap only touches this
// file (same single-responsibility posture as catalog.js).

import { readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { config } from "./config.js";
import { messages } from "./messages.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const ordersPath = join(projectRoot, "data", "orders.json");

// ---- Safe append to data/orders.json -----------------------------------------
// Every write runs through this single promise chain (an in-process mutex), so
// two near-simultaneous confirmations can't read-modify-write over each other
// and lose an order. Each task is queued whether the previous one fulfilled or
// rejected (the .catch keeps the chain alive after a failed write).
let writeQueue = Promise.resolve();
function enqueue(task) {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => {});
  return run;
}

// Read the orders array; a missing/empty/invalid file yields [] (logged) rather
// than crashing — mirrors catalog.js:loadCatalog's defensive load.
async function readOrders() {
  try {
    const raw = await readFile(ordersPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[orders] could not read data/orders.json:", err.message);
    }
    return [];
  }
}

// Next sequential order number = highest existing id + 1 (so it survives a
// restart and any gaps), zero-padded to 5 digits → "00001", "00123".
function nextOrderId(orders) {
  const highest = orders.reduce((max, o) => {
    const n = parseInt(o.orderId, 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return String(highest + 1).padStart(5, "0");
}

// Atomically persist back: write a temp file then rename over the target, so a
// crash mid-write can't leave a truncated/corrupt orders.json.
async function writeOrders(orders) {
  const tmp = `${ordersPath}.tmp`;
  await writeFile(tmp, JSON.stringify(orders, null, 2), "utf8");
  await rename(tmp, ordersPath);
}

// Assign orderId + timestamp and append. `partial` carries everything else per
// SPEC §5 (item {id,name}, size, qty, unitPrice, lineTotal, currency, customer).
// Returns the full saved record (caller needs the orderId for the thank-you).
export function saveOrder(partial) {
  return enqueue(async () => {
    const orders = await readOrders();
    const record = {
      orderId: nextOrderId(orders),
      timestamp: new Date().toISOString(),
      ...partial,
    };
    orders.push(record);
    await writeOrders(orders);
    return record;
  });
}

// ---- Admin delivery ----------------------------------------------------------

// Local time as "YYYY-MM-DD HH:mm" (SPEC §3). Built from the record's ISO
// timestamp so the admin message and the stored order agree.
function formatLocalTime(isoTimestamp) {
  const d = new Date(isoTimestamp);
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}`
  );
}

// Build the admin message text for a saved order record. Exported so it can be
// unit-tested headlessly without a live Telegram send.
export function formatOrderForAdmin(record) {
  return messages.adminOrder({
    orderId: record.orderId,
    item: record.item.name,
    size: record.size,
    qty: record.qty,
    unitPrice: record.unitPrice,
    lineTotal: record.lineTotal,
    currency: record.currency,
    name: record.customer.name,
    phone: record.customer.phone,
    city: record.customer.city,
    address: record.customer.address,
    time: formatLocalTime(record.timestamp),
  });
}

// Send the formatted order to ADMIN_CHAT_ID. Plain text (no parse_mode): the
// message embeds raw customer name/phone/address that could otherwise break
// Markdown parsing.
export async function sendOrderToAdmin(api, record) {
  await api.sendMessage(config.adminChatId, formatOrderForAdmin(record));
}
