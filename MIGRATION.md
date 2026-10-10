# EREN X MD — Website Pairing Migration

## Runtime structure

- `index.js`: starts the website and restores previously registered WhatsApp sessions.
- `web.js`: serves the pairing website and pairing/statistics API.
- `pair.js`: creates, reconnects, isolates and stops WhatsApp sessions.
- `autoload.js`: restores registered sessions only (incomplete pairing attempts are ignored).
- `handler.js` and `commands/`: WhatsApp command and moderation runtime.
- `public/`: pairing website, including the bot image.
- `config.js`: bot defaults and owner configuration.

## Local run

Use Node.js 20 or newer. Run `npm install`, then `npm start`. The website listens on `PORT` (default 3000). Open `http://localhost:3000`. No Telegram bot or Telegram token is used.

## Railway deployment

1. Push the project to a GitHub repository. Keep `database/sessions/`, `.env`, and local JSON database files out of Git. The included `.gitignore` excludes them.
2. Create a Railway project from the repository. The start command is `npm start` (or `node index.js`).
3. Set `PUBLIC_URL` to the deployed website URL if you want the WhatsApp menu to show it. Railway supplies `PORT` automatically.
4. Add persistent storage/volume for `database/` if the chosen Railway plan supports it. Without persistent storage, WhatsApp sessions and JSON moderation data can be lost during redeploys/restarts.
5. Pair only WhatsApp accounts you own or have permission to connect. Pairing codes are short-lived and must not be shared.

## Website API

- `GET /api/stats`: visitor/page-view counts, connected sessions and saved sessions for the current server process/storage.
- `POST /api/pair`: accepts JSON `{ "number": "919876543210" }`, generates a Baileys pairing code, and returns a `jobId`.
- `GET /api/pair-status?id=JOB_ID`: reports the state of that pairing request.

Counts are in-memory for visitors/page views and reset when the server restarts. Session totals depend on the server's storage. The site applies basic in-memory request limits; it is not intended as a high-scale public pairing service without additional protections.

## Security

Do not commit auth/session files, tokens, or API keys. The old Telegram token file was removed from the source. If that token was ever valid, revoke it with BotFather because it was present in the uploaded source archive.
