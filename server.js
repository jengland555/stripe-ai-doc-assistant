import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { buildIndex } from './src/indexer.js';
import { askDocumentationAssistant } from './src/rag.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Automatically ensure documentation vector index exists on boot
const vectorStorePath = path.join(__dirname, 'data/vector_store.json');
if (!fs.existsSync(vectorStorePath)) {
  console.log('📦 Vector store not found on boot. Building index from /docs...');
  buildIndex();
}

/**
 * Local Helper Routes (Loaded from resources/ if available locally)
 */
app.get('/encyclopedia', (req, res) => {
  const p = path.join(__dirname, 'resources/ai_docs_encyclopedia.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send('Resource moved or not found.');
});

app.get('/interview-guide', (req, res) => {
  const p = path.join(__dirname, 'resources/interview_talking_points.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send('Resource moved or not found.');
});

app.get('/resume', (req, res) => {
  const p = path.join(__dirname, 'resources/updated_resume.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send('Resource moved or not found.');
});

/**
 * API: Chat Assistant with RAG pipeline
 */
app.post('/api/chat', async (req, res) => {
  const { query, apiKey } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'A query string is required.' });
  }

  try {
    const result = await askDocumentationAssistant(query, apiKey);
    res.json(result);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * API: Get list and contents of all Documentation files
 */
app.get('/api/docs', (req, res) => {
  const docsDir = path.join(__dirname, 'docs');
  if (!fs.existsSync(docsDir)) {
    return res.json({ files: [] });
  }

  const fileNames = fs.readdirSync(docsDir).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
  const docs = fileNames.map(filename => {
    const filePath = path.join(docsDir, filename);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Parse simple frontmatter
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    let title = filename;
    let slug = '';
    let description = '';
    let tags = [];
    let rawMarkdown = content;

    if (match) {
      const rawYaml = match[1];
      rawMarkdown = match[2];

      rawYaml.split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx !== -1) {
          const k = line.slice(0, idx).trim();
          let v = line.slice(idx + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          if (k === 'title') title = v;
          if (k === 'slug') slug = v;
          if (k === 'description') description = v;
          if (k === 'tags') {
            try { tags = JSON.parse(v); } catch { tags = [v]; }
          }
        }
      });
    }

    return {
      filename,
      title,
      slug,
      description,
      tags,
      rawMarkdown
    };
  });

  res.json({ files: docs });
});

/**
 * API: Reindex Docs
 */
app.post('/api/reindex', (req, res) => {
  const store = buildIndex();
  res.json({ message: 'Indexing complete', totalChunks: store.totalChunks });
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Stripe AI Documentation Assistant is running!`);
  console.log(`🌐 Web App:         http://localhost:${PORT}`);
  console.log(`🎓 Encyclopedia:    http://localhost:${PORT}/encyclopedia`);
  console.log(`======================================================\n`);
});
