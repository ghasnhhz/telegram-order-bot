// src/catalog.js
// Data layer for the product catalog. Loads data/catalog.json once at boot and
// serves it through small accessor functions. Categories are DERIVED from the
// data, never hardcoded. Keep all catalog access behind these functions so a
// later swap to SQLite only touches this file.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const catalogPath = join(projectRoot, "data", "catalog.json");

// Load + cache once. A missing/empty/invalid file yields an empty catalog
// (logged server-side) rather than crashing the bot.
function loadCatalog() {
  try {
    const raw = readFileSync(catalogPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error("[catalog] data/catalog.json is not an array; using empty catalog.");
      return [];
    }
    return parsed;
  } catch (err) {
    console.error("[catalog] could not load data/catalog.json:", err.message);
    return [];
  }
}

const items = loadCatalog();

// Unique category names, in first-seen order.
export function getCategories() {
  const seen = new Set();
  const ordered = [];
  for (const item of items) {
    if (!seen.has(item.category)) {
      seen.add(item.category);
      ordered.push(item.category);
    }
  }
  return ordered;
}

export function getItemsByCategory(category) {
  return items.filter((item) => item.category === category);
}

export function getItem(id) {
  return items.find((item) => item.id === id);
}

export function isEmpty() {
  return items.length === 0;
}

// Resolve an item's photo to an absolute path IF the file exists on disk,
// else return null. Lets callers send a real photo once Phase 7 adds images,
// and fall back to text in the meantime — same call site either way.
export function resolvePhoto(item) {
  if (!item?.photo) return null;
  const abs = join(projectRoot, item.photo);
  return existsSync(abs) ? abs : null;
}
