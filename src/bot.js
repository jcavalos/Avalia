const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode        = require('qrcode-terminal');
const path          = require('path');
const StyleAnalyzer = require('./analyzer');
const GeminiClient  = require('./claude');
const config        = require('./config');

class WhatsAppBot {
  constructor() {
    this.analyzer      = new StyleAnalyzer();
    this.gemini        = new GeminiClient();
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

  async handleMessage(msg) {
    try {
      // Ignorar mensajes propios
      if (msg.fromMe) return;

      // Ignorar grupos
      if (msg.from.includes('@g.us')) return;

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
      const isVip = config.VIP_CONTACTS.some(v =>
        msg.from.includes(v) || senderName.toLowerCase().includes(v.toLowerCase())
      );

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
        const wait = Math.ceil((minInterval - (now - lastReply)) / 60000);
        console.log(`⏳ Esperando ${wait} min antes de volver a responder a ${senderName}`);
        console.log('-'.repeat(50));
        return;
      }

      // ── Generar respuesta ──
      console.log('🤖 Generando respuesta con Gemini...');
      const response = await this.gemini.generateResponse(
        msg.body,
        msg.from,
        this.systemPrompt
      );

      if (!response) {
        console.log('❌ No se pudo generar respuesta');
        console.log('-'.repeat(50));
        return;
      }

      console.log(`\n💭 Respuesta: "${response}"\n`);

      if (config.MODE === 'auto') {
        await msg.reply(response);
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
      console.error('❌ Falta GEMINI_API_KEY en tu archivo .env\n');
      console.log('   1. Ve a https://aistudio.google.com/app/apikey');
      console.log('   2. Crea una API key gratis');
      console.log('   3. Pégala en .env como GEMINI_API_KEY=AIzaSy...\n');
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
