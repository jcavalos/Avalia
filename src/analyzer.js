const fs   = require('fs');
const path = require('path');
const config = require('./config');

class StyleAnalyzer {
  constructor() {
    this.myStyle = null;
  }

  analyzeExportedChats() {
    console.log('📊 Analizando tu estilo de escritura...\n');

    const chatsPath = config.PATHS.CHATS;

    if (!fs.existsSync(chatsPath)) {
      fs.mkdirSync(chatsPath, { recursive: true });
      throw new Error(`📁 Carpeta creada: ${chatsPath}\n   Por favor, exporta tus chats de WhatsApp allí.`);
    }

    const files = fs.readdirSync(chatsPath).filter(f => f.endsWith('.txt'));

    if (files.length === 0) {
      throw new Error(`📁 No hay archivos .txt en: ${chatsPath}\n   Exporta al menos 5 conversaciones de WhatsApp.`);
    }

    let myMessages = [];
    const nameCounts = {};

    files.forEach(file => {
      console.log(`   📄 Leyendo: ${file}`);
      const content = fs.readFileSync(path.join(chatsPath, file), 'utf-8');
      const lines   = content.split('\n');

      lines.forEach(line => {
        const match = line.match(
          /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?m\.?)?)\s*[-–]\s*([^:]+?):\s*(.+)/i
        );
        if (match) {
          const name = match[3].trim();
          nameCounts[name] = (nameCounts[name] || 0) + 1;
        }
      });
    });

    // El nombre con más mensajes es el tuyo
    const yourName = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    if (!yourName) {
      throw new Error('No se pudo detectar ningún nombre en los chats. Revisa el formato de los archivos .txt.');
    }

    console.log(`\n👤 Nombre detectado: ${yourName}\n`);

    files.forEach(file => {
      const content = fs.readFileSync(path.join(chatsPath, file), 'utf-8');
      content.split('\n').forEach(line => {
        const match = line.match(
          /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?m\.?)?)\s*[-–]\s*([^:]+?):\s*(.+)/i
        );
        if (match && match[3].trim() === yourName) {
          const msg = match[4].trim();
          if (!['imagen omitida','video omitido','audio omitido','archivo omitido','sticker omitido']
              .some(s => msg.includes(s))) {
            myMessages.push(msg);
          }
        }
      });
    });

    if (myMessages.length < 50) {
      throw new Error(
        `⚠️ Solo se encontraron ${myMessages.length} mensajes de "${yourName}".\n` +
        `   Necesitas al menos 50. Exporta más conversaciones.`
      );
    }

    console.log(`✅ ${myMessages.length} mensajes encontrados de: ${yourName}\n`);

    this.myStyle = this._analyzeStyle(myMessages);
    this._saveStyle();
    return this.myStyle;
  }

  _analyzeStyle(messages) {
    console.log('🔍 Analizando patrones...\n');

    const avgLength = Math.round(
      messages.reduce((sum, m) => sum + m.length, 0) / messages.length
    );

    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const allEmojis  = messages.join(' ').match(emojiRegex) || [];
    const emojiCounts = {};
    allEmojis.forEach(e => emojiCounts[e] = (emojiCounts[e] || 0) + 1);
    const topEmojis = Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);

    const phraseCounts = {};
    messages.forEach(msg => {
      const words = msg.toLowerCase().replace(/[^\wáéíóúñü\s]/g, '').split(/\s+/).filter(w => w.length > 2);
      for (let i = 0; i < words.length - 1; i++) {
        const p2 = words.slice(i, i + 2).join(' ');
        const p3 = words.slice(i, i + 3).join(' ');
        if (p2.length > 5) phraseCounts[p2] = (phraseCounts[p2] || 0) + 1;
        if (p3.length > 8) phraseCounts[p3] = (phraseCounts[p3] || 0) + 1;
      }
    });
    const commonPhrases = Object.entries(phraseCounts)
      .filter(p => p[1] >= 3).sort((a, b) => b[1] - a[1]).slice(0, 20).map(p => p[0]);

    const punctuation = {
      period:      Math.round(messages.filter(m => m.endsWith('.')).length / messages.length * 100),
      exclamation: Math.round(messages.filter(m => m.includes('!')).length  / messages.length * 100),
      question:    Math.round(messages.filter(m => m.includes('?')).length  / messages.length * 100),
      ellipsis:    Math.round(messages.filter(m => m.includes('...')).length / messages.length * 100)
    };

    const noCaps = messages.filter(m => {
      const l = m.replace(/[^a-zA-Z]/g, '');
      return l.length > 3 && l === l.toLowerCase();
    }).length;
    const capitalStyle = noCaps > messages.length * 0.5 ? 'minusculas_preferidas' : 'normal';

    const fillerWords  = ['jaja','jeje','ajá','aja','ok','okay','sí','si','no','pues','entonces'];
    const fillerCounts = {};
    messages.forEach(msg => {
      const lower = msg.toLowerCase();
      fillerWords.forEach(w => { if (lower.includes(w)) fillerCounts[w] = (fillerCounts[w] || 0) + 1; });
    });
    const topFillers = Object.entries(fillerCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(f => f[0]);

    const allWords     = messages.join(' ').split(/\s+/);
    const avgWordLength = Math.round(allWords.reduce((s, w) => s + w.length, 0) / allWords.length);

    const style = { avgMessageLength: avgLength, avgWordLength, emojis: topEmojis,
      commonPhrases, punctuation, capitalStyle, fillerWords: topFillers, totalMessages: messages.length };

    console.log('📊 ANÁLISIS COMPLETADO:\n');
    console.log(`   📝 Total mensajes : ${style.totalMessages}`);
    console.log(`   📏 Longitud prom  : ${style.avgMessageLength} caracteres`);
    console.log(`   😊 Emojis top     : ${style.emojis.slice(0, 5).join(' ') || '(ninguno)'}`);
    console.log(`   💬 Frases típicas : "${style.commonPhrases.slice(0, 3).join('", "') || '(ninguna)'}"`);
    console.log(`   ❗ Puntuación     : ${style.punctuation.period}% punto, ${style.punctuation.exclamation}% exclamación`);
    console.log(`   🔤 Capitalización : ${style.capitalStyle}\n`);

    return style;
  }

  _saveStyle() {
    const dir = path.dirname(config.PATHS.STYLE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(config.PATHS.STYLE, JSON.stringify(this.myStyle, null, 2));
    console.log(`✅ Estilo guardado en: ${config.PATHS.STYLE}\n`);
  }

  loadStyle() {
    if (fs.existsSync(config.PATHS.STYLE)) {
      this.myStyle = JSON.parse(fs.readFileSync(config.PATHS.STYLE, 'utf-8'));
      console.log('✅ Estilo cargado desde archivo\n');
      return this.myStyle;
    }
    return null;
  }

  generateSystemPrompt() {
    if (!this.myStyle) throw new Error('Primero ejecuta analyzeExportedChats()');
    const s = this.myStyle;
    return `Eres un asistente que responde mensajes de WhatsApp imitando EXACTAMENTE el estilo de escritura del usuario. Tu objetivo es que la otra persona NO note que es un bot.

CARACTERÍSTICAS DEL ESTILO:

📏 LONGITUD:
- Mensajes típicos: ${s.avgMessageLength} caracteres (±20)
- NO escribas mensajes muy largos ni muy cortos

😊 EMOJIS (úsalos con frecuencia):
${s.emojis.length ? s.emojis.map(e => `- ${e}`).join('\n') : '- No usa emojis'}

💬 FRASES Y EXPRESIONES TÍPICAS:
${s.commonPhrases.slice(0, 10).map(p => `- "${p}"`).join('\n')}

🗣️ MULETILLAS COMUNES:
${s.fillerWords.length ? s.fillerWords.map(w => `- ${w}`).join('\n') : '- ninguna detectada'}

❗ PUNTUACIÓN:
- Punto final: ${s.punctuation.period}% de las veces
- Exclamación: ${s.punctuation.exclamation}% de las veces
- Pregunta: ${s.punctuation.question}% de las veces
- Puntos suspensivos: ${s.punctuation.ellipsis}% de las veces

🔤 CAPITALIZACIÓN: ${s.capitalStyle}

REGLAS CRÍTICAS:
1. Responde EXACTAMENTE como esta persona escribiría
2. Mantén la longitud típica de ~${s.avgMessageLength} caracteres
3. NO uses markdown, asteriscos ni formato especial
4. Sé natural y conversacional
5. Si no sabes algo, di que no estás seguro de forma natural
6. Imita el ritmo: ${s.avgMessageLength < 50 ? 'respuestas cortas y directas' : s.avgMessageLength > 100 ? 'mensajes más elaborados' : 'mensajes moderados'}

Responde al siguiente mensaje:`;
  }
}

module.exports = StyleAnalyzer;
