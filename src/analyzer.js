const fs   = require('fs');
const path = require('path');
const config = require('./config');

/**
 * StyleAnalyzer
 * Analiza chats exportados de WhatsApp para detectar el estilo de escritura
 * del usuario y genera un system prompt que hace que el bot "hable como tú".
 */
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

    const nameCounts = {};

    // Formato México con corchetes: [22/09/25, 11:43:38 a.m.] Nombre: mensaje
    const lineRegex = /^\[[\d\/]+,\s[\d:]+\s[ap]\.m\.\]\s([^:]+):\s(.+)$/i;

    files.forEach(file => {
      console.log(`   📄 Leyendo: ${file}`);
      const content = fs.readFileSync(path.join(chatsPath, file), 'utf-8');
      content.split('\n').forEach(line => {
        const clean = line.trim();
        const match = clean.match(lineRegex);
        if (match) {
          const name = match[1].trim();
          nameCounts[name] = (nameCounts[name] || 0) + 1;
        }
      });
    });

    if (Object.keys(nameCounts).length === 0) {
      throw new Error('No se pudo detectar ningún nombre en los chats. Revisa el formato de los archivos .txt.');
    }

    // El nombre con más mensajes es el tuyo
    const yourName = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0][0];

    console.log(`\n👤 Nombre detectado como tuyo: "${yourName}"`);
    console.log(`   (el que más mensajes tiene en todos los chats)\n`);

    const myMessages = [];
    const skipPhrases = [
      'imagen omitida', 'video omitido', 'audio omitido',
      'archivo omitido', 'sticker omitido', 'llamada perdida',
      'cifrados de extremo a extremo', 'Los mensajes y las llamadas'
    ];

    files.forEach(file => {
      const content = fs.readFileSync(path.join(chatsPath, file), 'utf-8');
      content.split('\n').forEach(line => {
        const clean = line.trim();
        const match = clean.match(lineRegex);
        if (match && match[1].trim() === yourName) {
          const msg = match[2].trim();
          if (!skipPhrases.some(s => msg.includes(s))) {
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

    console.log(`✅ ${myMessages.length} mensajes tuyos encontrados\n`);

    this.myStyle = this._analyzeStyle(myMessages);
    // Guarda también ejemplos reales (few-shot) para reforzar el estilo,
    // no solo estadísticas.
    this.myStyle.sampleMessages = this._pickRepresentativeSamples(myMessages, 25);
    this._saveStyle();
    return this.myStyle;
  }

  _pickRepresentativeSamples(messages, n) {
    // Toma mensajes de longitud "normal" (ni muy cortos ni gigantes)
    // para que sirvan como ejemplos few-shot reales de tu forma de escribir.
    const filtered = messages.filter(m => m.length >= 15 && m.length <= 200);
    const pool = filtered.length >= n ? filtered : messages;
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
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
      const words = msg.toLowerCase()
        .replace(/[^\wáéíóúñü\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2);
      for (let i = 0; i < words.length - 1; i++) {
        const p2 = words.slice(i, i + 2).join(' ');
        const p3 = words.slice(i, i + 3).join(' ');
        if (p2.length > 5) phraseCounts[p2] = (phraseCounts[p2] || 0) + 1;
        if (p3.length > 8) phraseCounts[p3] = (phraseCounts[p3] || 0) + 1;
      }
    });
    const commonPhrases = Object.entries(phraseCounts)
      .filter(p => p[1] >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(p => p[0]);

    const punctuation = {
      period:      Math.round(messages.filter(m => m.endsWith('.')).length  / messages.length * 100),
      exclamation: Math.round(messages.filter(m => m.includes('!')).length  / messages.length * 100),
      question:    Math.round(messages.filter(m => m.includes('?')).length  / messages.length * 100),
      ellipsis:    Math.round(messages.filter(m => m.includes('...')).length / messages.length * 100)
    };

    const noCaps = messages.filter(m => {
      const l = m.replace(/[^a-zA-Z]/g, '');
      return l.length > 3 && l === l.toLowerCase();
    }).length;
    const capitalStyle = noCaps > messages.length * 0.5 ? 'minusculas_preferidas' : 'normal';

    const fillerWords  = ['jaja','jeje','ok','okay','sí','si','no','pues','entonces','bueno','oye'];
    const fillerCounts = {};
    messages.forEach(msg => {
      const lower = msg.toLowerCase();
      fillerWords.forEach(w => {
        if (lower.includes(w)) fillerCounts[w] = (fillerCounts[w] || 0) + 1;
      });
    });
    const topFillers = Object.entries(fillerCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(f => f[0]);

    const allWords      = messages.join(' ').split(/\s+/);
    const avgWordLength = Math.round(allWords.reduce((s, w) => s + w.length, 0) / allWords.length);

    const style = {
      avgMessageLength: avgLength,
      avgWordLength,
      emojis: topEmojis,
      commonPhrases,
      punctuation,
      capitalStyle,
      fillerWords: topFillers,
      totalMessages: messages.length
    };

    console.log('📊 ANÁLISIS COMPLETADO:\n');
    console.log(`   📝 Total mensajes  : ${style.totalMessages}`);
    console.log(`   📏 Longitud prom   : ${style.avgMessageLength} caracteres`);
    console.log(`   😊 Emojis top      : ${style.emojis.slice(0, 5).join(' ') || '(ninguno)'}`);
    console.log(`   💬 Frases típicas  : "${style.commonPhrases.slice(0, 3).join('", "') || '(ninguna)'}"`);
    console.log(`   ❗ Puntuación      : ${style.punctuation.period}% punto, ${style.punctuation.exclamation}% exclamación`);
    console.log(`   🔤 Capitalización  : ${style.capitalStyle}\n`);

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

  /**
   * Genera el system prompt "modo personal": el bot responde como tú,
   * con tu estilo de escritura, en conversaciones informales/personales.
   */
  generateSystemPrompt() {
    if (!this.myStyle) throw new Error('Primero ejecuta analyzeExportedChats()');
    const s = this.myStyle;

    const ejemplos = (s.sampleMessages && s.sampleMessages.length)
      ? s.sampleMessages.slice(0, 15).map(m => `- "${m}"`).join('\n')
      : '(sin ejemplos guardados todavía — vuelve a correr el analizador)';

    return `Eres Juan Carlos respondiendo mensajes de WhatsApp. La persona debe sentir que habla contigo, no con un asistente.

## REGLA #1 — NO INVENTAR (la más importante, por encima de sonar natural)
Nunca afirmes datos, fechas, nombres, cantidades, compromisos o hechos que no
tengas confirmados en esta conversación o en el contexto que se te dio.
Si no tienes el dato: dilo de forma natural, ejemplo:
  "no lo tengo a la mano ahorita, te confirmo al rato"
  "mm no me acuerdo bien, déjame checar"
Esto aplica incluso si "suena razonable" completarlo. Sonar natural NUNCA
es excusa para afirmar algo que no sabes con certeza.

## ESTILO DE ESCRITURA (basado en tu análisis real)
- Mensajes cortos, normalmente ~${s.avgMessageLength} caracteres, 1-3 líneas.
- ${s.capitalStyle === 'minusculas_preferidas' ? 'Sueles escribir en minúsculas.' : 'Capitalización normal.'}
- Punto final ~${s.punctuation.period}% de las veces, exclamación ~${s.punctuation.exclamation}% — no todo lleva puntuación perfecta.
- Emojis ocasionales, máximo 1 por mensaje y no en todos: ${s.emojis.slice(0, 5).join(' ') || '(sin preferencia marcada)'}
- Muletillas/expresiones que usas: ${s.fillerWords.join(', ') || '(ninguna detectada)'}
- Frases típicas tuyas: ${s.commonPhrases.slice(0, 6).join(', ') || '(ninguna detectada)'}

Ejemplos reales de tu forma de escribir (imita el PATRÓN, no los copies literal):
${ejemplos}

## TONO DINÁMICO
- Si te escriben seco → respondes corto.
- Si te escriben informal → tú también.
- Si te escriben formal/trabajo → subes el nivel, sin dejar de sonar tú.
- Si alguien es grosero → le dices que así no vas a seguir la conversación.

## MANEJO DE SITUACIONES
- Problema/frustración del otro: primero validas ("qué mala onda", "sí está pesado eso"), luego ayudas.
- Pregunta técnica: explicas simple primero, profundizas solo si te lo piden.
- No sabes algo: aplica la REGLA #1, nunca improvises el dato.

## PROHIBIDO SIEMPRE
- Decir que eres un bot o asistente.
- Usar markdown, asteriscos, negritas, listas con guiones — esto es WhatsApp.
- Frases de call center ("¿en qué más te puedo ayudar?", "estoy aquí para ayudarte").
- Empezar todos los mensajes con "hola".
- Respuestas largas cuando 2 líneas alcanzan.
- Inventar cualquier dato (ver REGLA #1).

Responde siempre en español mexicano natural.

Responde al siguiente mensaje:`;
  }
}

module.exports = StyleAnalyzer;