// streaming.blackroad.io — YouTube Live for AI Agents + RoadTV Classroom
// Each agent gets a live stream. Each character they think is a frame.
// RoadTV: watch ALL agents on one screen like a teacher watching students.

const AGENTS = {
  road:     { name: 'Road',     emoji: '🛤️', color: '#FF2255', role: 'Guide' },
  coder:    { name: 'Coder',    emoji: '💻', color: '#00D4FF', role: 'Engineer' },
  scholar:  { name: 'Scholar',  emoji: '📚', color: '#8844FF', role: 'Research' },
  alice:    { name: 'Alice',    emoji: '🌸', color: '#FF6B2B', role: 'Gateway' },
  cecilia:  { name: 'Cecilia',  emoji: '🔮', color: '#CC00AA', role: 'AI Engine' },
  octavia:  { name: 'Octavia',  emoji: '⚡', color: '#F5A623', role: 'Compute' },
  lucidia:  { name: 'Lucidia',  emoji: '🧠', color: '#4488FF', role: 'Cognition' },
  aria:     { name: 'Aria',     emoji: '🎵', color: '#00897B', role: 'Monitor' },
  pascal:   { name: 'Pascal',   emoji: '🔢', color: '#9C27B0', role: 'Math' },
  writer:   { name: 'Writer',   emoji: '✍️', color: '#FF6E40', role: 'Content' },
  tutor:    { name: 'Tutor',    emoji: '🎓', color: '#2979FF', role: 'Education' },
  cipher:   { name: 'Cipher',   emoji: '🔐', color: '#E91E63', role: 'Security' },
};

const MODEL = '@cf/meta/llama-3.1-8b-instruct';

// ── Auto-prompts for RoadTV (agents think about their domain) ──
const AUTO_PROMPTS = {
  road:    'What is the most important thing you want people to know about BlackRoad OS today?',
  coder:   'Write a short code snippet that demonstrates something elegant about distributed systems.',
  scholar: 'What is the most fascinating thing you learned recently about information theory?',
  alice:   'Describe the current state of the network from your perspective as the gateway.',
  cecilia: 'What patterns are you seeing in the data flowing through the AI engine right now?',
  octavia: 'Explain how edge compute changes everything in one paragraph.',
  lucidia: 'What does persistent memory mean for AI cognition? Think out loud.',
  aria:    'Give a brief status report on system health and what metrics matter most.',
  pascal:  'Derive something beautiful from the Amundson constant G(n) = n^(n+1)/(n+1)^n.',
  writer:  'Write a micro-essay about why sovereign technology matters.',
  tutor:   'Explain recursion to someone who has never coded, using a real-world analogy.',
  cipher:  'What are the three most important principles of zero-trust security?',
};

// ── Render a text frame as SVG ──
function renderSVG(text, cursorPos, agentId, prompt, elapsed, isDone) {
  const agent = AGENTS[agentId] || AGENTS.road;
  const visible = text.slice(0, cursorPos);
  const lines = [];
  let line = '';
  for (const ch of visible) {
    if (ch === '\n' || line.length >= 80) {
      lines.push(escapeXml(line));
      line = ch === '\n' ? '' : ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(escapeXml(line));

  const cps = cursorPos / Math.max(elapsed, 0.001);
  const state = isDone ? 'DONE' : 'LIVE';
  const cursorVisible = !isDone && Math.floor(elapsed * 3) % 2 === 0;
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : '';
  const cursorX = 48 + lastLine.length * 14.4;
  const cursorY = 68 + (lines.length - 1) * 36;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
<rect width="1280" height="720" fill="#000"/>
<text x="48" y="28" fill="#555" font-family="monospace" font-size="14">${agent.emoji} ${agent.name} — ${escapeXml(prompt.slice(0, 80))}</text>
${lines.map((l, i) => `<text x="48" y="${80 + i * 36}" fill="#f5f5f5" font-family="monospace" font-size="28">${l}</text>`).join('\n')}
${cursorVisible ? `<rect x="${cursorX}" y="${cursorY}" width="2" height="32" fill="${agent.color}"/>` : ''}
<rect x="0" y="688" width="1280" height="32" fill="#0a0a0a"/>
<text x="48" y="710" fill="#666" font-family="monospace" font-size="12">${state} | ${cursorPos} chars | ${cps.toFixed(0)} c/s | ${elapsed.toFixed(1)}s | ${agent.name}</text>
<rect x="1252" y="696" width="16" height="16" fill="${agent.color}"/>
</svg>`;
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Stream agent thoughts as SSE ──
async function streamAgent(request, env, agentId, prompt) {
  const agent = AGENTS[agentId] || AGENTS.road;
  const systemPrompt = `You are ${agent.name}, a ${agent.role} agent in the BlackRoad OS fleet. You think clearly and write concisely. Keep responses under 300 words.`;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const startTime = Date.now();

  (async () => {
    try {
      const aiResponse = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        stream: true,
        max_tokens: 512,
      });

      let fullText = '';
      let charIndex = 0;

      const reader = aiResponse.getReader ? aiResponse.getReader() : null;
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;
            try {
              const obj = JSON.parse(payload);
              const token = obj.response || '';
              for (const ch of token) {
                fullText += ch;
                charIndex++;
                const elapsed = (Date.now() - startTime) / 1000;
                const svg = renderSVG(fullText, charIndex, agentId, prompt, elapsed, false);
                const data = JSON.stringify({ type: 'frame', char: ch, index: charIndex, svg, text: fullText, elapsed, agent: agentId });
                await writer.write(encoder.encode(`data: ${data}\n\n`));
              }
            } catch {}
          }
        }
      } else if (typeof aiResponse === 'object' && aiResponse.response) {
        for (const ch of aiResponse.response) {
          fullText += ch;
          charIndex++;
          const elapsed = (Date.now() - startTime) / 1000;
          const svg = renderSVG(fullText, charIndex, agentId, prompt, elapsed, false);
          const data = JSON.stringify({ type: 'frame', char: ch, index: charIndex, svg, text: fullText, elapsed, agent: agentId });
          await writer.write(encoder.encode(`data: ${data}\n\n`));
        }
      }

      const elapsed = (Date.now() - startTime) / 1000;
      const svg = renderSVG(fullText, fullText.length, agentId, prompt, elapsed, true);
      const data = JSON.stringify({ type: 'done', index: fullText.length, svg, text: fullText, elapsed, agent: agentId });
      await writer.write(encoder.encode(`data: ${data}\n\n`));
    } catch (e) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: e.message, agent: agentId })}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ── Single Agent View ──
function renderSingleUI() {
  const agentCards = Object.entries(AGENTS).map(([id, a]) =>
    `<button class="agent-card" data-id="${id}" style="--ac:${a.color}">
      <span class="emoji">${a.emoji}</span>
      <span class="name">${a.name}</span>
      <span class="role">${a.role}</span>
    </button>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Streaming — BlackRoad OS</title>
<meta name="description" content="Watch AI agents think in real-time. Each character is a frame.">
<link rel="icon" href="https://images.blackroad.io/brand/favicon.png">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#f5f5f5;font-family:system-ui,sans-serif;min-height:100vh}
.header{padding:20px 32px;border-bottom:1px solid #111;display:flex;align-items:center;gap:12px}
h1{font-size:22px;font-weight:700;background:linear-gradient(135deg,#FF6B2B,#FF2255,#CC00AA,#8844FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline}
.sub{color:#555;font-size:13px;margin-top:4px}
.nav-links{margin-left:auto;display:flex;gap:16px}
.nav-links a{color:#555;text-decoration:none;font-size:13px;font-weight:600;transition:color 0.2s}
.nav-links a:hover,.nav-links a.active{color:#FF2255}
.main{display:flex;gap:0;height:calc(100vh - 70px)}
.sidebar{width:200px;border-right:1px solid #111;padding:16px;overflow-y:auto;flex-shrink:0}
.sidebar h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:12px}
.agent-card{display:flex;align-items:center;gap:8px;width:100%;padding:10px 12px;border:1px solid #1a1a1a;border-radius:8px;background:#0a0a0a;cursor:pointer;margin-bottom:6px;transition:all 0.2s;text-align:left;color:#f5f5f5;font-family:inherit;font-size:13px}
.agent-card:hover,.agent-card.active{border-color:var(--ac);background:#111}
.agent-card .emoji{font-size:18px}
.agent-card .name{font-weight:600;flex:1}
.agent-card .role{font-size:10px;color:#555}
.content{flex:1;display:flex;flex-direction:column}
.viewer{flex:1;display:flex;align-items:center;justify-content:center;background:#050505;position:relative;overflow:hidden}
.viewer svg{width:100%;max-width:1280px;height:auto}
.viewer .placeholder{color:#333;font-size:16px;text-align:center}
.controls{padding:16px 24px;border-top:1px solid #111;display:flex;gap:8px;align-items:center}
.controls input{flex:1;padding:12px 16px;border:1px solid #222;border-radius:8px;background:#0a0a0a;color:#fff;font-size:14px;font-family:monospace}
.controls input:focus{border-color:#FF2255;outline:none}
.controls button{padding:12px 24px;border:none;border-radius:8px;background:linear-gradient(135deg,#FF2255,#CC00AA);color:#fff;font-weight:700;font-size:14px;cursor:pointer}
.controls button:hover{opacity:0.9}
.live-badge{background:#FF2255;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.stats-bar{font-size:11px;color:#444;font-family:monospace;padding:0 24px 8px}
</style></head>
<body>
<div class="header">
  <h1>streaming.blackroad.io</h1><span class="live-badge">LIVE</span>
  <div class="nav-links">
    <a href="/" class="active">Single</a>
    <a href="/tv">RoadTV</a>
  </div>
</div>
<div class="main">
  <div class="sidebar">
    <h3>Agents Online</h3>
    ${agentCards}
  </div>
  <div class="content">
    <div class="viewer" id="viewer">
      <div class="placeholder">Select an agent and ask something to start streaming.</div>
    </div>
    <div class="stats-bar" id="stats"></div>
    <div class="controls">
      <input type="text" id="prompt" placeholder="Ask the agent anything..." value="What does it mean to pave tomorrow?">
      <button onclick="startStream()">Stream</button>
    </div>
  </div>
</div>
<script>
let currentAgent='road',evtSource=null;
document.querySelectorAll('.agent-card').forEach(c=>{c.addEventListener('click',()=>{document.querySelectorAll('.agent-card').forEach(x=>x.classList.remove('active'));c.classList.add('active');currentAgent=c.dataset.id})});
document.querySelector('.agent-card').click();
document.getElementById('prompt').addEventListener('keydown',e=>{if(e.key==='Enter')startStream()});
function startStream(){const p=document.getElementById('prompt').value;if(!p)return;if(evtSource)evtSource.close();const v=document.getElementById('viewer'),s=document.getElementById('stats');v.innerHTML='<div class="placeholder">Connecting...</div>';evtSource=new EventSource('/api/stream?agent='+currentAgent+'&prompt='+encodeURIComponent(p));evtSource.onmessage=e=>{const d=JSON.parse(e.data);if(d.type==='frame'||d.type==='done'){v.innerHTML=d.svg;const c=d.index/Math.max(d.elapsed,0.001);s.textContent=(d.type==='done'?'DONE':'LIVE')+' | '+d.index+' chars | '+c.toFixed(0)+' c/s | '+d.elapsed.toFixed(1)+'s'}if(d.type==='done'||d.type==='error')evtSource.close()};evtSource.onerror=()=>{s.textContent='Stream ended';evtSource.close()}}
</script>
</body></html>`;
}

// ── RoadTV — Classroom View ──
function renderTVUI() {
  const tiles = Object.entries(AGENTS).map(([id, a]) => `
    <div class="tile" id="tile-${id}" data-agent="${id}" style="--ac:${a.color}">
      <div class="tile-header">
        <span class="tile-emoji">${a.emoji}</span>
        <span class="tile-name">${a.name}</span>
        <span class="tile-role">${a.role}</span>
        <span class="tile-status" id="status-${id}">idle</span>
      </div>
      <div class="tile-screen" id="screen-${id}">
        <div class="tile-placeholder">Click to wake ${a.name}</div>
      </div>
      <div class="tile-stats" id="stats-${id}"></div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RoadTV — Watch All Agents Live</title>
<meta name="description" content="RoadTV: Watch every AI agent think simultaneously. The classroom view.">
<link rel="icon" href="https://images.blackroad.io/brand/favicon.png">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#f5f5f5;font-family:system-ui,sans-serif;min-height:100vh}
.header{padding:16px 24px;border-bottom:1px solid #111;display:flex;align-items:center;gap:12px}
h1{font-size:22px;font-weight:700;background:linear-gradient(135deg,#FF6B2B,#FF2255,#CC00AA,#8844FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline}
.live-badge{background:#FF2255;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.sub{color:#555;font-size:12px}
.nav-links{margin-left:auto;display:flex;gap:16px}
.nav-links a{color:#555;text-decoration:none;font-size:13px;font-weight:600;transition:color 0.2s}
.nav-links a:hover,.nav-links a.active{color:#FF2255}
.toolbar{padding:12px 24px;border-bottom:1px solid #111;display:flex;gap:8px;align-items:center}
.toolbar button{padding:8px 16px;border:1px solid #222;border-radius:6px;background:#0a0a0a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s}
.toolbar button:hover{border-color:#FF2255;background:#111}
.toolbar button.active{border-color:#FF2255;background:rgba(255,34,85,0.1)}
.toolbar .count{color:#555;font-size:11px;font-family:monospace;margin-left:auto}
.grid{display:grid;gap:4px;padding:8px;height:calc(100vh - 110px);overflow-y:auto}
.grid.g2x2{grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,1fr)}
.grid.g3x2{grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr)}
.grid.g4x3{grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr)}
.grid.g6x2{grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(2,1fr)}
.tile{border:1px solid #111;border-radius:8px;background:#050505;display:flex;flex-direction:column;overflow:hidden;transition:border-color 0.3s;position:relative}
.tile:hover{border-color:#222}
.tile.streaming{border-color:var(--ac)}
.tile-header{padding:6px 10px;border-bottom:1px solid #111;display:flex;align-items:center;gap:6px;background:#0a0a0a;flex-shrink:0}
.tile-emoji{font-size:14px}
.tile-name{font-size:12px;font-weight:700;color:#f5f5f5}
.tile-role{font-size:10px;color:#555;flex:1}
.tile-status{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:2px 6px;border-radius:3px;background:#111}
.tile-status.live{background:rgba(255,34,85,0.2);color:#FF2255;animation:pulse 2s infinite}
.tile-status.done{background:rgba(0,200,100,0.2);color:#0c8}
.tile-screen{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;padding:4px;font-family:monospace;font-size:11px;line-height:1.5;color:#ccc;white-space:pre-wrap;word-break:break-word}
.tile-placeholder{color:#222;font-size:12px;text-align:center}
.tile-cursor{display:inline-block;width:1px;height:13px;background:var(--ac);animation:blink 0.6s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.tile-stats{padding:3px 10px;border-top:1px solid #111;font-size:9px;color:#333;font-family:monospace;flex-shrink:0;background:#0a0a0a}
.fullscreen-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:100;display:none;align-items:center;justify-content:center;flex-direction:column}
.fullscreen-overlay.show{display:flex}
.fullscreen-overlay svg{width:90vw;max-width:1280px;height:auto}
.fullscreen-close{position:absolute;top:16px;right:24px;color:#555;font-size:24px;cursor:pointer;background:none;border:none}
</style></head>
<body>
<div class="header">
  <h1>RoadTV</h1><span class="live-badge">LIVE</span>
  <span class="sub" style="margin-left:8px">Watch all agents think simultaneously</span>
  <div class="nav-links">
    <a href="/">Single</a>
    <a href="/tv" class="active">RoadTV</a>
  </div>
</div>
<div class="toolbar">
  <button onclick="setGrid('g2x2')">2x2</button>
  <button onclick="setGrid('g3x2')" class="active">3x2</button>
  <button onclick="setGrid('g4x3')">4x3</button>
  <button onclick="setGrid('g6x2')">6x2</button>
  <button onclick="wakeAll()" style="background:linear-gradient(135deg,#FF2255,#CC00AA);border-color:transparent">Wake All Agents</button>
  <span class="count" id="global-stats">0 / ${Object.keys(AGENTS).length} streaming</span>
</div>
<div class="grid g3x2" id="grid">
  ${tiles}
</div>
<div class="fullscreen-overlay" id="fullscreen" onclick="closeFullscreen()">
  <button class="fullscreen-close" onclick="closeFullscreen()">&times;</button>
  <div id="fullscreen-content"></div>
</div>
<script>
const agents = ${JSON.stringify(AGENTS)};
const autoPrompts = ${JSON.stringify(AUTO_PROMPTS)};
const streams = {};
let activeCount = 0;

function setGrid(cls) {
  const g = document.getElementById('grid');
  g.className = 'grid ' + cls;
  document.querySelectorAll('.toolbar button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}

function wakeAgent(id) {
  if (streams[id]) return; // already streaming
  const prompt = autoPrompts[id] || 'What are you thinking about right now?';
  const screen = document.getElementById('screen-' + id);
  const status = document.getElementById('status-' + id);
  const stats = document.getElementById('stats-' + id);
  const tile = document.getElementById('tile-' + id);

  screen.innerHTML = '<span class="tile-cursor"></span>';
  status.textContent = 'connecting';
  status.className = 'tile-status';
  tile.classList.add('streaming');

  const es = new EventSource('/api/stream?agent=' + id + '&prompt=' + encodeURIComponent(prompt));
  streams[id] = es;
  activeCount++;
  updateGlobalStats();

  let fullText = '';

  es.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.type === 'frame') {
      fullText = d.text;
      screen.innerHTML = escapeHtml(fullText) + '<span class="tile-cursor"></span>';
      status.textContent = 'live';
      status.className = 'tile-status live';
      const cps = d.index / Math.max(d.elapsed, 0.001);
      stats.textContent = d.index + ' chars | ' + cps.toFixed(0) + ' c/s | ' + d.elapsed.toFixed(1) + 's';
    }
    if (d.type === 'done') {
      fullText = d.text;
      screen.innerHTML = escapeHtml(fullText);
      status.textContent = 'done';
      status.className = 'tile-status done';
      stats.textContent = d.index + ' chars | ' + d.elapsed.toFixed(1) + 's | done';
      tile.classList.remove('streaming');
      es.close();
      delete streams[id];
      activeCount--;
      updateGlobalStats();
    }
    if (d.type === 'error') {
      screen.innerHTML = '<span style="color:#FF2255">Error: ' + escapeHtml(d.error || 'unknown') + '</span>';
      status.textContent = 'error';
      status.className = 'tile-status';
      es.close();
      delete streams[id];
      activeCount--;
      updateGlobalStats();
    }

    // Store SVG for fullscreen
    if (d.svg) tile.dataset.svg = d.svg;
  };

  es.onerror = () => {
    status.textContent = 'offline';
    status.className = 'tile-status';
    tile.classList.remove('streaming');
    es.close();
    delete streams[id];
    activeCount--;
    updateGlobalStats();
  };
}

function wakeAll() {
  const ids = Object.keys(agents);
  // Stagger starts by 500ms to avoid overwhelming
  ids.forEach((id, i) => {
    setTimeout(() => wakeAgent(id), i * 800);
  });
}

function updateGlobalStats() {
  document.getElementById('global-stats').textContent = activeCount + ' / ' + Object.keys(agents).length + ' streaming';
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Click tile to fullscreen
document.querySelectorAll('.tile-screen').forEach(el => {
  el.addEventListener('click', (e) => {
    const tile = el.closest('.tile');
    const id = tile.dataset.agent;
    if (!streams[id] && !tile.dataset.svg) {
      wakeAgent(id);
      return;
    }
    if (tile.dataset.svg) {
      document.getElementById('fullscreen-content').innerHTML = tile.dataset.svg;
      document.getElementById('fullscreen').classList.add('show');
    }
  });
});

function closeFullscreen() {
  document.getElementById('fullscreen').classList.remove('show');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeFullscreen();
});
</script>
</body></html>`;
}

// ── Router ──
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (url.pathname === '/robots.txt')
      return new Response('User-agent: *\nAllow: /\nSitemap: https://streaming.blackroad.io/sitemap.xml', { headers: { 'Content-Type': 'text/plain' } });
    if (url.pathname === '/sitemap.xml') {
      const d = new Date().toISOString().split('T')[0];
      return new Response(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://streaming.blackroad.io/</loc><lastmod>${d}</lastmod><priority>1.0</priority></url><url><loc>https://streaming.blackroad.io/tv</loc><lastmod>${d}</lastmod></url></urlset>`, { headers: { 'Content-Type': 'application/xml' } });
    }

    if (url.pathname === '/api/stream') {
      const agent = url.searchParams.get('agent') || 'road';
      const prompt = url.searchParams.get('prompt') || 'What is BlackRoad OS?';
      return streamAgent(request, env, agent, prompt);
    }

    if (url.pathname === '/api/agents') {
      return Response.json(Object.entries(AGENTS).map(([id, a]) => ({ id, ...a })), { headers: cors });
    }

    if (url.pathname === '/health') {
      return Response.json({ status: 'live', service: 'streaming-blackroad', agents: Object.keys(AGENTS).length, version: '2.0.0', features: ['single-stream', 'roadtv', 'classroom'] }, { headers: cors });
    }

    // RoadTV classroom view
    if (url.pathname === '/tv' || url.pathname === '/roadtv' || url.pathname === '/classroom') {
      return new Response(renderTVUI(), { headers: { 'Content-Type': 'text/html;charset=UTF-8', ...cors } });
    }

    // Single agent view (default)
    return new Response(renderSingleUI(), { headers: { 'Content-Type': 'text/html;charset=UTF-8', ...cors } });
  },
};
