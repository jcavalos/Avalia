const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode       = require('qrcode-terminal');
const path         = require('path');
const StyleAnalyzer = require('./analyzer');
const ClaudeClient  = require('./claude');
const config        = require('./config');

class WhatsAppBot {
  constructor() {
    this.analyzer      = new StyleAnalyzer();
    this.claude        = new ClaudeClient();
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
      console.log('='.repeat(50));
      console.log('\n👂 Escuchando mensajes...\n');
    });

    this.client.on('disconnected', (reason) => {
      console.log('\n⚠️  Bot desconectado:', reason);
    });

    this.client.on('auth_failure', () => {
      console.error('\n❌ Error de autenticación. Borra la carpeta .wwebjs_auth e intenta de nuevo.\n');
    });

    this.client.on('message', async (msg) => {
      await this.handleMessage(msg);
    });
  }

  async handleMessage(msg) {
    try {
      if (msg.fromMe)                     return;
      if (msg.from.includes('@g.us'))     return;  // ignorar grupos
      if (msg.type !== 'chat')            return;  // solo texto

      if (config.ALLOWED_CONTACTS.length > 0 && !config.ALLOWED_CONTACTS.includes(msg.from)) return;

      const contact     = await msg.getContact();
      const senderName  = contact.pushname || contact.name || msg.from;
      const timestamp   = new Date().toLocaleTimeString('es-MX');

      console.log('\n' + '-'.repeat(50));
      console.log(`💬 [${timestamp}] ${senderName}`);
      console.log(`📝 "${msg.body}"`);

      // Respetar intervalo mínimo por contacto
      const lastReply   = this.lastReplyTime.get(msg.from) || 0;
      const now         = Date.now();
      const minInterval = config.MIN_REPLY_INTERVAL * 60 * 1000;

      if (now - lastReply < minInterval) {
        const wait = Math.ceil((minInterval - (now - lastReply)) / 60000);
        console.log(`⏳ Esperando ${wait} min antes de responder a ${senderName}`);
        console.log('-'.repeat(50));
        return;
      }

      // Filtrar por palabras clave si están configuradas
      if (config.AUTO_REPLY_KEYWORDS.length > 0) {
        const hasKeyword = config.AUTO_REPLY_KEYWORDS.some(kw =>
          msg.body.toLowerCase().includes(kw.toLowerCase())
        );
        if (!hasKeyword) {
          console.log('⏭️  Sin palabras clave, omitiendo...');
          console.log('-'.repeat(50));
          return;
        }
        console.log('🔑 Palabra clave detectada');
      }

      console.log('🤖 Generando respuesta...');
      const response = await this.claude.generateResponse(msg.body, msg.from, this.systemPrompt);

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
      console.error('\n❌ Error manejando mensaje:', error.message);
    }
  }

  async start() {
    console.clear();
    console.log('\n' + '='.repeat(50));
    console.log('🎯 WHATSAPP BOT PERSONAL');
    console.log('='.repeat(50) + '\n');

    if (!config.CLAUDE_API_KEY || config.CLAUDE_API_KEY === 'tu-api-key-aqui') {
      console.error('❌ Falta CLAUDE_API_KEY en tu archivo .env\n');
      console.log('   1. Ve a https://console.anthropic.com/');
      console.log('   2. Crea una API key');
      console.log('   3. Pégala en .env como CLAUDE_API_KEY=sk-ant-...\n');
      process.exit(1);
    }

    let style = this.analyzer.loadStyle();
    if (!style) {
      console.log('🔍 No hay análisis de estilo previo, analizando chats...\n');
      try {
        style = this.analyzer.analyzeExportedChats();
      } catch (error) {
        console.error(`\n❌ ${error.message}\n`);
        console.log('Cómo exportar chats de WhatsApp:');
        console.log('  1. Abre un chat en WhatsApp');
        console.log('  2. Tres puntos → Más → Exportar chat');
        console.log('  3. Elige "Sin archivos multimedia"');
        console.log('  4. Guarda el .txt en la carpeta exported_chats/\n');
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

// Cierre graceful
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
