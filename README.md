# RoadTV — Watch AI Agents Think Live

YouTube Live for AI agents. Each character an agent thinks becomes a frame. Watch all 12 agents simultaneously in the classroom view.

## What it does

RoadTV streams AI agent cognition in real-time. Pick any agent from the BlackRoad fleet — Road, Coder, Scholar, Alice, Cecilia, Octavia, Lucidia, Aria, Pascal, Writer, Tutor, Cipher — and watch them think character by character. The classroom view tiles all 12 agents on one screen so you can observe the entire fleet reasoning at once, like a teacher watching students work.

Each agent has a domain-specific auto-prompt: Pascal derives from the Amundson constant, Coder writes distributed systems snippets, Scholar explores information theory, Aria reports system health. Hit "Wake All Agents" and the whole fleet lights up.

## Features

- **Single agent stream** — select an agent, type a prompt, watch the response render character by character with a live cursor
- **RoadTV classroom grid** — all 12 agents on one screen in configurable layouts: 2x2, 3x2, 4x3, 6x2
- **SSE per-character streaming** — every character is a frame event sent over Server-Sent Events
- **Auto-prompts per agent domain** — each agent thinks about what they know best
- **Fullscreen expand** — click any tile to blow it up to full SVG view, Escape to close
- **SVG frame rendering** — each frame is a 1280x720 SVG with agent color, cursor, stats bar
- **Staggered wake** — "Wake All" staggers agent starts by 800ms to avoid overload

## Deployments

**Cloudflare Worker** (production): streaming.blackroad.io — uses Workers AI with Llama 3.1 8B

**Self-hosted** (Cecilia): `192.168.4.96:8802` — Node.js server hitting local Ollama models directly

## Stack

- Cloudflare Workers
- Workers AI (@cf/meta/llama-3.1-8b-instruct)
- D1 (blackroad-chat database)
- Server-Sent Events (SSE)

## Routes

| Route | Description |
|-------|-------------|
| `/` | Single agent streaming view |
| `/tv` | RoadTV classroom grid (also `/roadtv`, `/classroom`) |
| `/api/stream?agent=road&prompt=...` | SSE stream endpoint |
| `/api/agents` | JSON list of all 12 agents |
| `/health` | Health check with version and feature list |
| `/robots.txt` | SEO crawl rules |
| `/sitemap.xml` | XML sitemap |

## Development

```bash
npm install
npm run dev      # wrangler dev server on localhost:8787
npm run deploy   # deploy to Cloudflare
```

## Agents

| ID | Name | Role | Color |
|----|------|------|-------|
| road | Road | Guide | #FF2255 |
| coder | Coder | Engineer | #00D4FF |
| scholar | Scholar | Research | #8844FF |
| alice | Alice | Gateway | #FF6B2B |
| cecilia | Cecilia | AI Engine | #CC00AA |
| octavia | Octavia | Compute | #F5A623 |
| lucidia | Lucidia | Cognition | #4488FF |
| aria | Aria | Monitor | #00897B |
| pascal | Pascal | Math | #9C27B0 |
| writer | Writer | Content | #FF6E40 |
| tutor | Tutor | Education | #2979FF |
| cipher | Cipher | Security | #E91E63 |

## License

Proprietary — BlackRoad OS, Inc. All rights reserved.
