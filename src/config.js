require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');

module.exports = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  MODE: process.env.BOT_MODE || 'suggest',
  MIN_REPLY_INTERVAL: parseInt(process.env.MIN_REPLY_INTERVAL) || 5,
  ALLOWED_CONTACTS: process.env.ALLOWED_CONTACTS
    ? process.env.ALLOWED_CONTACTS.split(',').map(c => c.trim()).filter(Boolean)
    : [],
  AUTO_REPLY_KEYWORDS: process.env.AUTO_REPLY_KEYWORDS
    ? process.env.AUTO_REPLY_KEYWORDS.split(',').map(k => k.trim()).filter(Boolean)
    : [],
  PATHS: {
    CHATS:         path.join(__dirname, '../exported_chats'),
    STYLE:         path.join(__dirname, '../data/style.json'),
    CONVERSATIONS: path.join(__dirname, '../data/conversations.json')
  }
};
