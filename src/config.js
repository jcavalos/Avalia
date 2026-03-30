require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');

module.exports = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  MODE: process.env.BOT_MODE || 'suggest',
  MIN_REPLY_INTERVAL: parseInt(process.env.MIN_REPLY_INTERVAL) || 0,

  // Contactos a los que responde el bot (vacío = todos)
  ALLOWED_CONTACTS: process.env.ALLOWED_CONTACTS
    ? process.env.ALLOWED_CONTACTS.split(',').map(c => c.trim()).filter(Boolean)
    : [],

  // Contactos VIP: el bot AVISA pero NO responde, tú contestas personalmente
  VIP_CONTACTS: process.env.VIP_CONTACTS
    ? process.env.VIP_CONTACTS.split(',').map(c => c.trim()).filter(Boolean)
    : [],

  PATHS: {
    CHATS:         path.join(__dirname, '../exported_chats'),
    STYLE:         path.join(__dirname, '../data/style.json'),
    CONVERSATIONS: path.join(__dirname, '../data/conversations.json')
  }
};
