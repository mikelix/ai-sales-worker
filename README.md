# AI Sales Worker

An AI digital worker platform for Hong Kong SMEs — the first worker automates **sales lead follow-up** end-to-end on WhatsApp, in Cantonese and English.

Built as a CEO review response: stop building diagnosis tools, build an AI worker that *executes* the workflow.

## Quick Start (Windows 11)

### Prerequisites

- **Node.js 22+** installed (or use the managed runtime below)
- No separate database install needed — SQLite is bundled via `better-sqlite3`

### Install & Run

```bash
# 1. Open a terminal (Git Bash, CMD, or PowerShell)

# 2. Navigate to the project folder
cd C:\Users\Admin\WorkBuddy\2026-06-30-14-16-37\ai-sales-worker

# 3. Install dependencies (already done if you're in this project)
npm install

# 4. Start the server
node server.js

# 5. Open the dashboard in your browser
#    http://localhost:3000
```

If you're using the managed WorkBuddy Node runtime:

```bash
cd C:\Users\Admin\WorkBuddy\2026-06-30-14-16-37\ai-sales-worker
C:\Users\Admin\.workbuddy\binaries\node\versions\22.22.2\node.exe server.js
```

### Reset Demo Data

To wipe the database and re-seed fresh demo data:

```bash
# Delete the SQLite database file (the app recreates it on next start)
del data\sales-worker.db
# Or in Git Bash:
rm -f data/sales-worker.db

# Then restart the server
node server.js
```

---

## The 4 Dashboard Tabs

### Tab 1: Dashboard

The home screen. At a glance:

- **KPI cards** — Total Leads, Response Rate, Conversion Rate, Revenue (HKD)
- **Pipeline funnel** — visual breakdown from New → Contacted → Qualified → Converted → Escalated → Lost
- **Industry breakdown** — leads by industry (Trading, Retail, F&B, Professional)
- **Daily trend chart** — leads created per day over the last 7 days
- **Recent leads** — latest 10 leads with status, language, and value

### Tab 2: Pipeline

A sales pipeline management view:

- **6 pipeline stages** displayed as columns — click any stage to filter leads
- **Lead table** — shows name, company, industry, language, BANT score (colored dots), estimated value, status
- **BANT qualification score** — colored dots (0–4) indicating how many BANT criteria are met
- **Quick actions** — click a lead to jump to its conversation

### Tab 3: Conversations

A WhatsApp-style chat interface:

- **Left panel** — lead list with status badges (New, Contacted, Qualified, Converted, Escalated, Lost)
- **Right panel** — full conversation thread with:
  - **Green bubbles** (inbound) — messages from the lead
  - **Blue bubbles** (AI outbound) — auto-generated AI responses
  - **White bubbles** (manual outbound) — messages sent by the human rep
- **Send inbound** — type a message and hit Send to simulate the lead replying. The AI auto-analyzes and responds (when "AI Auto-Reply" toggle is on)
- **AI Follow-up button** — manually trigger the next AI step in the workflow
- **Convert button** — close a qualified lead and record revenue

### Tab 4: Settings

Business profile configuration:

- **Company name** and **industry** (Trading, Retail, F&B, Professional)
- **WhatsApp business number**
- **Supported languages** — toggle Cantonese (zh-HK) and English
- **Auto follow-up** — enable/disable automatic AI responses on new leads
- **Follow-up delay** — seconds before AI sends the first follow-up (default: 300 = 5 min)

---

## How the AI Sales Workflow Works

The engine follows a 6-stage pipeline from lead intake to conversion:

```
Lead Arrives (WhatsApp/API)
    │
    ▼
[1] ACKNOWLEDGE ─── Immediate "I'll get back to you" (within seconds)
    │
    ▼
[2] FOLLOW UP ────── Personalized questions about product, volume, timeline
    │                  (industry-specific, in detected language)
    │
    ▼
[3] BANT SCORE ──── Every inbound message scanned for signals:
    │                  Budget / Authority / Need / Timeline
    │                  Score updates 0 → 1 → 2 → 3 → 4
    │
    ▼
[4] QUALIFY ──────── When BANT ≥ 3: escalate message sent
    │                  "I think you'd benefit from a call with our specialist"
    │
    ▼
[5] CONVERT ──────── Human rep closes the deal
    │                  Revenue recorded in HKD
    │
    ▼
[6] CONFIRM ──────── "Our team will follow up with paperwork"
```

### Language Detection

The engine detects Cantonese vs English from the inquiry text:

- Cantonese-specific characters (嘅, 咗, 喺, 呢, 嗰, 冇, etc.) → `zh-HK`
- Common Cantonese phrases (幾多, 咩, 唔, 嘅, 查詢, 報價) → `zh-HK`
- Any Chinese characters → `zh-HK`
- Everything else → `en`

### BANT Qualification

Each inbound message is analyzed for four signals:

| Criterion | English Keywords | Cantonese Keywords |
|-----------|-----------------|-------------------|
| **Budget** | budget, cost, price, how much, HKD | 預算, 幾錢, 價錢, 成本 |
| **Authority** | I decide, boss, manager, director, approve | 我決定, 老闆, 經理, 負責人 |
| **Need** | need, require, looking for, want | 需要, 想, 要, 要求 |
| **Timeline** | deadline, ASAP, urgent, within 2 weeks | 幾時, 期限, 急, 盡快, 要到貨 |

When 3+ criteria are detected → the engine auto-escalates to a human sales specialist.

### Industry Context

Templates are customized per industry:

| Industry | Products | Pain Points | Qualifiers |
|----------|----------|-------------|------------|
| **Trading** | Electronic components, hardware, wholesale | Pricing, bulk discounts, delivery | Order volume, specs, schedule |
| **Retail** | Display equipment, fixtures, POS | Display quality, durability, cost | Store count, display type, qty |
| **F&B** | Kitchen equipment, tableware, supplies | Food safety, reliability, bulk pricing | Restaurant type, seating, budget |
| **Professional** | Office equipment, IT systems, corporate supplies | Reliability, after-sales, integration | Team size, current setup, budget |

---

## How to Replace the Rule-Based Engine with an LLM API

The current engine (`src/ai-engine.js`) is rule-based — templates, keyword matching, and state-machine logic. It's designed as a **drop-in architecture**: replace the internals while keeping the same interface.

### The Integration Point

The server calls two functions from `src/ai-engine.js`:

```javascript
// server.js calls these:
ai.detectLanguage(inquiry)          // → 'en' or 'zh-HK'
ai.generateNextMessage(lead, inboundMessage)  // → { content, language, template_used, newStatus, qualificationProgress, bantScore }
```

### Step-by-Step Replacement

**1. Add an LLM API client**

Install your preferred SDK:

```bash
npm install openai   # or: anthropic, @google-cloud/vertexai, etc.
```

**2. Create a new engine file** (or modify `src/ai-engine.js`)

```javascript
// src/ai-engine-llm.js
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function detectLanguage(text) {
  // Option A: Keep the rule-based detector (it's fast and free)
  // Option B: Ask the LLM
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: 'Detect language. Return "zh-HK" for Cantonese, "en" for English. Return ONLY the code.'
    }, {
      role: 'user',
      content: text
    }],
    max_tokens: 5
  });
  return response.choices[0].message.content.trim();
}

async function generateNextMessage(lead, inboundMessage = null) {
  // Build the system prompt with full context
  const industryCtx = getIndustryContext(lead.industry, lead.language);
  const bantProgress = parseBantProgress(lead);

  const systemPrompt = `You are an AI sales assistant for a Hong Kong SME (${lead.industry} industry).
Respond in ${lead.language === 'zh-HK' ? 'Cantonese (written Chinese characters, conversational tone)' : 'English'}.
Business context: ${industryCtx}
BANT qualification progress: Budget=${bantProgress.budget}, Authority=${bantProgress.authority}, Need=${bantProgress.need}, Timeline=${bantProgress.timeline}
Current lead status: ${lead.status}

Rules:
- Be concise and professional
- If BANT score < 3, ask qualifying questions for missing criteria
- If BANT score >= 3, suggest escalation to human sales specialist
- Never make up product details or prices
- Respond naturally, not like a template`;

  const messages = buildConversationHistory(lead); // Load from DB
  if (inboundMessage) messages.push({ role: 'user', content: inboundMessage });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    max_tokens: 300,
    temperature: 0.7
  });

  const content = response.choices[0].message.content;

  // Extract BANT signals from the inbound message (keep rule-based for reliability)
  const analysis = analyzeInboundMessage(inboundMessage || '', lead.language);
  const updatedProgress = updateBantProgress(bantProgress, analysis);
  const bantScore = countBant(updatedProgress);

  // Determine new status based on BANT score
  let newStatus = lead.status;
  if (lead.status === 'new') newStatus = 'contacted';
  if (lead.status === 'contacted' && bantScore >= 3) newStatus = 'qualified';

  return {
    content,
    language: lead.language,
    ai_generated: true,
    template_used: 'llm_generated',
    newStatus,
    qualificationProgress: updatedProgress,
    bantScore
  };
}
```

**3. Swap the import in `server.js`**

```javascript
// Change this line:
// const ai = require('./src/ai-engine');

// To this:
const ai = require('./src/ai-engine-llm');
```

**4. Handle async** — LLM calls are async, so update the route handlers:

```javascript
// server.js — change synchronous calls to async:
app.post('/api/leads', async (req, res) => {
  // ...
  const message = await ai.generateNextMessage(lead);
  // ...
});

app.post('/api/leads/:id/messages', async (req, res) => {
  // ...
  const response = await ai.generateNextMessage(lead, req.body.content);
  // ...
});
```

**5. Keep the rule-based BANT analyzer**

Even with an LLM, keep `analyzeInboundMessage()` rule-based. It's deterministic, fast, free, and reliable for scoring. The LLM handles the *conversational* part; the rules handle the *structured* scoring.

### Recommended LLM Models

| Use Case | Model | Cost/Month | Notes |
|----------|-------|------------|-------|
| **Production (HK SME)** | GPT-4o | ~$50-200 | Best Cantonese quality |
| **Cost-sensitive** | GPT-4o-mini | ~$10-30 | Good enough for most follow-ups |
| **Privacy-sensitive** | Local LLM (Ollama) | Free | Data stays on-premises |
| **Cantonese specialist** | Claude 3.5 Sonnet | ~$30-100 | Excellent zh-HK nuance |

---

## Known Limitations

### Current Prototype (Updated after Phase 1-3A)

1. **No real WhatsApp integration** — Conversations are simulated through the dashboard UI. To connect real WhatsApp, you'd need the WhatsApp Business API (Meta) or a third-party provider like Twilio/Wati.

2. **Rule-based engine, not LLM** — Messages are generated from templates and keyword matching. This means:
   - Responses can feel formulaic after a few exchanges
   - Complex or ambiguous inquiries may get misclassified
   - No ability to handle multi-topic or nuanced conversations
   - See the LLM replacement guide above to upgrade

3. **No persistent scheduling** — Follow-up reminders (24h no-response) exist as templates but aren't automatically triggered on a schedule. You'd need a cron job or task scheduler:
   ```bash
   # Example: Windows Task Scheduler or node-cron
   npm install node-cron
   # Then add a cron job in server.js to check for leads with no response after 24h
   ```

4. **Single-user with basic API-key auth** — Phase 1 added API-key authentication (`X-API-Key` header, localhost exempt). No multi-user login or role-based access yet. For production, add user accounts with JWT auth.

5. **No multi-turn memory** — The rule-based engine doesn't carry context across multiple exchanges well. It re-analyzes each inbound message independently. An LLM with conversation history solves this.

6. **SQLite only** — Suitable for a demo and small-scale deployment (<10K leads). For production with concurrent users, migrate to PostgreSQL or MySQL.

7. **CORS restricted to localhost** — Phase 1 restricted CORS to localhost origins only. For production deployment, add your production domain to `allowedOrigins` in `server.js`.

8. **Rate limiting is in-memory** — Phase 1 added simple in-memory rate limiting (100 req/15min/IP). Rate limits reset on server restart. For production, use a Redis-backed rate limiter.

9. **No encryption at rest** — SQLite database file has no encryption. Any user with filesystem access can read all lead data. For production, encrypt the DB or use a managed database service.

10. **No data export** — No CSV/Excel export for leads or conversations. Add an export endpoint for CRM integration.

11. **Hardcoded currency** — All values are in HKD. For multi-market deployment, add currency configuration.

12. **No audit log export** — The `automation_log` table tracks AI actions internally, but there's no UI or export function to review them. For production, add an audit dashboard and CSV export.

### What Has Been Fixed (Phases 1-3A)

| Phase | What was fixed |
|-------|---------------|
| Phase 1 | SQL injection, API-key auth, input validation, CORS restriction, rate limiting |
| Phase 2 | Real pipeline funnel data, "Needs Attention" card, empty states, confirmation dialogs, loading indicators, auto-scroll |
| Phase 3A | Mobile responsive layout, CEO Demo Mode, landing header, visual polish, demo script |

### Architectural Decisions (Intentional)

- **SQLite over PostgreSQL**: Zero config, instant start, file-based portability. Trade-off: no concurrent writes scaling.
- **Rule-based over LLM**: Free to run, deterministic, instant response, no API dependency. Trade-off: less conversational flexibility.
- **Single HTML page over React**: Zero build step, instant deployment, easy to modify. Trade-off: harder to scale UI complexity.
- **No WhatsApp API**: Avoids Meta's approval process and costs for a prototype. Trade-off: not a real product yet.

---

## Project Structure

```
ai-sales-worker/
├── server.js              # Express server — routes, middleware, API endpoints
├── package.json           # Dependencies (express, better-sqlite3, cors)
├── src/
│   ├── db.js              # Database layer — SQLite schema, CRUD, seed demo data
│   └── ai-engine.js       # AI rule-based engine — templates, BANT, language detection
├── public/
│   ├── index.html         # Dashboard UI — 4-tab SPA with Tailwind CSS
│   ├── js/
│   │   └── app.js         # Frontend logic — API calls, rendering, chat interface
│   └── css/               # (optional custom styles)
└── data/
│   └── sales-worker.db    # SQLite database (auto-created, deletable to reset)
```

### Key Files

| File | What It Controls |
|------|-----------------|
| `src/ai-engine.js` | The AI rule-based engine — language detection, message templates (Cantonese + English), BANT qualification scoring, conversation state machine, escalation logic |
| `public/index.html` | The dashboard UI — all 4 tabs (Dashboard, Pipeline, Conversations, Settings), KPI cards, funnel, chat bubbles, forms, Tailwind CSS styling |
| `public/js/app.js` | Frontend JavaScript — API calls, dynamic rendering, chat interface behavior, lead management actions |
| `src/db.js` | Database layer — SQLite schema, all CRUD operations, and the `seedDemoData()` function that creates 5 demo leads with conversation histories |
| `server.js` | Express server — all API route definitions, request handling, auto-follow-up orchestration |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dashboard` | KPI metrics, pipeline counts, industry breakdown, daily trends |
| `GET` | `/api/leads` | List all leads (optional `?status=qualified` filter) |
| `GET` | `/api/leads/:id` | Get single lead details |
| `POST` | `/api/leads` | Create new lead (triggers auto acknowledgment + follow-up) |
| `PATCH` | `/api/leads/:id` | Update lead status, value, notes |
| `GET` | `/api/leads/:id/messages` | Get conversation history for a lead |
| `POST` | `/api/leads/:id/messages` | Send inbound/outbound message (triggers AI auto-reply) |
| `POST` | `/api/leads/:id/ai-followup` | Manually trigger AI follow-up |
| `POST` | `/api/leads/:id/ai-suggest` | Preview AI suggestion (doesn't send) |
| `GET` | `/api/leads/:id/log` | Automation log for a lead |
| `GET` | `/api/pipeline` | Pipeline stage counts and values |
| `GET` | `/api/profile` | Business profile settings |
| `PUT` | `/api/profile` | Update business profile settings |

---

## Seed Demo Data

The `seedDemoData()` function in `src/db.js` creates 5 pre-populated leads on first run:

| # | Name | Language | Industry | Status | Est. Value | BANT Score |
|---|------|----------|----------|--------|------------|------------|
| 1 | 陳先生 | zh-HK | Trading | Contacted | HKD 50K | 2 |
| 2 | Sarah Wong | en | Retail | Qualified | HKD 80K | 3 |
| 3 | 李女士 | zh-HK | F&B | New | HKD 25K | 0 |
| 4 | David Chan | en | Professional | Converted | HKD 120K | 4 |
| 5 | 黄先生 | zh-HK | Trading | Escalated | HKD 35K | 3 |

Each lead includes pre-seeded conversation messages demonstrating the full workflow: acknowledgment → follow-up → BANT questions → escalation → conversion.

---

## License

Prototype / demo only. Not production-ready without the upgrades described above.
