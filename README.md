# Telegram Order Bot — Demo (Children's Clothing)

A demo Telegram bot that lets customers browse a shop catalog, pick an item and size,
enter their details, and confirm an order — which is delivered, cleanly formatted, to the
shop admin's Telegram chat and logged to a file. Built to show clothing-shop admins what
running their store through a bot looks like.

> This is a demo / sales asset with generic placeholder data. To turn it into a real
> client's store, edit the config and data/catalog.json — no logic changes needed.

## Prerequisites

- Node.js current LTS (v20+). Check with node --version.
- A Telegram account.

## 1. Create your bot with BotFather

1. In Telegram, open a chat with @BotFather.
2. Send /newbot and follow the prompts (give it a name and a username ending in bot).
3. BotFather replies with a bot token like 123456789:ABCdef.... Copy it.

## 2. Find your admin chat ID

This is where test orders will land (your own chat).

1. In Telegram, open a chat with @userinfobot (or @getidsbot).
2. Send any message; it replies with your numeric chat ID (e.g. 123456789).

## 3. Configure .env

cp .env.example .env

Open .env and fill in:

BOT_TOKEN=123456789:ABCdef...     # from BotFather
ADMIN_CHAT_ID=123456789           # your chat ID from step 2
SHOP_NAME=Mening Do'konim          # shop display name (rebrand here)
SHOP_CONTACT=+998 90 000 00 00     # optional contact line
CITIES=Urganch,Xiva                # comma-separated delivery cities

> ⚠️ Never share or commit .env. It is gitignored.

## 4. Install and run

npm install
npm start

Then open your bot in Telegram and send /start.

## Testing the flow

1. /start → tap 🛍 Katalogni ko'rish.
2. Pick a category → an item → a size.
3. Set quantity, enter name, share/enter phone, pick city, enter address.
4. Confirm — the formatted order appears in your admin chat and is saved to
   data/orders.json.

Use /cancel to abort an order at any point.

## Rebranding for a real shop later

- Shop name / contact / cities → .env.
- Catalog (items, prices, sizes, descriptions) → data/catalog.json.
- Product photos → replace files in assets/.
- All Uzbek text → src/messages.js.

## Notes

- Payments are not integrated yet — orders confirm as "to be arranged on delivery."
  A scaffolded TODO marks where Click/Payme would go.
- Orders are logged to data/orders.json so nothing is lost even if a message fails.