const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Configurable DB path — Render persistent disk or local data directory
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'sales-worker.db');

// ===== Security: Column name whitelists to prevent SQL injection =====
const PROFILE_ALLOWED_COLUMNS = new Set([
  'company_name', 'industry', 'languages_supported',
  'follow_up_delay_seconds', 'whatsapp_number', 'auto_follow_up_enabled',
  'qualification_criteria'
]);

const LEADS_ALLOWED_COLUMNS = new Set([
  'name', 'phone', 'email', 'source', 'language', 'inquiry', 'company',
  'industry', 'status', 'estimated_value', 'qualification_score',
  'qualification_notes', 'assigned_rep', 'first_response_at',
  'last_message_at', 'converted_at', 'lost_at', 'lost_reason'
]);

let db;

function init() {
  // Ensure data directory exists (works for local path and Render persistent disk)
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      company_name TEXT NOT NULL DEFAULT 'Your Company',
      industry TEXT NOT NULL DEFAULT 'trading',
      languages_supported TEXT NOT NULL DEFAULT 'en,zh-HK',
      follow_up_delay_seconds INTEGER NOT NULL DEFAULT 300,
      whatsapp_number TEXT NOT NULL DEFAULT '+852 XXXX XXXX',
      auto_follow_up_enabled INTEGER NOT NULL DEFAULT 1,
      qualification_criteria TEXT NOT NULL DEFAULT '{"budget":true,"authority":true,"need":true,"timeline":true}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      source TEXT NOT NULL DEFAULT 'whatsapp',
      language TEXT NOT NULL DEFAULT 'zh-HK',
      inquiry TEXT NOT NULL,
      company TEXT,
      industry TEXT,
      status TEXT NOT NULL DEFAULT 'new'
        CHECK(status IN ('new','contacted','qualified','converted','lost','escalated')),
      estimated_value REAL NOT NULL DEFAULT 0,
      qualification_score INTEGER NOT NULL DEFAULT 0,
      qualification_notes TEXT,
      assigned_rep TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      first_response_at TEXT,
      last_message_at TEXT,
      converted_at TEXT,
      lost_at TEXT,
      lost_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
      content TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'zh-HK',
      message_type TEXT NOT NULL DEFAULT 'text'
        CHECK(message_type IN ('text','image','document','system')),
      ai_generated INTEGER NOT NULL DEFAULT 0,
      template_used TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );

    CREATE TABLE IF NOT EXISTS automation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );

    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id, created_at);
  `);

  // Seed business profile if empty
  const profile = db.prepare('SELECT * FROM business_profile WHERE id = 1').get();
  if (!profile) {
    db.prepare(`
      INSERT INTO business_profile (id, company_name, industry, languages_supported,
        follow_up_delay_seconds, whatsapp_number, auto_follow_up_enabled, qualification_criteria)
      VALUES (1, 'HK Trading Co.', 'trading', 'en,zh-HK', 300, '+852 9876 5432', 1,
        '{"budget":true,"authority":true,"need":true,"timeline":true}')
    `).run();
  }

  // Seed sample leads for demo
  const leadCount = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
  if (leadCount === 0) {
    seedDemoData();
  }

  return db;
}

function seedDemoData() {
  const leads = [
    {
      name: '陳先生', phone: '+852 9123 4567', email: 'chan@trading-hk.com',
      source: 'whatsapp', language: 'zh-HK',
      inquiry: '我想查詢你們嘅電子零件批發價格，可以報價嗎？',
      company: '陳氏貿易', industry: 'trading',
      status: 'contacted', estimated_value: 50000, qualification_score: 2,
      created_at: '2026-06-30 09:15:00', first_response_at: '2026-06-30 09:18:00',
      last_message_at: '2026-06-30 10:30:00'
    },
    {
      name: 'Sarah Wong', phone: '+852 9876 1111', email: 'sarah@retailhk.com',
      source: 'website', language: 'en',
      inquiry: 'We are looking for a reliable supplier for retail display equipment. Can you provide a catalog?',
      company: 'Retail HK Ltd', industry: 'retail',
      status: 'qualified', estimated_value: 80000, qualification_score: 3,
      created_at: '2026-06-29 14:20:00', first_response_at: '2026-06-29 14:23:00',
      last_message_at: '2026-06-30 11:00:00'
    },
    {
      name: '李女士', phone: '+852 6789 0123', email: 'lee@fnb-hk.com',
      source: 'whatsapp', language: 'zh-HK',
      inquiry: '餐廳想採購一批餐具同廚房設備，請問有咩款式可以選擇？',
      company: '美味餐飲', industry: 'fnb',
      status: 'new', estimated_value: 25000, qualification_score: 0,
      created_at: '2026-06-30 12:05:00', first_response_at: null,
      last_message_at: null
    },
    {
      name: 'David Chan', phone: '+852 5555 7777', email: 'david@profservices.com',
      source: 'referral', language: 'en',
      inquiry: 'Our accounting firm needs office supplies and IT equipment. Do you offer corporate packages?',
      company: 'Pro Services Group', industry: 'professional',
      status: 'converted', estimated_value: 120000, qualification_score: 4,
      created_at: '2026-06-28 16:00:00', first_response_at: '2026-06-28 16:03:00',
      last_message_at: '2026-06-29 15:00:00', converted_at: '2026-06-29 15:30:00'
    },
    {
      name: '黄先生', phone: '+852 3333 4444', email: '',
      source: 'whatsapp', language: 'zh-HK',
      inquiry: '我想買一批手機配件，大概200件，幾錢？',
      company: null, industry: 'trading',
      status: 'new', estimated_value: 15000, qualification_score: 0,
      created_at: '2026-06-30 13:45:00', first_response_at: null,
      last_message_at: null
    }
  ];

  const insertLead = db.prepare(`
    INSERT INTO leads (name, phone, email, source, language, inquiry, company, industry,
      status, estimated_value, qualification_score, created_at, first_response_at, last_message_at)
    VALUES (@name, @phone, @email, @source, @language, @inquiry, @company, @industry,
      @status, @estimated_value, @qualification_score, @created_at, @first_response_at, @last_message_at)
  `);

  for (const lead of leads) {
    const result = insertLead.run(lead);
    // Set converted_at for the converted lead
    if (lead.status === 'converted' && lead.converted_at) {
      db.prepare('UPDATE leads SET converted_at = ? WHERE id = ?').run(lead.converted_at, result.lastInsertRowid);
    }
  }

  // Seed messages for existing leads
  const messagesData = [
    // Lead 1 (陳先生 - contacted)
    { lead_id: 1, direction: 'inbound', content: '我想查詢你們嘅電子零件批發價格，可以報價嗎？', language: 'zh-HK', ai_generated: 0, template_used: null, created_at: '2026-06-30 09:15:00' },
    { lead_id: 1, direction: 'outbound', content: '陳先生你好！多謝你嘅查詢。我係HK Trading嘅AI助手，我會即刻幫你準備報價。請問你需要邊款電子零件？大約幾多數量呢？', language: 'zh-HK', ai_generated: 1, template_used: 'initial_followup_zhHK', created_at: '2026-06-30 09:18:00' },
    { lead_id: 1, direction: 'inbound', content: '我要IC芯片同電容，大約500件起', language: 'zh-HK', ai_generated: 0, template_used: null, created_at: '2026-06-30 10:00:00' },
    { lead_id: 1, direction: 'outbound', content: '收到！500件起嘅IC芯片同電容，我幫你整理報價單。另外想問下：1) 你大概幾時需要到貨？ 2) 有冇特定品牌或者規格要求？ 3) 預算範圍係幾多？呢啲資料可以幫我俾你一個更準確嘅報價。', language: 'zh-HK', ai_generated: 1, template_used: 'qualification_bant_zhHK', created_at: '2026-06-30 10:05:00' },
    { lead_id: 1, direction: 'inbound', content: '下星期要，品牌唔拘，預算大約5萬', language: 'zh-HK', ai_generated: 0, template_used: null, created_at: '2026-06-30 10:30:00' },

    // Lead 2 (Sarah - qualified)
    { lead_id: 2, direction: 'inbound', content: 'We are looking for a reliable supplier for retail display equipment. Can you provide a catalog?', language: 'en', ai_generated: 0, template_used: null, created_at: '2026-06-29 14:20:00' },
    { lead_id: 2, direction: 'outbound', content: 'Hi Sarah! Thanks for reaching out to HK Trading Co. I\'m your AI assistant here. I can get you our retail display catalog right away. A few quick questions to tailor the right options: 1) What type of retail displays (shelf, freestanding, wall-mounted)? 2) Approximate order quantity? 3) Any timeline requirements?', language: 'en', ai_generated: 1, template_used: 'initial_followup_en', created_at: '2026-06-29 14:23:00' },
    { lead_id: 2, direction: 'inbound', content: 'Freestanding displays, about 50 units, needed within 2 weeks', language: 'en', ai_generated: 0, template_used: null, created_at: '2026-06-29 15:00:00' },
    { lead_id: 2, direction: 'outbound', content: 'Great choice! Our freestanding display series (FS-200) is popular with retail shops in HK. 50 units within 2 weeks is doable. Budget range for this quantity is typically HKD 60-80K. I\'ll send you the detailed quote and catalog shortly. Want me to also schedule a call with our sales specialist?', language: 'en', ai_generated: 1, template_used: 'qualification_bant_en', created_at: '2026-06-29 15:05:00' },

    // Lead 4 (David - converted)
    { lead_id: 4, direction: 'inbound', content: 'Our accounting firm needs office supplies and IT equipment. Do you offer corporate packages?', language: 'en', ai_generated: 0, template_used: null, created_at: '2026-06-28 16:00:00' },
    { lead_id: 4, direction: 'outbound', content: 'Hi David! Absolutely - we offer comprehensive corporate packages for professional services firms. For a firm like yours, I\'d recommend our ProBundle (IT equipment + office supplies + annual maintenance). Quick questions: 1) How many employees? 2) Current IT setup? 3) Monthly budget range?', language: 'en', ai_generated: 1, template_used: 'initial_followup_en', created_at: '2026-06-28 16:03:00' },
    { lead_id: 4, direction: 'inbound', content: '15 employees, need laptops and monitors, budget around HKD 100-120K', language: 'en', ai_generated: 0, template_used: null, created_at: '2026-06-28 17:00:00' },
    { lead_id: 4, direction: 'outbound', content: 'Perfect! Our ProBundle for 15-person teams fits right in that range. I\'ll prepare a detailed proposal. Given the scope, I\'d recommend a quick call with our senior account manager - shall I arrange one for tomorrow?', language: 'en', ai_generated: 1, template_used: 'qualification_bant_en', created_at: '2026-06-28 17:05:00' },
  ];

  const insertMsg = db.prepare(`
    INSERT INTO messages (lead_id, direction, content, language, ai_generated, template_used, created_at)
    VALUES (@lead_id, @direction, @content, @language, @ai_generated, @template_used, @created_at)
  `);

  for (const msg of messagesData) {
    insertMsg.run(msg);
  }

  // Seed automation_log entries for demo (so the Log tab shows data for seed leads)
  const logEntries = [
    { lead_id: 1, action: 'lead_created', result: { source: 'whatsapp', language: 'zh-HK' } },
    { lead_id: 1, action: 'auto_acknowledgment', result: { template: 'initial_followup_zhHK', language: 'zh-HK' } },
    { lead_id: 1, action: 'auto_reply', result: { template: 'qualification_bant_zhHK', bant_score: 2, new_status: 'contacted' } },
    { lead_id: 2, action: 'lead_created', result: { source: 'website', language: 'en' } },
    { lead_id: 2, action: 'auto_acknowledgment', result: { template: 'initial_followup_en', language: 'en' } },
    { lead_id: 2, action: 'auto_reply', result: { template: 'qualification_bant_en', bant_score: 3, new_status: 'qualified' } },
    { lead_id: 3, action: 'lead_created', result: { source: 'whatsapp', language: 'zh-HK' } },
    { lead_id: 4, action: 'lead_created', result: { source: 'referral', language: 'en' } },
    { lead_id: 4, action: 'auto_acknowledgment', result: { template: 'initial_followup_en', language: 'en' } },
    { lead_id: 4, action: 'auto_reply', result: { template: 'qualification_bant_en', bant_score: 4, new_status: 'converted' } },
    { lead_id: 4, action: 'lead_converted', result: { revenue: 120000, converted_at: '2026-06-29 15:30:00' } },
    { lead_id: 5, action: 'lead_created', result: { source: 'whatsapp', language: 'zh-HK' } },
  ];

  const insertLog = db.prepare(`
    INSERT INTO automation_log (lead_id, action, result) VALUES (?, ?, ?)
  `);
  for (const entry of logEntries) {
    insertLog.run(entry.lead_id, entry.action, JSON.stringify(entry.result));
  }
}

function getDb() {
  if (!db) init();
  return db;
}

// Query helpers
function getProfile() {
  return getDb().prepare('SELECT * FROM business_profile WHERE id = 1').get();
}

function updateProfile(data) {
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(data)) {
    // Security: Only allow whitelisted column names to prevent SQL injection
    if (!PROFILE_ALLOWED_COLUMNS.has(key)) {
      throw new Error(`Invalid column name: '${key}'. Only allowed columns may be updated.`);
    }
    fields.push(`${key} = ?`);
    values.push(typeof val === 'object' ? JSON.stringify(val) : val);
  }
  if (fields.length === 0) return getProfile();
  getDb().prepare(`UPDATE business_profile SET ${fields.join(', ')} WHERE id = 1`).run(...values);
  return getProfile();
}

function createLead(data) {
  const stmt = getDb().prepare(`
    INSERT INTO leads (name, phone, email, source, language, inquiry, company, industry, estimated_value)
    VALUES (@name, @phone, @email, @source, @language, @inquiry, @company, @industry, @estimated_value)
  `);
  const result = stmt.run(data);
  return getDb().prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
}

function getLead(id) {
  return getDb().prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

function updateLead(id, data) {
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(data)) {
    // Security: Only allow whitelisted column names to prevent SQL injection
    if (!LEADS_ALLOWED_COLUMNS.has(key)) {
      throw new Error(`Invalid column name: '${key}'. Only allowed columns may be updated.`);
    }
    fields.push(`${key} = ?`);
    values.push(val);
  }
  if (fields.length === 0) return getLead(id);
  values.push(id);
  getDb().prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getLead(id);
}

function getLeads(status = null, limit = 50) {
  if (status) {
    return getDb().prepare('SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, limit);
  }
  return getDb().prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT ?').all(limit);
}

function createMessage(data) {
  // Convert booleans to integers for SQLite
  const sanitized = { ...data };
  if (sanitized.ai_generated === true) sanitized.ai_generated = 1;
  if (sanitized.ai_generated === false) sanitized.ai_generated = 0;
  if (sanitized.ai_generated === null) sanitized.ai_generated = 0;
  if (sanitized.template_used === undefined) sanitized.template_used = null;
  if (sanitized.message_type === undefined) sanitized.message_type = 'text';
  if (sanitized.metadata === undefined) sanitized.metadata = null;

  const stmt = getDb().prepare(`
    INSERT INTO messages (lead_id, direction, content, language, ai_generated, template_used, message_type, metadata)
    VALUES (@lead_id, @direction, @content, @language, @ai_generated, @template_used, @message_type, @metadata)
  `);
  const result = stmt.run(sanitized);
  // Update lead's last_message_at
  getDb().prepare('UPDATE leads SET last_message_at = datetime(\'now\') WHERE id = ?').run(data.lead_id);
  return getDb().prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
}

function getMessages(leadId) {
  return getDb().prepare('SELECT * FROM messages WHERE lead_id = ? ORDER BY created_at ASC').all(leadId);
}

function getROIMetrics() {
  const totalLeads = getDb().prepare('SELECT COUNT(*) as count FROM leads').get().count;
  const contacted = getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status != \'new\'').get().count;
  const qualified = getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status IN (\'qualified\', \'converted\', \'escalated\')').get().count;
  const converted = getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status = \'converted\'').get().count;
  const totalValue = getDb().prepare('SELECT COALESCE(SUM(estimated_value), 0) as total FROM leads WHERE status = \'converted\'').get().total;
  const pipelineValue = getDb().prepare('SELECT COALESCE(SUM(estimated_value), 0) as total FROM leads WHERE status IN (\'new\',\'contacted\',\'qualified\',\'escalated\')').get().total;
  const avgResponseTime = getDb().prepare(`
    SELECT AVG(CAST((julianday(first_response_at) - julianday(created_at)) * 86400 AS REAL)) as avg_seconds
    FROM leads WHERE first_response_at IS NOT NULL
  `).get().avg_seconds;

  // Daily leads for chart
  const dailyLeads = getDb().prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count,
      SUM(CASE WHEN status = 'converted' THEN estimated_value ELSE 0 END) as revenue
    FROM leads GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 7
  `).all();

  // Industry breakdown
  const industryBreakdown = getDb().prepare(`
    SELECT industry, COUNT(*) as count,
      COALESCE(SUM(estimated_value), 0) as total_value
    FROM leads GROUP BY industry
  `).all();

  // Real pipeline counts per status (for honest funnel rendering)
  const pipelineCounts = {
    new: getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status = \'new\'').get().count,
    contacted: getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status = \'contacted\'').get().count,
    qualified: getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status = \'qualified\'').get().count,
    converted: getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status = \'converted\'').get().count,
    escalated: getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status = \'escalated\'').get().count,
    lost: getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status = \'lost\'').get().count
  };

  return {
    totalLeads,
    contacted,
    responseRate: totalLeads > 0 ? (contacted / totalLeads * 100).toFixed(1) : 0,
    qualified,
    qualifiedRate: contacted > 0 ? (qualified / contacted * 100).toFixed(1) : 0,
    converted,
    conversionRate: contacted > 0 ? (converted / contacted * 100).toFixed(1) : 0,
    totalRevenue: totalValue,
    pipelineValue,
    avgResponseTimeSeconds: avgResponseTime ? Math.round(avgResponseTime) : null,
    dailyLeads,
    industryBreakdown,
    pipelineCounts
  };
}

function logAutomation(leadId, action, result) {
  getDb().prepare(`
    INSERT INTO automation_log (lead_id, action, result) VALUES (?, ?, ?)
  `).run(leadId, action, JSON.stringify(result));
}

// Get leads that need CEO attention today
function getAttentionLeads() {
  // New leads waiting for first response
  const newWaiting = getDb().prepare(`
    SELECT * FROM leads WHERE status = 'new' AND first_response_at IS NULL
    ORDER BY created_at ASC
  `).all();

  // Contacted leads with high BANT score (3+) ready for escalation/conversion
  const readyForAction = getDb().prepare(`
    SELECT * FROM leads WHERE status IN ('contacted', 'qualified')
    AND qualification_score >= 3
    ORDER BY estimated_value DESC
  `).all();

  // Escalated leads needing CEO call
  const escalatedLeads = getDb().prepare(`
    SELECT * FROM leads WHERE status = 'escalated'
    ORDER BY estimated_value DESC
  `).all();

  // Contacted leads with no response for over 24h (need follow-up reminder)
  const staleLeads = getDb().prepare(`
    SELECT * FROM leads WHERE status = 'contacted'
    AND last_message_at IS NOT NULL
    AND julianday('now') - julianday(last_message_at) > 1
    ORDER BY last_message_at ASC
  `).all();

  return {
    newWaiting,
    readyForAction,
    escalatedLeads,
    staleLeads,
    totalAttention: newWaiting.length + readyForAction.length + escalatedLeads.length + staleLeads.length
  };
}

module.exports = {
  init,
  getDb,
  getProfile,
  updateProfile,
  createLead,
  getLead,
  updateLead,
  getLeads,
  createMessage,
  getMessages,
  getROIMetrics,
  getAttentionLeads,
  logAutomation
};
