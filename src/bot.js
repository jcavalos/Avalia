const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode          = require('qrcode-terminal');
const path            = require('path');
const StyleAnalyzer   = require('./analyzer');
const GeminiClient    = require('./claude');
const KnowledgeLoader = require('./knowledgeLoader'); // NUEVO
const config          = require('./config');

class WhatsAppBot {
  constructor() {
    this.analyzer      = new StyleAnalyzer();
    this.gemini        = new GeminiClient();
    this.knowledge     = new KnowledgeLoader(); // NUEVO
    this.hasKnowledge  = false;                 // NUEVO
    this.lastReplyTime = new Map();
    this.systemPrompt  = null;

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, '../.wwebjs_auth')
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    this._setupEventHandlers();
  }

  _setupEventHandlers() {
    this.client.on('qr', (qr) => {
      console.log('\n📱 ESCANEA ESTE QR CON TU WHATSAPP:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n💡 WhatsApp → Dispositivos vinculados → Vincular dispositivo\n');
    });

    this.client.on('authenticated', () => {
      console.log('✅ Autenticación exitosa!');
    });

    this.client.on('ready', () => {
      console.log('\n' + '='.repeat(50));
      console.log('🚀 BOT CONECTADO Y FUNCIONANDO');
      console.log('='.repeat(50));
      console.log(`⚙️  Modo: ${config.MODE === 'auto' ? '🤖 AUTOMÁTICO' : '💡 SUGERENCIAS'}`);
      console.log(`⏱️  Intervalo mínimo: ${config.MIN_REPLY_INTERVAL} min`);
      console.log(`👥 Contactos: ${config.ALLOWED_CONTACTS.length ? config.ALLOWED_CONTACTS.join(', ') : 'TODOS'}`);
      console.log(`📚 Conocimiento de documentos: ${this.hasKnowledge ? 'ACTIVO' : 'sin documentos cargados'}`);
      if (config.VIP_CONTACTS.length > 0) {
        console.log(`⭐ Contactos VIP (solo aviso): ${config.VIP_CONTACTS.join(', ')}`);
      }
      console.log('='.repeat(50));
      console.log('\n👂 Escuchando mensajes...\n');
    });

    this.client.on('disconnected', (reason) => {
      console.log('\n⚠️  Bot desconectado:', reason);
    });

    this.client.on('auth_failure', () => {
      console.error('\n❌ Error de autenticación. Borra .wwebjs_auth e intenta de nuevo.\n');
    });

    this.client.on('message', async (msg) => {
      await this.handleMessage(msg);
    });
  }

  // NUEVO: combina el prompt de personalidad (fijo) con el conocimiento
  // relevante a ESTE mensaje específico (cambia con cada pregunta).
  _buildPrompt(userMessage) {
    if (!this.hasKnowledge) return this.systemPrompt;

    const contextBlock = this.knowledge.generateContextBlock(userMessage);

    return `${this.systemPrompt}

## CONOCIMIENTO DE TUS DOCUMENTOS (libros, trabajo, notas)
Si esta sección tiene información relevante a lo que preguntan, úsala para
responder — pero sigue hablando con tu estilo natural, no la resumas como
si fuera un documento.

Si dice "NO SE ENCONTRÓ INFORMACIÓN RELACIONADA": tus documentos no cubren
este tema. NO inventes datos de trabajo o del libro en ese caso — responde
con lo que sabes de forma natural, o di que no tienes ese dato a la mano.

${contextBlock}`;
  }

  async handleMessage(msg) {
    try {
      // Ignorar mensajes propios
      if (msg.fromMe) return;

      // Ignorar grupos
      if (msg.from.includes('@g.us')) return;
      if (msg.from.includes('@broadcast')) return;
      if (msg.from.includes('@newsletter')) return;
      if (msg.isStatus) return;
      if (msg.type === 'status') return;
      // Solo mensajes de texto
      if (!['chat', 'image', 'video', 'audio', 'ptt'].includes(msg.type) && !msg.body) return;

      // Filtrar por contactos permitidos si está configurado
      if (config.ALLOWED_CONTACTS.length > 0 && !config.ALLOWED_CONTACTS.includes(msg.from)) return;

      const contact    = await msg.getContact();
      const senderName = contact.pushname || contact.name || msg.from;
      const timestamp  = new Date().toLocaleTimeString('es-MX');

      console.log('\n' + '-'.repeat(50));
      console.log(`💬 [${timestamp}] ${senderName}`);
      console.log(`📝 "${msg.body}"`);

      // ── MODO VIP: avisar pero NO responder automáticamente ──
      const isVip = config.VIP_CONTACTS.some(v => {
        const vClean = v.trim().toLowerCase();
        return msg.from.includes(vClean) ||
               senderName.toLowerCase().includes(vClean) ||
               senderName.toLowerCase() === vClean;
      });

      if (isVip) {
        console.log('\n');
        console.log('★'.repeat(50));
        console.log(`⭐ CONTACTO VIP: ${senderName}`);
        console.log(`📩 Mensaje: "${msg.body}"`);
        console.log(`⚠️  Este contacto requiere tu respuesta personal`);
        console.log('★'.repeat(50));
        console.log('\n');
        return; // No responde el bot
      }

      // ── Intervalo mínimo por contacto ──
      const lastReply   = this.lastReplyTime.get(msg.from) || 0;
      const now         = Date.now();
      const minInterval = config.MIN_REPLY_INTERVAL * 60 * 1000;

      if (minInterval > 0 && (now - lastReply) < minInterval) {
        const wait = (minInterval - (now - lastReply));
        console.log(`⏳ Esperando ${Math.ceil(wait/60000)} min para responder a ${senderName}`);
        setTimeout(async () => {
          const promptFinal = this._buildPrompt(msg.body); // NUEVO
          const response = await this.gemini.generateResponse(msg.body, msg.from, promptFinal);
          if (response) {
            const chat = await msg.getChat();
            await chat.sendMessage(response);
            console.log(`✅ Respuesta retrasada enviada a ${senderName}: "${response}"`);
            this.lastReplyTime.set(msg.from, Date.now());
          }
        }, wait);
        return;
      }

      // ── Generar respuesta ──
      console.log('🤖 Generando respuesta...');
      const promptFinal = this._buildPrompt(msg.body); // NUEVO: prompt + conocimiento relevante
      const response = await this.gemini.generateResponse(
        msg.body,
        msg.from,
        promptFinal
      );

      if (!response) {
        console.log('❌ No se pudo generar respuesta');
        console.log('-'.repeat(50));
        return;
      }

      console.log(`\n💭 Respuesta: "${response}"\n`);

      if (config.MODE === 'auto') {
        const chat = await msg.getChat();
        await chat.sendMessage(response);
        console.log('✅ ENVIADA AUTOMÁTICAMENTE');
        this.lastReplyTime.set(msg.from, now);
      } else {
        console.log('💡 MODO SUGERENCIA — no se envió');
        console.log('   Cambia BOT_MODE=auto en .env para enviar automáticamente');
      }

      console.log('-'.repeat(50));

    } catch (error) {
      console.error('\n❌ Error:', error.message);
    }
  }

  async start() {
    console.clear();
    console.log('\n' + '='.repeat(50));
    console.log('🎯 WHATSAPP BOT PERSONAL — AVALIA');
    console.log('='.repeat(50) + '\n');

    if (!config.GROQ_API_KEY || config.GROQ_API_KEY.includes('tu-key')) {
      console.error('❌ Falta GROQ_API_KEY en tu archivo .env\n');
      console.log('   1. Ve a https://console.groq.com/keys');
      console.log('   2. Crea una API key gratis');
      console.log('   3. Pégala en .env como GROQ_API_KEY=gsk_...\n');
      process.exit(1);
    }

    let style = this.analyzer.loadStyle();
    if (!style) {
      console.log('🔍 No hay análisis previo, analizando chats...\n');
      try {
        style = this.analyzer.analyzeExportedChats();
      } catch (error) {
        console.error(`\n❌ ${error.message}\n`);
        process.exit(1);
      }
    }

    this.systemPrompt = this.analyzer.generateSystemPrompt();

    // NUEVO: carga documentos si existen. Si no hay carpeta docs/ o está
    // vacía, el bot sigue funcionando normal, solo sin ese conocimiento extra.
    try {
      console.log('📚 Buscando documentos (PDFs)...');
      await this.knowledge.loadDocuments();
      this.hasKnowledge = true;
    } catch (error) {
      console.log(`ℹ️  Sin documentos cargados (${error.message.split('\n')[0]})`);
      console.log('   El bot seguirá funcionando solo con tu estilo de chats.\n');
      this.hasKnowledge = false;
    }

    console.log('🔄 Conectando a WhatsApp...\n');
    await this.client.initialize();
  }

  async stop() {
    console.log('\n🛑 Deteniendo bot...');
    await this.client.destroy();
    console.log('✅ Bot detenido\n');
  }
}

let bot = null;
process.on('SIGINT',  async () => { if (bot) await bot.stop(); process.exit(0); });
process.on('SIGTERM', async () => { if (bot) await bot.stop(); process.exit(0); });

async function main() {
  bot = new WhatsAppBot();
  await bot.start();
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});