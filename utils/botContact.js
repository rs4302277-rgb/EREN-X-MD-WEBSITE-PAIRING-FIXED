'use strict';

const axios = require('axios');

// Stylish quoted-contact card used by every bot status and command response.
const STYLISH_NAME = '—͞To፝֟֟ᴍ 𝐱 𝐘ᴇꫝ֟፝ɴ';
const LOCK_JID = '0@s.whatsapp.net';
const WP_CHANNEL = 'https://whatsapp.com/channel/0029VbBItW060eBXTB93HT1Q';
// The bundled image is used first so the vCard thumbnail works even when
// the hosting URL is unavailable or blocked by WhatsApp.
const EMBEDDED_BOT_THUMBNAIL = Buffer.from(
  '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',
  'base64'
);
const BOT_PIC = 'https://i.postimg.cc/9QQ0BVTn/IMG-20260814-WA0041.jpg';
const VCARD_PHOTO_BASE64 = EMBEDDED_BOT_THUMBNAIL.toString('base64');
const VCARD_CACHE = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  `FN:${STYLISH_NAME}`,
  'ORG:WhatsApp ✔',
  'TITLE:• Status',
  'PHOTO;ENCODING=b;TYPE=JPEG:' + VCARD_PHOTO_BASE64,
  'END:VCARD'
].join('\n');

let thumbnailPromise;

function getContactParticipant(sock) {
  return sock?.user?.id || LOCK_JID;
}

async function getBuffer(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 5000
    });
    return response.data;
  } catch {
    return null;
  }
}

function getThumbnail() {
  if (!thumbnailPromise) {
    thumbnailPromise = Promise.resolve(EMBEDDED_BOT_THUMBNAIL);
  }
  return thumbnailPromise;
}

async function sendBotContact(sock, jid, options = {}) {
  if (!sock || !jid) return null;

  const text = options.text || '';
  const participant = getContactParticipant(sock);
  const thumbnail = await getThumbnail();
  return sock.sendMessage(jid, {
    text,
    contextInfo: {
      stanzaId: Date.now().toString(),
      participant,
      quotedMessage: {
        contactMessage: {
          displayName: STYLISH_NAME,
          vcard: VCARD_CACHE,
          jpegThumbnail: thumbnail || undefined
        }
      }
    }
  });
}

async function sendTextWithBotContact(sock, jid, text, options = {}) {
  return sendBotContact(sock, jid, {
    ...options,
    text
  });
}

const WRAPPED_SOCKET = Symbol.for('knight-bot-mini.contact-wrapper');

function isCommandResponsePayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.contacts || payload.delete || payload.react || payload.protocolMessage) return false;
  return ['text', 'image', 'video', 'sticker', 'document', 'audio', 'location', 'buttons', 'template', 'list']
    .some((key) => payload[key] !== undefined);
}

function installBotContactWrapper(sock) {
  if (!sock || sock[WRAPPED_SOCKET] || typeof sock.sendMessage !== 'function') return sock;

  const originalSendMessage = sock.sendMessage.bind(sock);
  sock.sendMessage = async (jid, payload, options) => {
    if (!isCommandResponsePayload(payload) || payload.contextInfo?.quotedMessage?.contactMessage) {
      return originalSendMessage(jid, payload, options);
    }

    const thumbnail = await getThumbnail();
    const participant = getContactParticipant(sock);
    const contactContext = {
      stanzaId: Date.now().toString(),
      participant,
      quotedMessage: {
        contactMessage: {
          displayName: STYLISH_NAME,
          vcard: VCARD_CACHE,
          jpegThumbnail: thumbnail || undefined
        }
      }
    };

    return originalSendMessage(jid, {
      ...payload,
      contextInfo: {
        ...(payload.contextInfo || {}),
        ...contactContext
      }
    }, options);
  };

  Object.defineProperty(sock, WRAPPED_SOCKET, { value: true, enumerable: false });
  return sock;
}

module.exports = {
  STYLISH_NAME,
  LOCK_JID,
  WP_CHANNEL,
  BOT_PIC,
  VCARD_CACHE,
  getBuffer,
  sendBotContact,
  sendTextWithBotContact,
  installBotContactWrapper
};
