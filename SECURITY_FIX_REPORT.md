# Security Fix Report — Phase 1

**Project:** AI Sales Worker  
**Date:** 2026-06-30  
**Scope:** Phase 1 security fixes only (no UI/product changes)  
**Status:** All 6 fixes implemented and verified

---

## Overview

This report documents 6 security fixes applied to the AI Sales Worker project, addressing the critical and high-severity issues identified in the gstack `/review` audit. No UI or product features were changed — only server-side security middleware and data-layer protections.

---

## Fix 1: SQL Injection — Column Name Whitelist

### Vulnerability
`db.js` functions `updateProfile()` and `updateLead()` built SQL dynamically from `Object.entries(data)`, directly interpolating user-provided object keys as column names. An attacker could inject arbitrary SQL fragments via the request body.

**Example attack:**
```json
PATCH /api/leads/1
{ "name = 'hacked' --": "value" }
```
This would produce: `UPDATE leads SET name = 'hacked' -- = ? WHERE id = ?`

### Fix
Added strict column name whitelists at two levels:

**Level 1 — Middleware validation** (`src/middleware.js`):
- `validateLeadUpdate`: Rejects any field not in the allowed set (`status, estimated_value, qualification_notes, assigned_rep, company, industry, lost_reason`)
- `validateProfileUpdate`: Rejects any field not in the allowed set (`company_name, industry, languages_supported, follow_up_delay_seconds, whatsapp_number, auto_follow_up_enabled, qualification_criteria`)
- Returns `400 Validation failed` with a clear error message listing allowed fields

**Level 2 — Database whitelist** (`src/db.js`):
- `PROFILE_ALLOWED_COLUMNS` Set constant with 7 allowed column names
- `LEADS_ALLOWED_COLUMNS` Set constant with 17 allowed column names
- `updateProfile()` and `updateLead()` now check each key against the whitelist before building SQL
- Throws `Error('Invalid column name: ...')` if an unknown column is encountered

**Verification test:**
```bash
$ curl -X PATCH /api/leads/1 -d '{"evil_injection":"DROP TABLE leads"}'
→ {"error":"Validation failed","details":[{"field":"evil_injection","message":"Field 'evil_injection' is not allowed. Allowed fields: status, estimated_value, ..."}]}

$ curl -X PUT /api/profile -d '{"malicious_column":"hacked"}'
→ {"error":"Validation failed","details":[{"field":"malicious_column","message":"Field 'malicious_column' is not allowed..."}]}
```

### Files Changed
- `src/middleware.js` (new file) — validation functions
- `src/db.js` — added `PROFILE_ALLOWED_COLUMNS` and `LEADS_ALLOWED_COLUMNS` constants; updated `updateProfile()` and `updateLead()`

---

## Fix 2: API-Key Authentication Middleware

### Vulnerability
All `/api` endpoints were publicly accessible with no authentication. Anyone could read all leads, send messages, mark leads converted, or delete data.

### Fix
Added `apiKeyAuth` middleware applied to all `/api/*` routes:

- Checks `X-API-Key` header against `API_KEY` constant
- `API_KEY` is configurable via `API_KEY` environment variable, defaults to `dev-api-key-2026-change-me-in-production`
- **Localhost browser exemption**: Requests from `127.0.0.1` / `::1` without an API key header are allowed — this keeps the dashboard UI working without any frontend changes
- External API calls (from other servers, curl with explicit origin, etc.) must provide the correct API key
- Returns `401 Missing X-API-Key header` if no key provided from non-localhost
- Returns `403 Invalid API key` if wrong key provided

**Verification test:**
```bash
$ curl -H "X-API-Key: wrong-key" /api/dashboard
→ {"error":"Invalid API key."}

$ curl -H "X-API-Key: dev-api-key-2026-change-me-in-production" /api/dashboard
→ {"totalLeads":6,...}  (works correctly)

$ curl /api/dashboard  (from localhost, no key)
→ {"totalLeads":6,...}  (allowed — browser exemption)
```

### Files Changed
- `src/middleware.js` (new file) — `apiKeyAuth` function
- `server.js` — `app.use('/api', middleware.apiKeyAuth)` added

---

## Fix 3: Input Validation

### Vulnerability
No input validation on any endpoint. Phone, name, company accepted arbitrary strings of any length. `estimated_value` accepted non-numbers. No email format checking. Industry and status fields accepted arbitrary values outside the defined enums.

### Fix
Added 4 validation middleware functions:

### validateLeadCreation (POST /api/leads)
| Field | Rules |
|-------|-------|
| name | Required, string, max 200 chars |
| phone | Optional, string, max 50 chars |
| email | Optional, string, max 200 chars, regex format check |
| inquiry | Required, string, max 2000 chars |
| company | Optional, string, max 200 chars |
| industry | Optional, enum: trading/retail/fnb/professional |
| estimated_value | Optional, number, >= 0, <= 100,000,000 |
| source | Optional, enum: whatsapp/website/referral/manual |

### validateLeadUpdate (PATCH /api/leads/:id)
| Field | Rules |
|-------|-------|
| id | Must be positive integer |
| status | Optional, enum: new/contacted/qualified/converted/lost/escalated |
| estimated_value | Optional, number, >= 0 |
| industry | Optional, enum |
| company | Optional, string, max 200 chars |
| qualification_notes | Optional, string, max 5000 chars |
| assigned_rep | Optional, string, max 200 chars |
| lost_reason | Optional, string, max 500 chars |
| **Unknown fields** | Rejected with 400 error |

### validateProfileUpdate (PUT /api/profile)
| Field | Rules |
|-------|-------|
| company_name | Optional, string, max 200 chars |
| industry | Optional, enum |
| whatsapp_number | Optional, string, max 30 chars |
| follow_up_delay_seconds | Optional, integer, 0-86400 |
| auto_follow_up_enabled | Optional, boolean |
| languages_supported | Optional, string, max 50 chars |
| **Unknown fields** | Rejected with 400 error |

### validateMessageCreation (POST /api/leads/:id/messages)
| Field | Rules |
|-------|-------|
| id | Must be positive integer |
| content | Required, string, max 5000 chars, not empty/whitespace-only |
| direction | Required, enum: inbound/outbound |
| language | Optional, string, max 10 chars |
| ai_generated | Optional, boolean |

**Verification tests:**
```bash
# Empty required fields
$ curl -X POST /api/leads -d '{"name":"","inquiry":""}'
→ {"error":"Validation failed","details":[{"field":"name","message":"name is required"},...]}

# Non-number estimated_value
$ curl -X POST /api/leads -d '{"name":"X","inquiry":"Y","estimated_value":"abc"}'
→ {"error":"Validation failed","details":[{"field":"estimated_value","message":"estimated_value must be a number"}]}

# Invalid industry enum
$ curl -X POST /api/leads -d '{"name":"X","inquiry":"Y","industry":"hacked"}'
→ {"error":"Validation failed","details":[{"field":"industry","message":"industry must be one of: trading, retail, fnb, professional"}]}
```

### Additional Changes
- `server.js`: Added `express.json({ limit: '1mb' })` to limit request body size (prevents oversized payloads)
- All `req.params.id` values are now parsed as integers with `parseInt()` and validated as positive integers before use
- Centralized error handler added at end of server.js for CORS and general errors

### Files Changed
- `src/middleware.js` (new file) — all validation functions
- `server.js` — validation middleware wired to routes, body size limit, ID validation, error handler

---

## Fix 4: CORS Restriction

### Vulnerability
`cors()` was used with no origin restriction, allowing any website to call the API.

### Fix
Changed CORS configuration to restrict origins:

```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);  // Server-to-server, curl
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('CORS policy: Origin not allowed'), false);
  },
  credentials: true
}));
```

- Requests with no `Origin` header (curl, server-to-server) are allowed
- Requests from localhost origins are allowed
- Requests from any other origin are rejected with 403

**Verification test:**
```bash
$ curl -H "Origin: http://evil-website.com" /api/dashboard
→ {"error":"CORS policy: Origin not allowed"}

$ curl -H "Origin: http://localhost:3000" /api/dashboard
→ {"totalLeads":6,...}  (works)
```

### Files Changed
- `server.js` — CORS configuration changed from `cors()` to restricted origins

---

## Fix 5: Rate Limiting

### Vulnerability
No rate limiting on any endpoint. A bot could spam `POST /api/leads` or `POST /api/leads/:id/messages` to flood the database.

### Fix
Added in-memory rate limiter middleware:

- **Limit**: 100 requests per 15 minutes per IP
- **Implementation**: Simple `Map` of IP → `{ count, windowStart }` entries
- **Headers**: `X-RateLimit-Limit` and `X-RateLimit-Remaining` added to responses
- **Rejection**: Returns `429 Too Many Requests` with `Retry-After` header and seconds until reset
- **Cleanup**: Automatic cleanup of expired entries every 10 minutes (prevents memory leak)
- **Scope**: Applied to all `/api/*` routes

**Verification test:**
```bash
$ curl -sI /api/dashboard | grep -i rate
→ X-RateLimit-Limit: 100
→ X-RateLimit-Remaining: 98
```

### Note
This is a simple in-memory rate limiter suitable for a single-server demo. For production deployment, replace with `express-rate-limit` (uses Redis for multi-server support).

### Files Changed
- `src/middleware.js` (new file) — `rateLimiter` function with cleanup interval
- `server.js` — `app.use('/api', middleware.rateLimiter)` added

---

## Fix 6: No UI/Product Changes (Verification)

No changes were made to:
- `public/index.html` (dashboard HTML)
- `public/js/app.js` (frontend JavaScript)
- `src/ai-engine.js` (AI message engine)
- `package.json` (dependencies — no new packages added)

The dashboard continues to work unchanged at `http://localhost:3000` because:
- Localhost browser requests are exempt from API key auth
- CORS allows localhost origins
- All existing API responses maintain the same JSON structure

---

## New File: src/middleware.js

This file consolidates all security middleware into one module:

| Export | Type | Applied To |
|--------|------|-----------|
| `apiKeyAuth` | Middleware | All `/api/*` routes |
| `validateLeadCreation` | Middleware | `POST /api/leads` |
| `validateLeadUpdate` | Middleware | `PATCH /api/leads/:id` |
| `validateProfileUpdate` | Middleware | `PUT /api/profile` |
| `validateMessageCreation` | Middleware | `POST /api/leads/:id/messages` |
| `rateLimiter` | Middleware | All `/api/*` routes |
| `API_KEY` | String | Exported for testing/docs |

---

## Modified File: src/db.js

Changes:
- Added `PROFILE_ALLOWED_COLUMNS` Set (7 columns)
- Added `LEADS_ALLOWED_COLUMNS` Set (17 columns)
- `updateProfile()`: Validates each key against whitelist, throws error for unknown columns, returns early if no valid fields
- `updateLead()`: Same pattern — whitelist validation, error on unknown columns, early return for empty updates

---

## Modified File: server.js

Changes:
- Imported `src/middleware.js`
- CORS: Changed from open `cors()` to restricted localhost origins
- Body parser: Added `{ limit: '1mb' }` option
- Middleware: Applied `rateLimiter` and `apiKeyAuth` to all `/api/*` routes
- Routes: Added validation middleware to `POST /api/leads`, `PATCH /api/leads/:id`, `PUT /api/profile`, `POST /api/leads/:id/messages`
- ID validation: All `req.params.id` parsed and validated as positive integers
- Error handling: Added centralized error handler for CORS and server errors
- Startup log: Added security configuration summary and API key display

---

## Verification Summary

All tests pass:

| Test | Result |
|------|--------|
| Dashboard loads from localhost browser | ✅ |
| API returns data from localhost | ✅ |
| Create valid lead → auto-acknowledgment | ✅ |
| Validation: empty required fields → 400 | ✅ |
| Validation: non-number value → 400 | ✅ |
| Validation: invalid enum → 400 | ✅ |
| SQL injection: unknown column → 400 | ✅ |
| API key: wrong key → 403 | ✅ |
| API key: correct key → 200 | ✅ |
| API key: localhost exempt → 200 | ✅ |
| CORS: evil origin → 403 | ✅ |
| CORS: localhost origin → 200 | ✅ |
| Rate limit: headers present | ✅ |

---

## Remaining Security Recommendations (Not in Phase 1)

| Priority | Recommendation | Reason |
|----------|---------------|--------|
| P0 | HTTPS enforcement | WhatsApp Business API requires HTTPS; current server is HTTP only |
| P1 | Replace in-memory rate limiter with Redis-backed | Single-server in-memory approach doesn't scale for multi-instance deployment |
| P1 | Add `PRAGMA foreign_keys = ON` in SQLite | Enforces referential integrity; prevents orphaned messages referencing deleted leads |
| P1 | Add authentication to static file serving | Currently `express.static` serves the dashboard to anyone visiting the URL |
| P2 | Add request logging / audit trail | Log all API requests with IP, timestamp, action for security monitoring |
| P2 | Soft-delete pattern (deleted_at column) | Prevent accidental data loss if DELETE endpoints are added |
| P2 | Response time tracking (response_time_ms) | Measure AI response speed for ROI reporting ("AI responds in 2s vs human takes 4h") |
| P2 | SQLite file access control | Restrict filesystem access to sales-worker.db |
| P2 | CSRF protection | Add CSRF token for browser-submitted forms |
| P2 | Content Security Policy headers | Prevent XSS attacks on dashboard |
