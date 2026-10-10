'use strict';

module.exports = {
  name: 'kickall',
  category: 'owner',
  description: 'Remove non-admin members from the current group after explicit confirmation',
  usage: '.kickall confirm',
  ownerOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
  async execute(sock, msg, args, extra) {
    if (String(args[0] || '').toLowerCase() !== 'confirm') {
      return extra.reply('⚠️ This action removes non-admin members from the current group. To continue, send `.kickall confirm`.');
    }
    const metadata = extra.groupMetadata || await sock.groupMetadata(extra.from);
    const participants = metadata?.participants || [];
    const botId = sock.user?.id?.split(':')[0];
    const targets = participants
      .filter(p => p?.id && !p.admin && p.id.split(':')[0] !== botId)
      .map(p => p.id);
    if (!targets.length) return extra.reply('No removable non-admin members were found.');
    let removed = 0;
    let failed = 0;
    // Process in small batches to avoid flooding WhatsApp's group-management endpoint.
    for (let i = 0; i < targets.length; i += 5) {
      const batch = targets.slice(i, i + 5);
      for (const jid of batch) {
        try {
          await sock.groupParticipantsUpdate(extra.from, [jid], 'remove');
          removed++;
        } catch (error) {
          failed++;
          console.warn('[kickall] removal failed:', error.message);
        }
      }
      if (i + 5 < targets.length) await new Promise(resolve => setTimeout(resolve, 900));
    }
    return extra.reply(`Kick-all finished. Removed: ${removed}. Failed: ${failed}. Admins were skipped.`);
  }
};
