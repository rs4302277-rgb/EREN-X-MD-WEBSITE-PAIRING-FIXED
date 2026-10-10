/**
 * SetNewsletter Command - Disabled
 */

module.exports = {
  name: 'setnewsletter',
  aliases: ['setnl', 'setchannel'],
  category: 'owner',
  description: 'Disabled',
  usage: '.setnewsletter',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminOnly: false,
  
  async execute(sock, msg, args, extra) {
    // kichu korbe na
    return;
  }
};
