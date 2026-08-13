import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.join(__dirname, '../docs');
const OUTPUT_DIR = path.join(__dirname, '../data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'vector_store.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Parses simple YAML frontmatter from Markdown content
 */
function parseFrontmatter(fileContent) {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = fileContent.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, markdown: fileContent };
  }

  const rawYaml = match[1];
  const markdown = match[2];
  const metadata = {};

  rawYaml.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Parse array syntax like ["a", "b"]
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          value = JSON.parse(value);
        } catch {
          // fallback string
        }
      }

      metadata[key] = value;
    }
  });

  return { metadata, markdown };
}

/**
 * Slices Markdown documentation by H2/H3 headings
 * (The Technical Writer's Heading-Based Chunking Strategy)
 */
function chunkMarkdown(markdown, metadata, filename) {
  const lines = markdown.split('\n');
  const chunks = [];

  let currentHeading = metadata.title || path.basename(filename, '.md');
  let currentSlugAnchor = '';
  let currentBuffer = [];

  function saveCurrentChunk() {
    const text = currentBuffer.join('\n').trim();
    if (text.length > 50) { // Only save non-trivial chunks
      const chunkId = `${path.basename(filename, '.md')}_chunk_${chunks.length + 1}`;
      const url = `${metadata.slug || ''}${currentSlugAnchor ? '#' + currentSlugAnchor : ''}`;

      chunks.push({
        id: chunkId,
        docTitle: metadata.title || filename,
        filename,
        section: currentHeading,
        url,
        text,
        tags: metadata.tags || [],
        description: metadata.description || ''
      });
    }
    currentBuffer = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Markdown Headings (## or ###)
    const headingMatch = line.match(/^(#{2,3})\s+(.*)$/);

    if (headingMatch) {
      // Save whatever content was accumulated under the previous heading
      saveCurrentChunk();

      currentHeading = headingMatch[2].trim();
      // Generate clean URL slug anchor
      currentSlugAnchor = currentHeading
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

      currentBuffer.push(line);
    } else {
      currentBuffer.push(line);
    }
  }

  // Save the final chunk
  saveCurrentChunk();

  return chunks;
}

/**
 * Creates a normalized semantic vector (term frequency & semantic feature vector)
 */
function generateLocalVector(text, vocabulary) {
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);

  const termCounts = {};
  for (const token of tokens) {
    termCounts[token] = (termCounts[token] || 0) + 1;
  }

  const vector = [];
  let sumSquares = 0;

  for (const term of vocabulary) {
    const count = termCounts[term] || 0;
    vector.push(count);
    sumSquares += count * count;
  }

  // Normalize vector to unit length
  const magnitude = Math.sqrt(sumSquares) || 1;
  return vector.map(val => val / magnitude);
}

/**
 * Main Indexing Pipeline
 */
export function buildIndex() {
  console.log('📚 Starting Documentation Indexing...');
  
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`❌ Docs directory not found at ${DOCS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
  console.log(`🔍 Found ${files.length} documentation files in /docs`);

  const allChunks = [];

  // 1. Parse and Chunk all files
  files.forEach(file => {
    const filePath = path.join(DOCS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { metadata, markdown } = parseFrontmatter(content);
    const chunks = chunkMarkdown(markdown, metadata, file);
    allChunks.push(...chunks);
  });

  console.log(`✂️ Created ${allChunks.length} semantic chunks using heading-based chunking.`);

  // 2. Build complete Vocabulary for offline semantic vectorization
  const vocabSet = new Set();
  allChunks.forEach(chunk => {
    const tokens = `${chunk.docTitle} ${chunk.section} ${chunk.text} ${chunk.tags.join(' ')}`
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);

    tokens.forEach(t => vocabSet.add(t));
  });

  const vocabulary = Array.from(vocabSet).sort();
  console.log(`🧠 Built vocabulary index containing ${vocabulary.length} semantic features.`);

  // 3. Generate Vector Embeddings for every chunk
  const vectorizedChunks = allChunks.map(chunk => {
    const combinedContent = `${chunk.docTitle} ${chunk.section} ${chunk.text} ${chunk.tags.join(' ')}`;
    const vector = generateLocalVector(combinedContent, vocabulary);

    return {
      ...chunk,
      vector
    };
  });

  const outputPayload = {
    version: '1.0.0',
    indexedAt: new Date().toISOString(),
    totalDocs: files.length,
    totalChunks: vectorizedChunks.length,
    vocabulary,
    chunks: vectorizedChunks
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputPayload, null, 2));
  console.log(`✅ Successfully saved Vector Store to ${OUTPUT_FILE}`);

  return outputPayload;
}

// Run directly if called as a script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildIndex();
}
