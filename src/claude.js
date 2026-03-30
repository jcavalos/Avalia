const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');
const config = require('./config');

class GroqClient {
  constructor() {
    this.apiKey = config.GROQ_API_KEY;
    this.conversationHistory = new Map();
    this._loadConversations();
  }

  async generateResponse(message, sender, systemPrompt) {
    try {
      if (!this.conversationHistory.has(sender)) {
        this.conversationHistory.set(sender, []);
      }
      const history = this.conversationHistory.get(sender);
      history.push({ role: 'user', content: message });
      const recentHistory = history.slice(-20);

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          max_tokens: 300,
          temperature: 0.8,
          messages: [
            { role: 'system', content: systemPrompt },
            ...recentHistory
          ]
        },
        {
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 30000
        }
      );

      const reply = response.data.choices[0].message.content.trim();
      history.push({ role: 'assistant', content: reply });
      this._saveConversations();
      return reply;

    } catch (error) {
      if (error.response) {
        console.error(`❌ Error ${error.response.status}:`, error.response.data?.error?.message || 'desconocido');
      } else {
        console.error('❌ Sin conexión o timeout:', error.message);
      }
      return null;
    }
  }

  _loadConversations() {
    const dir = path.dirname(config.PATHS.CONVERSATIONS);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(config.PATHS.CONVERSATIONS)) {
      try {
        const data = JSON.parse(fs.readFileSync(config.PATHS.CONVERSATIONS, 'utf-8'));
        this.conversationHistory = new Map(Object.entries(data));
        console.log(`✅ ${this.conversationHistory.size} conversaciones cargadas\n`);
      } catch {
        console.log('⚠️  Empezando con historial limpio\n');
      }
    }
  }

  _saveConversations() {
    fs.writeFileSync(
      config.PATHS.CONVERSATIONS,
      JSON.stringify(Object.fromEntries(this.conversationHistory), null, 2)
    );
  }
}

module.exports = GroqClient;