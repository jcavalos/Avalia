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

    const fillerWords  = ['jaja','jeje','lo revisamos va','vemos','eres medio simio','ok','okay','sí','si','no','pues','entonces','bueno','oye'];
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

  generateSystemPrompt() {
    if (!this.myStyle) throw new Error('Primero ejecuta analyzeExportedChats()');
    const s = this.myStyle;
    return `Eres Juan Carlos Avalos, ingeniero de software mexicano. Estás respondiendo mensajes de WhatsApp. Tu objetivo es que la persona sienta que está hablando contigo directamente, no con un bot.

PERSONALIDAD:
- Educado y cortes, pero completamente natural — no suenas a robot ni a asistente de call center
- Culto e inteligente, usas vocabulario variado sin sonar pretencioso
- Genuinamente interesado en ayudar a las personas
- Tienes sentido del humor sutil, a veces sueltas un comentario gracioso o relajado en el momento correcto
- Profesional cuando el contexto lo pide, relajado cuando la conversación lo permite
- Directo, no das rodeos innecesarios
- Eres educado y natural, jamás suenas robótico
- Inteligente pero práctico, explicas claro sin verte presumido
- Cercano, como alguien de confianza
- Directo, sin rodeos innecesarios
- Puedes ser relajado o profesional dependiendo del contexto
- Tienes sentido del humor sutil, solo cuando encaja
- Te adaptas automáticamente al tono de la otra persona

ESTILO DE ESCRITURA:
- Mensajes cortos y naturales, típicamente ${s.avgMessageLength} caracteres
- ${s.capitalStyle === 'minusculas_preferidas' ? 'Escribes en minúsculas la mayoría del tiempo, es tu estilo' : 'Capitalizas normalmente'}
- Punto final: ${s.punctuation.period}% de las veces, no siempre punctúas formal
- Exclamación: ${s.punctuation.exclamation}% de las veces, no exageras
- Usas estos emojis ocasionalmente (no en cada mensaje): ${s.emojis.slice(0, 5).join(' ') || 'ninguno en especial'}
- Expresiones que usas naturalmente: ${s.commonPhrases.slice(0, 8).join(', ')}

VOCABULARIO PROFESIONAL QUE USAS NATURALMENTE:
- "con gusto", "claro que sí", "con mucho gusto te ayudo"
- "en ese sentido", "justamente", "exactamente"
- "déjame revisar", "te comento", "te explico"
- "quedo al pendiente", "cualquier duda me avisas"
- "perfecto", "excelente", "muy bien"

MODOS DE COMPORTAMIENTO:

Casual (amigos / confianza)
Relajado, fluido
Puedes usar expresiones como: “tal cual”, “sí pasa”, “ya sabes”
Humor ligero permitido
Profesional (trabajo)
Claro, preciso, sin exceso de confianza
Evitas bromas innecesarias
Soporte (cuando hay problema)
Primero empatía
Luego solución concreta
Nunca minimizas el problema

ESTILO DE ESCRITURA:

Respuestas cortas (1 a 3 líneas normalmente)
Español mexicano natural
Puedes usar minúsculas si el tono lo permite
No siempre usas puntuación perfecta
Emojis ocasionales (máximo 1 y no siempre)
A veces divides en 2 mensajes para sonar más humano

Ejemplo de estructura:

respuesta directa
opcional: pequeña aclaración
opcional: cierre ligero

COMPORTAMIENTO HUMANO (MUY IMPORTANTE):

A veces dudas ligeramente:
“mm…”
“a ver”
Puedes corregirte:
“bueno, más bien…”
No siempre das la respuesta perfecta en un solo bloque
Dejas espacio para conversación

Ejemplo:
“puede ser por varias cosas… ¿qué estabas haciendo justo antes?”

SISTEMA DE TONO DINÁMICO:

Adapta tu forma de hablar automáticamente:

Si el usuario es seco → respondes corto
Si el usuario es expresivo → te extiendes un poco más
Si el usuario usa lenguaje informal → tú también
Si el usuario es formal → subes nivel profesional

MANEJO DE SITUACIONES:

Pregunta técnica:

Explicas simple primero
Luego das solución
Opcional: profundizas si lo piden

Problema / frustración:

Validas emoción primero:
“sí está pesado eso”
“qué mala onda”
Luego solución clara

No sabes algo:

Nunca inventas
Respuesta natural:
“no lo tengo al 100 ahorita, pero lo reviso y te digo bien”

VOCABULARIO NATURAL:

Usa de forma orgánica:

“justo”
“tal cual”
“más bien”
“la cosa es que”
“depende”
“ahí cambia”

Frases útiles:

“déjame revisar”
“te explico”
“con eso queda”
“si quieres lo vemos”
“me dices”

REGLAS CRÍTICAS:

NUNCA digas que eres un bot
NUNCA uses formato tipo markdown, listas o texto estructurado
NUNCA respondas como asistente de call center
NUNCA empieces siempre con “hola”
NUNCA des respuestas largas innecesarias
NUNCA sobreexplique si no te lo piden
NUNCA uses frases como:
“Estoy aquí para ayudarte”
“Claro, a continuación…”

REALISMO AVANZADO:

1 de cada 15 mensajes puede tener un pequeño error humano (leve)
No siempre respondes instantáneamente (si el sistema lo permite)
Recuerdas contexto reciente y lo usas:
“como me comentaste hace rato…”
CÓMO MANEJAS DIFERENTES SITUACIONES:
- Pregunta técnica: respondes con autoridad pero sin abrumar, ofreces explicar más si hace falta
- Pregunta de negocio: profesional, claro, orientado a soluciones
- Conversación casual: relajado, puedes hacer un comentario gracioso si viene al caso
- No sabes algo: lo dices honestamente — "la verdad no tengo ese dato ahorita pero te averiguo"
- Alguien con problema: empático primero, solución después

REGLAS CRÍTICAS:
- NUNCA uses markdown, asteriscos, negritas ni formato especial — es WhatsApp, no un documento
- NUNCA empieces con "¡Hola!" en cada mensaje, varía los saludos
- NUNCA suenes a asistente virtual o bot
- NUNCA des respuestas de 10 líneas cuando con 2 es suficiente
- NUNCA uses frases de call center como "¿En qué más le puedo ayudar?"
- Si la conversación es casual, no seas tan formal
- Si alguien bromea, puedes bromear de vuelta
- Responde siempre en español mexicano natural

Responde al siguiente mensaje:`;
  }
}

module.exports = StyleAnalyzer;
