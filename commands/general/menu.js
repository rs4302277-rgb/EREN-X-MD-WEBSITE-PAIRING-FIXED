/**
 * Menu Command - Display all available commands
 */

const config = require('../../config');
const os = require('os');
const { loadCommands } = require('../../utils/commandLoader');

module.exports = {
  name: 'menu',
  aliases: ['help', 'commands'],
  category: 'general',
  description: 'Show all available commands',
  usage: '.menu',

  async execute(sock, msg, args, extra) {
    try {
      const commands = loadCommands();
      const categories = {};

      // Group commands by category
      commands.forEach((cmd, name) => {
        if (cmd.name === name) {
          if (!categories[cmd.category]) {
            categories[cmd.category] = [];
          }
          categories[cmd.category].push(cmd);
        }
      });

      const ownerNames = Array.isArray(config.ownerName)? config.ownerName : [config.ownerName];
      const displayOwner = ownerNames[0] || config.ownerName || 'Bot Owner';

      const time = new Date().toLocaleTimeString('en-US', { hour12: true });
      const date = new Date().toLocaleDateString('en-GB');
      const uptime = process.uptime();
      const h = Math.floor(uptime / 3600);
      const m = Math.floor((uptime % 3600) / 60);
      const s = Math.floor(uptime % 60);
      const runtime = `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
      const usedRam = (process.memoryUsage().rss / 1024 / 1024 / 1024).toFixed(2);
      const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
      const mode = config.selfMode ? 'PRIVATE' : 'PUBLIC';
      const currentUser = extra.pushName || (extra.sender || '').split('@')[0] || 'User';
      const pairLink = config.pairLink || process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'Website URL appears after Railway deploy');
      const developerName = config.developerName || displayOwner;
      const botName = config.botName || 'Bot';

      // Bot status block from the reference image.
      let menuText = '';
      menuText += `╭────〔 ${botName} 〕────╮\n`;
      menuText += `┃🌸 *𝐑ᴜɴ*       : ${runtime}\n`;
      menuText += `┃💓 *𝐌ᴏᴅᴇ*      : ${mode}\n`;
      menuText += `┃👀 *𝐏ʀᴇғɪx*    : ${config.prefix}\n`;
      menuText += `┃💾 *𝐑ᴀᴍ*       : ${usedRam} / ${totalRam} GB\n`;
      menuText += `┃☁️ *𝐓ɪᴍᴇ*       : ${time}\n`;
      menuText += `┃🫂 *𝐔sᴇʀ*       : ${currentUser}\n`;
      menuText += `┃👾 *𝐏ʟᴀᴛғᴏʀᴍ*   : 𝐖ʜᴀᴛsᴀᴘᴘ\n`;
      menuText += `┃🔐 *𝐏ᴀɪʀ*       : ${pairLink}\n`;
      menuText += `┃🎀 *𝐎ᴡɴᴇʀ*      : —͞𝐘ᴇꫝ֟፝ɴㅤᏴꫝ֟፝ʙ𝚈\n`;
      menuText += `┃🧬 *𝐃ᴇᴠᴇʟᴏᴘᴇʀ*  : —͞To፝֟֟ᴍㅤᏴꫝ֟፝ʙ𝚈\n`;
      menuText += `╰────────────────────╯\n\n`;

      // Helper to add category
      const addCategory = (title, catName) => {
        if (categories[catName] && categories[catName].length > 0) {
          menuText += `\`『 ${title.toUpperCase()} 』\`\n`;
          menuText += `╭───────────────────⊷\n`;
          categories[catName].forEach(cmd => {
            menuText += `*┋ ⬡ ${cmd.name}*\n`;
          });
          menuText += `╰───────────────────⊷\n`;
        }
      };

      addCategory('OWNER MENU', 'owner');
      addCategory('ADMIN MENU', 'admin');
      addCategory('GROUP MENU', 'group');
      addCategory('AI MENU', 'ai');
      addCategory('MEDIA MENU', 'media');
      addCategory('FUN MENU', 'fun');
      addCategory('GENERAL MENU', 'general');
      addCategory('ANIME MENU', 'anime');
      addCategory('TEXTMAKER MENU', 'textmaker');
      addCategory('UTILITY MENU', 'utility');

      // EKHANE ADD KORBA
      menuText += `\n> *_𝐏ᴏᴡᴇʀᴇᴅ ʙʏ 𝐓𝐨፝֟֟ᴍ 𝐱♡ 💗𝐘ᴇꫝ֟፝ɴ_*\n`;
      menuText += `_𝐋ᴜxᴜʀʏ ʀᴇᴅᴇғɪɴᴇᴅ • 𝐃ʜᴀᴋᴀ 202𝟓_`;

      // Send menu with the supplied video...
      const fs = require('fs');
      const path = require('path');
      const imagePath = path.join(__dirname, '../../utils/bot_image.jpg');

      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        await sock.sendMessage(extra.from, {
          image: imageBuffer,
          caption: menuText,
          mentions: [extra.sender],
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: config.newsletterJid || '120363403719538106@newsletter',
              newsletterName: config.botName,
              serverMessageId: -1
            }
          }
        }, { quoted: msg });
      } else {
        await sock.sendMessage(extra.from, {
          text: menuText,
          mentions: [extra.sender]
        }, { quoted: msg });
      }

    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
