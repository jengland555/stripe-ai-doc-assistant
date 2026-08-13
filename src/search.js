import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_PATH = path.join(__dirname, '../data/vector_store.json');

/**
 * Calculates Cosine Similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct;
}

/**
 * Vectorizes a raw search query against the stored vocabulary
 */
function vectorizeQuery(queryText, vocabulary) {
  const tokens = queryText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

  const termCounts = {};
  for (const token of tokens) {
    termCounts[token] = (termCounts[token] || 0) + 1;
  }

  // Synonym & semantic boosts for technical writing search terms
  const synonyms = {
    'auth': ['authentication', 'bearer', 'key', 'secret'],
    'login': ['authentication', 'keys', 'bearer'],
    'fail': ['decline', 'declined', 'error', 'failed'],
    'test': ['sandbox', 'testing', 'cards', '4242'],
    'refund': ['chargeback', 'dispute', 'reversal'],
    'webhook': ['events', 'signatures', 'whsec', 'signature'],
    'subscription': ['customers', 'reusable', 'off_session']
  };

  Object.entries(synonyms).forEach(([base, synList]) => {
    if (termCounts[base]) {
      synList.forEach(s => {
        termCounts[s] = (termCounts[s] || 0) + 0.8;
      });
    }
  });

  const vector = [];
  let sumSquares = 0;

  for (const term of vocabulary) {
    const count = termCounts[term] || 0;
    vector.push(count);
    sumSquares += count * count;
  }

  const magnitude = Math.sqrt(sumSquares) || 1;
  return vector.map(val => val / magnitude);
}

/**
 * Performs Semantic Search over the vector store
 * @param {string} query The user's question
 * @param {number} topK Number of chunks to retrieve (default: 3)
 */
export function searchDocumentation(query, topK = 3) {
  if (!fs.existsSync(STORE_PATH)) {
    throw new Error('Vector store not found. Please run "npm run index-docs" first.');
  }

  const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  const queryVector = vectorizeQuery(query, store.vocabulary);

  const scoredChunks = store.chunks.map(chunk => {
    const similarity = cosineSimilarity(queryVector, chunk.vector);
    return {
      id: chunk.id,
      docTitle: chunk.docTitle,
      section: chunk.section,
      url: chunk.url,
      filename: chunk.filename,
      text: chunk.text,
      similarityScore: parseFloat(similarity.toFixed(4))
    };
  });

  // Sort descending by similarity score
  scoredChunks.sort((a, b) => b.similarityScore - a.similarityScore);

  // Return Top-K results
  return {
    query,
    totalIndexedChunks: store.totalChunks,
    results: scoredChunks.slice(0, topK)
  };
}
