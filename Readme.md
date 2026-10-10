# EREN X MD — WhatsApp Bot

A multi-session WhatsApp MD bot with a website-based pairing portal. Telegram pairing has been removed.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm start
```

Open `http://localhost:3000` (or the port configured by `PORT`). Enter a phone number with its country calling code and use the generated pairing code in WhatsApp → Settings → Linked devices → Link a device → Link with phone number.

## Railway

- Deploy this repository from GitHub.
- Start command: `npm start`.
- Optional variables: `PUBLIC_URL`, `WHATSAPP_CHANNEL_URL`, `MAX_PENDING_PAIRINGS`, `BAILEYS_LOG_LEVEL`.
- Use persistent storage for `database/` if available; without it, WhatsApp auth sessions and local JSON settings may be lost on redeploy.
- Never commit `database/sessions/`, `.env`, API keys or other secrets. `.gitignore` is included.

## Website features

- Phone-number pairing code generation
- WhatsApp Channel link
- Visitor, page-view, connected-session and saved-session counters
- Pairing status updates and short-lived codes
- Basic in-memory rate limiting

Visitor and page-view counts reset when the server restarts. This lightweight website is not a persistent analytics service.

## Important

Only connect WhatsApp accounts you own or are authorized to manage. Never share pairing codes or auth/session files. Commands that depend on third-party APIs may require working API endpoints or keys; those integrations cannot be guaranteed without testing their external services.
