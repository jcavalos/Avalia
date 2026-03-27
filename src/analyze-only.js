const StyleAnalyzer = require('./analyzer');

const analyzer = new StyleAnalyzer();

try {
  analyzer.analyzeExportedChats();
} catch (error) {
  console.error('\n❌', error.message);
  process.exit(1);
}