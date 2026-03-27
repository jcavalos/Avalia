const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');
const config = require('./config');

class GeminiClient {
  constructor() {
    this.apiKey = config.GEMINI_API_KEY;
    this.conversationHistory = new Map();
    this._loadConversations();
  }

  async generateResponse(message, sender, systemPrompt) {
    try {
      if (!this.conversationHistory.has(sender)) {
        this.conversationHistory.set(sender, []);
      }

      const history = this.conversationHistory.get(sender);
      history.push({ role: 'user', parts: [{ text: message }] });

      const recentHistory = history.slice(-20);

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: recentHistory,
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 300
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      const reply = response.data.candidates[0].content.parts[0].text.trim();

      history.push({ role: 'model', parts: [{ text: reply }] });
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

module.exports = GeminiClient;
```

---

**Luego actualiza tu `.env`** — cambia `CLAUDE_API_KEY` por esto:
```
GEMINI_API_KEY=pega-tu-key-de-gemini-aqui
BOT_MODE=suggest
MIN_REPLY_INTERVAL=5
ALLOWED_CONTACTS=
AUTO_REPLY_KEYWORDS=