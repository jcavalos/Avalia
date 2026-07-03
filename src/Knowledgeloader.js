const fs   = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const config = require('./config');

/**
 * KnowledgeLoader
 * Lee PDFs (libros, manuales, documentos de trabajo) desde una carpeta,
 * extrae su texto, lo divide en fragmentos ("chunks") y permite buscar
 * los fragmentos relevantes a una pregunta para inyectarlos en el prompt.
 *
 * Es RAG básico por palabras clave (sin embeddings/vector DB). Suficiente
 * para empezar con decenas de documentos. Si algún día tienes cientos de
 * PDFs y la búsqueda por keyword se queda corta, se migra a una base
 * vectorial (Chroma/Pinecone/Supabase) sin cambiar cómo se usa este módulo
 * desde el resto del bot — solo cambiaría _findRelevantChunks internamente.
 *
 * Estructura esperada:
 *   config.PATHS.DOCS   -> carpeta con tus .pdf (libros, manuales, contratos, etc.)
 *   config.PATHS.CACHE  -> donde se guarda el texto ya extraído (para no
 *                          reprocesar los PDFs cada vez que arranca el bot)
 */
class KnowledgeLoader {
  constructor() {
    this.chunks = []; // [{ source, chunkIndex, text }]
  }

  /**
   * Extrae y cachea el texto de todos los PDFs nuevos o modificados.
   * Si ya existe cache y los PDFs no cambiaron, usa el cache (rápido).
   */
  async loadDocuments({ chunkSize = 1200, forceReload = false } = {}) {
    const docsPath  = config.PATHS.DOCS;
    const cachePath = config.PATHS.CACHE;

    if (!fs.existsSync(docsPath)) {
      fs.mkdirSync(docsPath, { recursive: true });
      throw new Error(`📁 Carpeta creada: ${docsPath}\n   Coloca ahí tus PDFs (libros, manuales, docs de trabajo).`);
    }

    if (!fs.existsSync(cachePath)) fs.mkdirSync(cachePath, { recursive: true });

    const pdfFiles = fs.readdirSync(docsPath).filter(f => f.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      throw new Error(`📁 No hay PDFs en: ${docsPath}\n   Agrega al menos un archivo .pdf.`);
    }

    console.log(`📚 Procesando ${pdfFiles.length} documento(s)...\n`);
    this.chunks = [];

    for (const file of pdfFiles) {
      const pdfPath   = path.join(docsPath, file);
      const cacheFile = path.join(cachePath, file.replace(/\.pdf$/i, '.json'));

      const pdfStat = fs.statSync(pdfPath);
      const useCache = !forceReload
        && fs.existsSync(cacheFile)
        && fs.statSync(cacheFile).mtimeMs > pdfStat.mtimeMs;

      let text;
      if (useCache) {
        console.log(`   ⚡ ${file} (desde cache)`);
        text = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')).text;
      } else {
        console.log(`   📄 ${file} (extrayendo texto...)`);
        const buffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(buffer);
        text = data.text;
        fs.writeFileSync(cacheFile, JSON.stringify({ text, extractedAt: new Date().toISOString() }));
      }

      const fileChunks = this._chunkText(text, chunkSize);
      fileChunks.forEach((chunkText, i) => {
        this.chunks.push({ source: file, chunkIndex: i, text: chunkText });
      });
    }

    console.log(`\n✅ ${this.chunks.length} fragmentos listos de ${pdfFiles.length} documento(s)\n`);
    return this.chunks;
  }

  _chunkText(text, chunkSize) {
    // Limpia espacios/saltos de línea excesivos que deja pdf-parse
    const clean = text.replace(/\s+/g, ' ').trim();

    // Divide por oraciones para no cortar a la mitad de una idea,
    // y va agrupando hasta llegar al tamaño de chunk deseado.
    const sentences = clean.split(/(?<=[.?!])\s+/);
    const chunks = [];
    let current = '';

    for (const sentence of sentences) {
      if ((current + ' ' + sentence).length > chunkSize && current.length > 0) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current += (current ? ' ' : '') + sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());

    return chunks;
  }

  /**
   * Busca los fragmentos más relevantes a una pregunta usando coincidencia
   * de palabras (simple pero efectivo para empezar).
   */
  findRelevantChunks(query, maxChunks = 4) {
    const queryWords = query
      .toLowerCase()
      .replace(/[^\wáéíóúñü\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3); // ignora palabras muy cortas (el, de, que...)

    if (queryWords.length === 0) return [];

    const scored = this.chunks.map(chunk => {
      const chunkLower = chunk.text.toLowerCase();
      const score = queryWords.reduce((acc, w) => acc + (chunkLower.includes(w) ? 1 : 0), 0);
      return { chunk, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxChunks)
      .map(s => s.chunk);
  }

  /**
   * Genera el bloque de texto para inyectar en el system prompt con
   * el conocimiento relevante a la pregunta actual.
   */
  generateContextBlock(query, maxChunks = 4) {
    const relevant = this.findRelevantChunks(query, maxChunks);

    if (relevant.length === 0) {
      return 'NO SE ENCONTRÓ INFORMACIÓN RELACIONADA EN TUS DOCUMENTOS.';
    }

    return relevant
      .map(c => `[Fuente: ${c.source}]\n${c.text}`)
      .join('\n\n---\n\n');
  }
}

module.exports = KnowledgeLoader;