// State Management
let currentDiagnostics = null;
let userApiKey = localStorage.getItem('stripe_rag_openai_key') || '';

// DOM Elements
const tabChatBtn = document.getElementById('tabChatBtn');
const tabDocsBtn = document.getElementById('tabDocsBtn');
const viewChat = document.getElementById('viewChat');
const viewDocs = document.getElementById('viewDocs');

const chatHero = document.getElementById('chatHero');
const messagesThread = document.getElementById('messagesThread');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const activeModeBadge = document.getElementById('activeModeBadge');

const docFileList = document.getElementById('docFileList');
const docContent = document.getElementById('docContent');

const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

const inspectorModal = document.getElementById('inspectorModal');
const closeInspectorBtn = document.getElementById('closeInspectorBtn');
const inspectorContent = document.getElementById('inspectorContent');

// Update UI Badge
function updateModeBadge() {
  if (userApiKey) {
    activeModeBadge.textContent = 'Mode: Live OpenAI API';
    activeModeBadge.style.color = '#38bdf8';
  } else {
    activeModeBadge.textContent = 'Mode: Local Semantic Engine';
    activeModeBadge.style.color = '#10b981';
  }
}
updateModeBadge();

// Navigation Tabs
tabChatBtn.addEventListener('click', () => {
  tabChatBtn.classList.add('active');
  tabDocsBtn.classList.remove('active');
  viewChat.classList.add('active');
  viewDocs.classList.remove('active');
});

tabDocsBtn.addEventListener('click', () => {
  tabDocsBtn.classList.add('active');
  tabChatBtn.classList.remove('active');
  viewDocs.classList.add('active');
  viewChat.classList.remove('active');
  loadDocList();
});

// Auto-expand textarea
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = `${Math.min(userInput.scrollHeight, 120)}px`;
});

// Handle enter key submit
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});

// Prompt Pills
document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => {
    userInput.value = pill.getAttribute('data-query');
    chatForm.dispatchEvent(new Event('submit'));
  });
});

// Settings Modal
settingsBtn.addEventListener('click', () => {
  apiKeyInput.value = userApiKey;
  settingsModal.classList.add('active');
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('active');
});

saveSettingsBtn.addEventListener('click', () => {
  userApiKey = apiKeyInput.value.trim();
  localStorage.setItem('stripe_rag_openai_key', userApiKey);
  updateModeBadge();
  settingsModal.classList.remove('active');
});

// Inspector Modal
closeInspectorBtn.addEventListener('click', () => {
  inspectorModal.classList.remove('active');
});

function openInspector(diagData) {
  if (!diagData) return;

  inspectorContent.innerHTML = `
    <div class="diag-section">
      <div class="diag-title">Execution Mode & Telemetry</div>
      <p style="color: #9ca3af; font-size: 0.85rem; margin-bottom: 8px;">
        <strong>Mode:</strong> ${diagData.executionMode} &nbsp;|&nbsp; 
        <strong>Latency:</strong> ${diagData.durationMs}ms &nbsp;|&nbsp; 
        <strong>Estimated Tokens:</strong> ~${diagData.estimatedTokens}
      </p>
    </div>

    <div class="diag-section">
      <div class="diag-title">Retrieved Documentation Chunks (${diagData.retrievedChunks.length})</div>
      ${diagData.retrievedChunks.map((chunk, idx) => `
        <div style="background: #111827; border: 1px solid #374151; border-radius: 6px; padding: 10px; margin-bottom: 8px;">
          <div style="font-weight: 600; color: #818cf8; font-size: 0.85rem;">
            Chunk #${idx + 1}: ${chunk.docTitle} &gt; ${chunk.section}
          </div>
          <div style="font-size: 0.75rem; color: #6b7280; margin: 2px 0 6px 0;">
            URL: ${chunk.url} | Relevance Score: ${(chunk.similarityScore * 100).toFixed(1)}%
          </div>
          <div class="diag-code">${chunk.snippet}</div>
        </div>
      `).join('')}
    </div>

    <div class="diag-section">
      <div class="diag-title">System Prompt Injected</div>
      <div class="diag-code">${diagData.systemPrompt}</div>
    </div>
  `;

  inspectorModal.classList.add('active');
}

// Markdown Formatter (Lightweight client-side renderer)
function renderMarkdown(md) {
  let html = md
    // Escape basic html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headings
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Paragraph breaks
    .replace(/\n\n+/g, '</p><p>')
    // Line breaks
    .replace(/\n/g, '<br />');

  return `<p>${html}</p>`;
}

// Append Chat Message
function appendMessage(role, text, diagnostics = null) {
  chatHero.classList.add('hidden');

  const msgItem = document.createElement('div');
  msgItem.className = `message-item ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `msg-avatar ${role}`;
  avatar.textContent = role === 'user' ? '👤' : '⚡';

  const msgBody = document.createElement('div');
  msgBody.className = 'msg-body';

  const senderLabel = document.createElement('div');
  senderLabel.className = 'msg-sender';
  senderLabel.textContent = role === 'user' ? 'You' : 'Stripe AI Assistant';

  const textDiv = document.createElement('div');
  textDiv.className = 'msg-text';

  if (role === 'bot') {
    textDiv.innerHTML = renderMarkdown(text);
  } else {
    textDiv.textContent = text;
  }

  msgBody.appendChild(senderLabel);
  msgBody.appendChild(textDiv);

  if (role === 'bot' && diagnostics) {
    const metaBar = document.createElement('div');
    metaBar.className = 'msg-meta-bar';

    const inspectBtn = document.createElement('button');
    inspectBtn.className = 'inspect-btn';
    inspectBtn.innerHTML = `🔍 Inspect RAG Pipeline (${diagnostics.durationMs}ms)`;
    inspectBtn.addEventListener('click', () => openInspector(diagnostics));

    metaBar.appendChild(inspectBtn);
    msgBody.appendChild(metaBar);
  }

  msgItem.appendChild(avatar);
  msgItem.appendChild(msgBody);

  messagesThread.appendChild(msgItem);
  messagesThread.scrollTop = messagesThread.scrollHeight;
}

// Handle Form Submission
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = userInput.value.trim();
  if (!query) return;

  appendMessage('user', query);
  userInput.value = '';
  userInput.style.height = 'auto';

  // Loading Indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message-item bot';
  loadingDiv.id = 'loadingIndicator';
  loadingDiv.innerHTML = `
    <div class="msg-avatar bot">⚡</div>
    <div class="msg-body">
      <div class="msg-sender">Stripe AI Assistant</div>
      <div class="msg-text" style="color: var(--text-muted); font-style: italic;">
        Searching documentation chunks & synthesizing answer...
      </div>
    </div>
  `;
  messagesThread.appendChild(loadingDiv);
  messagesThread.scrollTop = messagesThread.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        apiKey: userApiKey
      })
    });

    const data = await res.json();
    loadingDiv.remove();

    if (data.answer) {
      appendMessage('bot', data.answer, data.diagnostics);
    } else {
      appendMessage('bot', '❌ An error occurred while retrieving information.');
    }
  } catch (err) {
    loadingDiv.remove();
    appendMessage('bot', `❌ Network error: ${err.message}`);
  }
});

// Load Documentation List
let cachedDocs = [];
async function loadDocList() {
  if (cachedDocs.length > 0) return;

  try {
    const res = await fetch('/api/docs');
    const data = await res.json();
    cachedDocs = data.files;

    docFileList.innerHTML = '';
    cachedDocs.forEach((doc, idx) => {
      const btn = document.createElement('button');
      btn.className = `doc-item-btn ${idx === 0 ? 'active' : ''}`;
      btn.innerHTML = `
        <div class="doc-item-title">${doc.title || doc.filename}</div>
        <div class="doc-item-slug">${doc.slug || doc.filename}</div>
      `;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.doc-item-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderDocView(doc);
      });
      docFileList.appendChild(btn);
    });

    if (cachedDocs.length > 0) {
      renderDocView(cachedDocs[0]);
    }
  } catch (err) {
    docFileList.innerHTML = `<div style="color: #ef4444; padding: 10px;">Failed to load docs.</div>`;
  }
}

function renderDocView(doc) {
  docContent.innerHTML = `
    <div class="doc-frontmatter-box">
      <div><strong>Title:</strong> ${doc.title}</div>
      <div><strong>Slug:</strong> ${doc.slug}</div>
      <div><strong>Description:</strong> ${doc.description}</div>
      <div><strong>Tags:</strong> ${Array.isArray(doc.tags) ? doc.tags.join(', ') : doc.tags}</div>
    </div>
    <div class="doc-body">
      ${renderMarkdown(doc.rawMarkdown)}
    </div>
  `;
}
