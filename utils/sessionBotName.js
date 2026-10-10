'use strict';

const fs = require('fs');
const path = require('path');

const NAME_FILE = 'bot-name.json';
const DEFAULT_NAME = 'Bot';

function nameFile(sessionPath) {
  return path.join(sessionPath, NAME_FILE);
}

function sanitizeName(value) {
  return String(value || '')
    .replace(/[\r\n]/g, ' ')
    .trim()
    .slice(0, 50);
}

function getBotName(sessionPath, fallback = DEFAULT_NAME) {
  try {
    const saved = JSON.parse(fs.readFileSync(nameFile(sessionPath), 'utf8'));
    const name = sanitizeName(saved && saved.name);
    if (name) return name;
  } catch {}
  return sanitizeName(fallback) || DEFAULT_NAME;
}

function setBotName(sessionPath, value) {
  const name = sanitizeName(value);
  if (!name) throw new Error('Bot name cannot be empty');
  fs.mkdirSync(sessionPath, { recursive: true });
  fs.writeFileSync(
    nameFile(sessionPath),
    JSON.stringify({ name, updatedAt: new Date().toISOString() }, null, 2),
    'utf8'
  );
  return name;
}

module.exports = { DEFAULT_NAME, getBotName, setBotName, sanitizeName };

