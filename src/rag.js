import { searchDocumentation } from './search.js';

/**
 * The Technical Writer's Master System Prompt
 */
export const SYSTEM_PROMPT = `You are the official, AI-powered Stripe Documentation Assistant.
Your mission is to provide accurate, concise, and developer-friendly answers based EXCLUSIVELY on the provided documentation context.

Operational Guidelines:
1. Grounded Answers: Answer ONLY using the provided documentation snippets. Do not make assumptions or invent API parameters.
2. Handling Unknowns: If the answer is not present in the context, state clearly: "I cannot find specific instructions for that in the current documentation."
3. Source Citations: Always append relevant Markdown links to the official documentation sections provided in the context.
4. Code Snippets: When providing code examples, use proper Markdown syntax highlighting (e.g. bash, javascript, python).
5. Tone: Clear, professional, developer-focused, and concise.`;

/**
 * Formats the full RAG prompt payload
 */
function buildRagPrompt(query, retrievedChunks) {
  let contextBlock = retrievedChunks
    .map((chunk, index) => {
      return `--- DOCUMENT SNIPPET ${index + 1} ---
Source: ${chunk.docTitle} > ${chunk.section}
URL: ${chunk.url}
Content:
${chunk.text}`;
    })
    .join('\n\n');

  return {
    system: SYSTEM_PROMPT,
    userPrompt: `DOCUMENTATION CONTEXT:
${contextBlock}

USER QUESTION:
${query}

Please answer the question based strictly on the documentation context above. Include source links at the end.`
  };
}

/**
 * Intelligent local response synthesizer for offline exploration and demo mode
 */
function synthesizeLocalResponse(query, retrievedChunks) {
  if (!retrievedChunks || retrievedChunks.length === 0 || retrievedChunks[0].similarityScore < 0.05) {
    return {
      answer: `I could not find specific instructions for "${query}" in the current Stripe documentation set. 

Please try searching for topics like:
- **API Authentication** (Secret & Publishable Keys)
- **Payment Intents** (Lifecycle & 3D Secure)
- **Webhooks** (Signature verification & Events)
- **Refunds & Disputes**
- **Test Cards & Sandboxes**`,
      sources: []
    };
  }

  const topChunk = retrievedChunks[0];
  const secondChunk = retrievedChunks[1];

  // Extract relevant lines and code blocks
  const codeBlockMatch = topChunk.text.match(/```[\s\S]*?```/);
  const codeSnippet = codeBlockMatch ? codeBlockMatch[0] : null;

  // Clean summary text from chunk
  const paragraphs = topChunk.text
    .split('\n\n')
    .filter(p => !p.startsWith('#') && !p.startsWith('```') && p.length > 30);

  const mainExplanation = paragraphs.slice(0, 2).join('\n\n') || topChunk.text.slice(0, 300);

  let formattedAnswer = `Based on the **${topChunk.docTitle}** documentation:

${mainExplanation}
`;

  if (codeSnippet) {
    formattedAnswer += `\n### Code Example\n${codeSnippet}\n`;
  }

  if (secondChunk && secondChunk.similarityScore > 0.15 && secondChunk.docTitle !== topChunk.docTitle) {
    const secondPara = secondChunk.text
      .split('\n\n')
      .find(p => !p.startsWith('#') && !p.startsWith('```') && p.length > 30);
    if (secondPara) {
      formattedAnswer += `\n### Related Info (${secondChunk.docTitle})\n${secondPara}\n`;
    }
  }

  formattedAnswer += `\n\n**Official Documentation Sources:**\n`;
  const sources = [];
  retrievedChunks.forEach(chunk => {
    if (chunk.similarityScore > 0.1) {
      formattedAnswer += `- [${chunk.docTitle} - ${chunk.section}](${chunk.url}) (Relevance: ${(chunk.similarityScore * 100).toFixed(0)}%)\n`;
      sources.push({
        title: `${chunk.docTitle} (${chunk.section})`,
        url: chunk.url,
        score: chunk.similarityScore,
        chunkId: chunk.id
      });
    }
  });

  return {
    answer: formattedAnswer,
    sources
  };
}

/**
 * Main RAG Execution Handler
 */
export async function askDocumentationAssistant(query, apiKey = process.env.OPENAI_API_KEY) {
  const startTime = Date.now();

  // 1. Retrieve most relevant chunks via semantic search
  const searchResult = searchDocumentation(query, 3);
  const retrievedChunks = searchResult.results;

  // 2. Build RAG Prompt payload
  const promptPayload = buildRagPrompt(query, retrievedChunks);

  let answerText = '';
  let sources = [];
  let executionMode = 'local-synthesizer';

  // 3. If OpenAI API key is provided, execute live LLM call
  if (apiKey && apiKey.startsWith('sk-')) {
    try {
      executionMode = 'openai-api';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: promptPayload.system },
            { role: 'user', content: promptPayload.userPrompt }
          ],
          temperature: 0.2
        })
      });

      const data = await response.json();
      if (data.choices && data.choices[0]) {
        answerText = data.choices[0].message.content;
        sources = retrievedChunks.map(c => ({
          title: `${c.docTitle} (${c.section})`,
          url: c.url,
          score: c.similarityScore,
          chunkId: c.id
        }));
      } else {
        throw new Error(data.error?.message || 'OpenAI request failed');
      }
    } catch (err) {
      console.warn(`OpenAI call fallback to local synthesizer: ${err.message}`);
      const localRes = synthesizeLocalResponse(query, retrievedChunks);
      answerText = localRes.answer;
      sources = localRes.sources;
      executionMode = 'local-fallback';
    }
  } else {
    // 4. Offline / Built-in high-accuracy local synthesis
    const localRes = synthesizeLocalResponse(query, retrievedChunks);
    answerText = localRes.answer;
    sources = localRes.sources;
  }

  const durationMs = Date.now() - startTime;
  const estimatedTokens = Math.round((promptPayload.system.length + promptPayload.userPrompt.length + answerText.length) / 4);

  return {
    query,
    answer: answerText,
    sources,
    diagnostics: {
      executionMode,
      durationMs,
      estimatedTokens,
      retrievedChunksCount: retrievedChunks.length,
      topSimilarityScore: retrievedChunks[0]?.similarityScore || 0,
      retrievedChunks: retrievedChunks.map(c => ({
        id: c.id,
        docTitle: c.docTitle,
        section: c.section,
        url: c.url,
        similarityScore: c.similarityScore,
        snippet: c.text.slice(0, 180) + '...'
      })),
      systemPrompt: SYSTEM_PROMPT
    }
  };
}
