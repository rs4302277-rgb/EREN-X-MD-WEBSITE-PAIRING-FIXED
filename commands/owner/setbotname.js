'use strict';

const { getBotName, setBotName, sanitizeName } = require('../../utils/sessionBotName');

module.exports = {
  name: 'setbotname',
  aliases: ['setname', 'botname'],
  category: 'owner',
  description: 'Change this paired bot session name',
  usage: '.setbotname <new name> or reply to a message with .setbotname',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      if (!extra.sessionPath) {
        return extra.reply('❌ Session storage is unavailable for this bot.');
      }

      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedText = quotedMsg?.conversation ||
        quotedMsg?.extendedTextMessage?.text ||
        quotedMsg?.imageMessage?.caption ||
        quotedMsg?.videoMessage?.caption ||
        '';
      const requestedName = sanitizeName(quotedText || args.join(' '));
      const currentName = getBotName(extra.sessionPath);

      if (!requestedName) {
        return extra.reply(
          `📝 *Set Bot Name*\n\n` +
          `Current name: *${currentName}*\n\n` +
          `Usage: *.setbotname <new name>*`
        );
      }

      if (requestedName.length > 50) {
        return extra.reply('❌ Bot name must be 50 characters or less.');
      }

      const savedName = setBotName(extra.sessionPath, requestedName);
      return extra.reply(
        `✅ This bot name changed to: *${savedName}*\n\n` +
        `Only this paired WhatsApp account was changed. Other bot sessions are unchanged.`
      );
    } catch (error) {
      console.error('Setbotname command error:', error);
      return extra.reply(`❌ Error: ${error.message}`);
    }
  }
};

