/** Anti-spam toggle. Enforcement is implemented in handler.js. */
const database = require('../../database');

module.exports = {
  name: 'antispam',
  aliases: ['antiflood', 'spamguard'],
  category: 'admin',
  description: 'Detect repeated messages and remove spam',
  usage: '.antispam <on/off/set/get>',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,
  async execute(sock, msg, args, extra) {
    const settings = database.getGroupSettings(extra.from);
    const opt = String(args[0] || 'get').toLowerCase();
    if (opt === 'on') {
      database.updateGroupSettings(extra.from, { antiSpam: true });
      return extra.reply('✅ *Anti-spam enabled.* Repeated messages will be removed.');
    }
    if (opt === 'off') {
      database.updateGroupSettings(extra.from, { antiSpam: false });
      return extra.reply('🛡️ *Anti-spam disabled.*');
    }
    if (opt === 'set') {
      const action = String(args[1] || '').toLowerCase();
      if (!['delete', 'kick'].includes(action)) return extra.reply('Usage: `.antispam set delete` or `.antispam set kick`');
      database.updateGroupSettings(extra.from, { antiSpam: true, antiSpamAction: action });
      return extra.reply(`✅ *Anti-spam action set to ${action}.*`);
    }
    if (opt === 'get') {
      const fresh = database.getGroupSettings(extra.from);
      return extra.reply(`🛡️ *Anti-spam configuration*\nStatus: *${fresh.antiSpam ? 'ON' : 'OFF'}*\nAction: *${fresh.antiSpamAction || 'delete'}*\n\nUsage: .antispam on/off/set delete|kick`);
    }
    return extra.reply('Usage: `.antispam on/off/set delete|kick/get`');
  }
};
