const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');
const config = require('./config');

class ClaudeClient {
  constructor() {
    this.apiKey = config.CLAUDE_API_KEY;
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
        'https://api.anthropic.com/v1/messages',
        {
          model:       'claude-haiku-4-5-20251001',  // más económico
          max_tokens:  300,
          temperature: 0.8,
          system:      systemPrompt,
          messages:    recentHistory
        },
        {
          headers: {
            'Content-Type':      'application/json',
            'x-api-key':         this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: 30000
        }
      );

      const reply = response.data.content[0].text.trim();

      history.push({ role: 'assistant', content: reply });
      this._saveConversations();

      return reply;

    } catch (error) {
      if (error.response) {
        const { status, data } = error.response;
        if (status === 401) console.error('❌ API Key inválida. Revisa tu .env');
        else if (status === 429) console.error('⏱️  Rate limit. Espera un momento.');
        else console.error(`❌ Error ${status}:`, data?.error?.message || 'desconocido');
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

  clearHistory(sender = null) {
    if (sender) {
      this.conversationHistory.delete(sender);
      console.log(`✅ Historial borrado para: ${sender}`);
    } else {
      this.conversationHistory.clear();
      console.log('✅ Todo el historial borrado');
    }
    this._saveConversations();
  }
}

module.exports = ClaudeClient;
