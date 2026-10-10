'use strict';

const fs = require('fs');
const path = require('path');
const pino = require('pino');
const {
  default: makeWASocket,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const handler = require('./handler');
const { sendBotContact } = require('./utils/botContact');
const { getBotName } = require('./utils/sessionBotName');

const PAIRING_ROOT = path.join(__dirname, 'database', 'sessions');
const activeSessions = new Map();
const reconnectTimers = new Map();
const pairingLocks = new Set();
const cancelledPairings = new Set();
const MAX_RECONNECT_DELAY = 30000;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeNumber(value) {
  const number = String(value || '').replace(/\D/g, '');
  if (!/^\d{7,15}$/.test(number)) throw new Error('Invalid phone number');
  return number;
}

function sessionIdFor(number) {
  return `${normalizeNumber(number)}@s.whatsapp.net`;
}

function sessionPathFor(number) {
  return path.join(PAIRING_ROOT, sessionIdFor(number));
}

function logger() {
  return pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' });
}

function clearReconnect(number) {
  const timer = reconnectTimers.get(number);
  if (timer) clearTimeout(timer);
  reconnectTimers.delete(number);
}

function scheduleReconnect(number, options, attempt) {
  if (cancelledPairings.has(number)) return;
  clearReconnect(number);
  const delay = Math.min(1000 * Math.pow(2, Math.min(attempt, 5)), MAX_RECONNECT_DELAY);
  const timer = setTimeout(() => {
    reconnectTimers.delete(number);
    startPairing(number, { ...options, reconnectAttempt: attempt + 1 }).catch((error) => {
      console.error(`[session ${number}] reconnect failed:`, error.message);
    });
  }, delay);
  reconnectTimers.set(number, timer);
}

async function startPairing(numberInput, options = {}) {
  const number = normalizeNumber(numberInput);
  if (options.reconnectAttempt) {
    if (cancelledPairings.has(number)) return null;
  } else {
    // A fresh manual /pair request is allowed after an earlier timeout.
    cancelledPairings.delete(number);
  }
  const sessionId = sessionIdFor(number);
  const sessionPath = sessionPathFor(number);
  ensureDir(sessionPath);

  const existing = activeSessions.get(number);
  if (existing && existing.sock && existing.sock.ws && existing.sock.ws.readyState !== 3) {
    if (!existing.connected && typeof options.onPairingCode === 'function') {
      const pairingFile = path.join(existing.sessionPath, 'pairing.json');
      if (fs.existsSync(pairingFile)) {
        try {
          const saved = JSON.parse(fs.readFileSync(pairingFile, 'utf8'));
          await options.onPairingCode(saved.code, { number, sessionId, sessionPath: existing.sessionPath });
        } catch {}
      }
    }
    return existing.sock;
  }
  if (pairingLocks.has(number)) return activeSessions.get(number) || null;
  pairingLocks.add(number);

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      version,
      logger: logger(),
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger())
      },
      syncFullHistory: false,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      getMessage: async () => ({ conversation: '' })
    });

    const record = {
      number,
      sessionId,
      sessionPath,
      sock,
      options: { ...options },
      reconnectAttempt: options.reconnectAttempt || 0,
      connected: false,
      autoActionsStarted: false
    };
    activeSessions.set(number, record);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const message of messages || []) {
        if (!message?.message || !message?.key?.remoteJid) continue;
        try {
          await handler.handleMessage(sock, message, {
            sessionPath,
            sessionId,
            botName: getBotName(sessionPath)
          });
        } catch (error) {
          if (!/rate-overlimit|not-authorized/i.test(error.message || '')) {
            console.error(`[session ${number}] message error:`, error.message);
          }
        }
      }
    });

    sock.ev.on('group-participants.update', async (update) => {
      try {
        await handler.handleGroupUpdate(sock, update, {
          sessionPath,
          sessionId,
          botName: getBotName(sessionPath)
        });
      } catch (error) {
        console.error(`[session ${number}] group participant event error:`, error.message);
      }
    });

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        record.connected = true;
        record.reconnectAttempt = 0;
        clearReconnect(number);
        console.log(`✅ WhatsApp session connected: ${sessionId}`);
        try {
          const welcomeText = [
            '*╭━━━〔♡Eʀᴇɴ 𝙭 ᴍᴅ〄〕━━━✦*',
            '*┃👾 𝐎ᴡɴᴇʀ : wa.me/8801323266193*',
            '*┃💗 𝐏ʀᴇꜰɪx : .*',
            '*┃🛡️ 𝐌ᴏᴅᴇ : public*',
            '*┃✨ 𝐏ʟᴀᴛꜰᴏʀᴍ : linux*',
            '*┃🌸 𝐕ᴇʀꜱɪᴏɴ : 1.0.0*',
            '*╰━━━━━━━━━━╯*',
            '*╭━━━〔🛠️ Hᴇʟᴩ 〕━━━✦*',
            '*┃✧ Tʏᴩᴇ .help to view all*',
            '*╰━━━━━━━━━━╯*',
            '*╭━━━〔📞 Cᴏɴᴛᴀᴄᴛ 〕━━━✦*',
            '*┃🔰 Dᴇᴠᴇʟᴏᴩᴇʀ : +8801842406536*',
            '*┃🌚 𝐒ᴜᴩᴘᴏʀᴛ : https://whatsapp.com/channel/0029VbBItW060eBXTB93HT1Q*',
            '*╰━━━━━━━━━━╯*'
          ].join('\n');
          await sendBotContact(sock, sessionId, { text: welcomeText });
        } catch (welcomeError) {
          console.error(`[session ${number}] connection welcome error:`, welcomeError.message);
        }
        if (typeof record.options.onConnected === 'function') {
          await record.options.onConnected({ number, sessionId, sessionPath });
        }
        // Do not auto-follow newsletters or join groups without the account owner's consent.
        return;
      }

      if (connection !== 'close') return;
      record.connected = false;
      activeSessions.delete(number);
      const status = lastDisconnect?.error?.output?.statusCode;
      if (status === DisconnectReason.loggedOut || status === DisconnectReason.badSession) {
        console.warn(`⚠️ Session logged out or invalid: ${sessionId}`);
        if (typeof record.options.onLoggedOut === 'function') {
          await record.options.onLoggedOut({ number, sessionId, sessionPath });
        }
        return;
      }
      console.warn(`⚠️ Session closed (${status || 'unknown'}): ${sessionId}`);
      scheduleReconnect(number, record.options, (record.reconnectAttempt || 0) + 1);
    });

    if (!state.creds.registered) {
      const code = await new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const pairingCode = await sock.requestPairingCode(number);
            const formatted = pairingCode?.match(/.{1,4}/g)?.join('-') || pairingCode;
            const pairingFile = path.join(sessionPath, 'pairing.json');
            fs.writeFileSync(pairingFile, JSON.stringify({ number, code: formatted, createdAt: Date.now() }, null, 2));
            resolve(formatted);
          } catch (error) {
            reject(error);
          }
        }, 2000);
      });
      if (typeof options.onPairingCode === 'function') await options.onPairingCode(code, { number, sessionId, sessionPath });
    }

    return sock;
  } finally {
    pairingLocks.delete(number);
  }
}

function getActiveSessions() {
  return Array.from(activeSessions.values()).map(({ number, sessionId, sessionPath, connected }) => ({ number, sessionId, sessionPath, connected }));
}

async function stopPairing(numberInput, removeFiles = false) {
  const number = normalizeNumber(numberInput);
  cancelledPairings.add(number);
  clearReconnect(number);
  const active = activeSessions.get(number);
  if (active?.sock) {
    try { active.sock.ws?.close(); } catch {}
    try { active.sock.end?.(undefined); } catch {}
  }
  activeSessions.delete(number);
  if (removeFiles) fs.rmSync(sessionPathFor(number), { recursive: true, force: true });
}

ensureDir(PAIRING_ROOT);
module.exports = { startPairing, stopPairing, getActiveSessions, sessionPathFor, PAIRING_ROOT, normalizeNumber };
