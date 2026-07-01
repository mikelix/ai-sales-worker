const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/db');
const ai = require('./src/ai-engine');
const middleware = require('./src/middleware');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ===== Security: CORS — supports production origins via env var =====
const envOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8000',
  ...envOrigins
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Origin not allowed'), false);
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' })); // Limit request body size

// Initialize database (before routes and static middleware)
db.init();

// ===== Health check endpoint (required by Render) — BEFORE static middleware =====
app.get('/health', (req, res) => {
  try {
    const profile = db.getProfile();
    res.status(200).json({
      status: 'healthy',
      service: 'ai-sales-worker',
      timestamp: new Date().toISOString(),
      dbInitialized: !!profile
    });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: 'Database not available' });
  }
});

// Static files (dashboard UI)
app.use(express.static(path.join(__dirname, 'public')));

// ===== Security: Rate limiting on all /api routes =====
app.use('/api', middleware.rateLimiter);

// ===== Security: API key auth on all /api routes =====
app.use('/api', middleware.apiKeyAuth);

// ============ API Routes ============

// Get business profile
app.get('/api/profile', (req, res) => {
  res.json(db.getProfile());
});

// Update business profile (with validation)
app.put('/api/profile', middleware.validateProfileUpdate, (req, res) => {
  try {
    res.json(db.updateProfile(req.body));
  } catch (err) {
    if (err.message.startsWith('Invalid column name')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get ROI metrics / dashboard data
app.get('/api/dashboard', (req, res) => {
  res.json(db.getROIMetrics());
});

// Get all leads (with optional status filter)
app.get('/api/leads', (req, res) => {
  const status = req.query.status || null;
  res.json(db.getLeads(status));
});

// Get single lead
app.get('/api/leads/:id', (req, res) => {
  const leadId = parseInt(req.params.id, 10);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return res.status(400).json({ error: 'Lead ID must be a positive integer' });
  }
  const lead = db.getLead(leadId);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

// Create new lead (with validation)
app.post('/api/leads', middleware.validateLeadCreation, (req, res) => {
  const data = {
    name: req.body.name || 'Unknown',
    phone: req.body.phone || '',
    email: req.body.email || '',
    source: req.body.source || 'whatsapp',
    language: ai.detectLanguage(req.body.inquiry || ''),
    inquiry: req.body.inquiry || '',
    company: req.body.company || null,
    industry: req.body.industry || 'trading',
    estimated_value: req.body.estimated_value || 0
  };

  const lead = db.createLead(data);
  db.logAutomation(lead.id, 'lead_created', { source: data.source, language: data.language });

  // Auto-trigger AI follow-up if enabled
  const profile = db.getProfile();
  if (profile.auto_follow_up_enabled) {
    const message = ai.generateNextMessage(lead);
    if (message) {
      // Send acknowledgment immediately
      const ackContent = ai.templates.acknowledgment[lead.language](lead.name, lead.company);
      db.createMessage({
        lead_id: lead.id,
        direction: 'outbound',
        content: ackContent,
        language: lead.language,
        ai_generated: true,
        template_used: 'acknowledgment',
        message_type: 'text',
        metadata: JSON.stringify({ auto: true })
      });

      // Update lead status and first_response_at
      db.updateLead(lead.id, {
        status: 'contacted',
        first_response_at: new Date().toISOString().replace('T', ' ').replace('Z', '')
      });

      db.logAutomation(lead.id, 'auto_acknowledgment', { template: 'acknowledgment', language: lead.language });
    }
  }

  res.json({ lead, autoResponded: profile.auto_follow_up_enabled });
});

// Update lead status (with validation)
app.patch('/api/leads/:id', middleware.validateLeadUpdate, (req, res) => {
  const leadId = parseInt(req.params.id, 10);
  const lead = db.getLead(leadId);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const updates = {};
  if (req.body.status) updates.status = req.body.status;
  if (req.body.estimated_value) updates.estimated_value = req.body.estimated_value;
  if (req.body.qualification_notes) updates.qualification_notes = req.body.qualification_notes;
  if (req.body.assigned_rep) updates.assigned_rep = req.body.assigned_rep;
  if (req.body.company) updates.company = req.body.company;
  if (req.body.industry) updates.industry = req.body.industry;

  if (req.body.status === 'converted') {
    updates.converted_at = new Date().toISOString().replace('T', ' ').replace('Z', '');
  }
  if (req.body.status === 'lost') {
    updates.lost_at = new Date().toISOString().replace('T', ' ').replace('Z', '');
    updates.lost_reason = req.body.lost_reason || 'Unknown';
  }

  try {
    res.json(db.updateLead(leadId, updates));
  } catch (err) {
    if (err.message.startsWith('Invalid column name')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Get messages for a lead
app.get('/api/leads/:id/messages', (req, res) => {
  const leadId = parseInt(req.params.id, 10);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return res.status(400).json({ error: 'Lead ID must be a positive integer' });
  }
  res.json(db.getMessages(leadId));
});

// Send outbound message (AI-generated or manual) (with validation)
app.post('/api/leads/:id/messages', middleware.validateMessageCreation, (req, res) => {
  const leadId = parseInt(req.params.id, 10);
  const lead = db.getLead(leadId);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  if (req.body.direction === 'inbound') {
    // Simulate an inbound message from the lead
    const msg = db.createMessage({
      lead_id: lead.id,
      direction: 'inbound',
      content: req.body.content,
      language: req.body.language || lead.language,
      ai_generated: false,
      template_used: null,
      message_type: 'text',
      metadata: null
    });

    // AI auto-responds to inbound message
    const profile = db.getProfile();
    if (profile.auto_follow_up_enabled && req.body.auto_reply) {
      const response = ai.generateNextMessage(lead, req.body.content);
      if (response) {
        db.createMessage({
          lead_id: lead.id,
          direction: 'outbound',
          content: response.content,
          language: response.language,
          ai_generated: true,
          template_used: response.template_used,
          message_type: 'text',
          metadata: JSON.stringify({ triggered_by: 'inbound', bant_score: response.bantScore })
        });

        const updates = { status: response.newStatus };
        const hasQualProgress = response.qualificationProgress &&
          Object.keys(response.qualificationProgress).length > 0;
        if (hasQualProgress) {
          updates.qualification_notes = JSON.stringify(response.qualificationProgress);
          updates.qualification_score = response.bantScore;
        }
        db.updateLead(lead.id, updates);

        db.logAutomation(lead.id, 'auto_reply', {
          template: response.template_used,
          bant_score: response.bantScore,
          new_status: response.newStatus
        });

        return res.json({ inbound: msg, autoReply: response });
      }
    }

    return res.json({ inbound: msg, autoReply: null });
  }

  if (req.body.direction === 'outbound') {
    // Manual outbound message or AI-generated
    const content = req.body.content || '';
    const isAiGenerated = req.body.ai_generated || false;

    const msg = db.createMessage({
      lead_id: lead.id,
      direction: 'outbound',
      content,
      language: req.body.language || lead.language,
      ai_generated: isAiGenerated,
      template_used: req.body.template_used || null,
      message_type: 'text',
      metadata: null
    });

    // If this is a manual outbound, update lead status
    if (lead.status === 'new' && !lead.first_response_at) {
      db.updateLead(lead.id, {
        status: 'contacted',
        first_response_at: new Date().toISOString().replace('T', ' ').replace('Z', '')
      });
    }

    res.json(msg);
  }
});

// Trigger AI follow-up for a lead (manual trigger)
app.post('/api/leads/:id/ai-followup', (req, res) => {
  const leadId = parseInt(req.params.id, 10);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return res.status(400).json({ error: 'Lead ID must be a positive integer' });
  }
  const lead = db.getLead(leadId);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const message = ai.generateNextMessage(lead);
  if (!message) return res.json({ message: null, reason: 'No follow-up needed at this stage' });

  const msg = db.createMessage({
    lead_id: lead.id,
    direction: 'outbound',
    content: message.content,
    language: message.language,
    ai_generated: true,
    template_used: message.template_used,
    message_type: 'text',
    metadata: JSON.stringify({ manually_triggered: true, bant_score: message.bantScore })
  });

  const updates = { status: message.newStatus };
  // Only update qualification fields if there are actual BANT signals
  // (non-empty qualificationProgress with at least one criterion met)
  const hasQualProgress = message.qualificationProgress &&
    Object.keys(message.qualificationProgress).length > 0;
  if (hasQualProgress) {
    updates.qualification_notes = JSON.stringify(message.qualificationProgress);
    updates.qualification_score = message.bantScore;
  }
  db.updateLead(lead.id, updates);

  res.json({ message: msg, leadUpdate: updates });
});

// Generate AI suggested response (preview only, don't send)
app.post('/api/leads/:id/ai-suggest', (req, res) => {
  const leadId = parseInt(req.params.id, 10);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return res.status(400).json({ error: 'Lead ID must be a positive integer' });
  }
  const lead = db.getLead(leadId);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const context = req.body.context || null; // Optional: pretend an inbound message arrived
  const message = ai.generateNextMessage(lead, context);

  if (!message) return res.json({ suggestion: null });
  res.json({ suggestion: message });
});

// Get automation log for a lead
app.get('/api/leads/:id/log', (req, res) => {
  const leadId = parseInt(req.params.id, 10);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return res.status(400).json({ error: 'Lead ID must be a positive integer' });
  }
  const logs = db.getDb().prepare('SELECT * FROM automation_log WHERE lead_id = ? ORDER BY created_at DESC').all(leadId);
  res.json(logs);
});

// Get leads needing attention today
app.get('/api/attention', (req, res) => {
  res.json(db.getAttentionLeads());
});

// Pipeline stats
app.get('/api/pipeline', (req, res) => {
  const pipeline = {
    new: db.getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status = \'new\'').get().count,
    contacted: db.getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status = \'contacted\'').get().count,
    qualified: db.getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status = \'qualified\'').get().count,
    converted: db.getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status = \'converted\'').get().count,
    lost: db.getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status = \'lost\'').get().count,
    escalated: db.getDb().prepare('SELECT COUNT(*) as count FROM leads WHERE status = \'escalated\'').get().count
  };
  const values = {
    new: db.getDb().prepare('SELECT COALESCE(SUM(estimated_value), 0) as total FROM leads WHERE status = \'new\'').get().total,
    contacted: db.getDb().prepare('SELECT COALESCE(SUM(estimated_value), 0) as total FROM leads WHERE status = \'contacted\'').get().total,
    qualified: db.getDb().prepare('SELECT COALESCE(SUM(estimated_value), 0) as total FROM leads WHERE status = \'qualified\'').get().total,
    converted: db.getDb().prepare('SELECT COALESCE(SUM(estimated_value), 0) as total FROM leads WHERE status = \'converted\'').get().total
  };
  res.json({ counts: pipeline, values });
});

// ===== Centralized error handler =====
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('CORS policy')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, HOST, () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = isProduction ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'your-app.onrender.com'}` : `http://localhost:${PORT}`;
  const apiBase = isProduction ? `${baseUrl}/api` : `http://localhost:${PORT}/api`;

  console.log(`\n  AI Sales Worker running at ${baseUrl}`);
  console.log(`  Dashboard:  ${baseUrl}`);
  console.log(`  Health:     ${baseUrl}/health`);
  console.log(`  API:        ${apiBase}/dashboard`);
  console.log(`  Host:       ${HOST} | Port: ${PORT}`);
  console.log(`\n  Environment: ${isProduction ? 'Production (Render)' : 'Development'}`);
  console.log(`  CORS origins: ${allowedOrigins.join(', ')}`);
  console.log(`  Auth:     API-key (X-API-Key header) — ${isProduction ? 'all requests require key' : 'localhost browser exempt'}`);
  console.log(`  Rate:     ${100} requests / 15 min per IP`);
  console.log(`  Validation: Lead, profile, message inputs validated`);
  console.log(`  SQL:      Column-name whitelist in updateProfile/updateLead`);
  console.log(`\n  API Key: ${middleware.API_KEY}`);
  console.log(`    (Set API_KEY env variable to change)`);
  console.log(`\n  Market: 中國香港 SMEs`);
  console.log(`  Workflow: Sales Lead Follow-up (WhatsApp)`);
  console.log(`  Languages: Cantonese (zh-HK) + English\n`);
});

// ===== Graceful shutdown =====
function shutdown(signal) {
  console.log(`\n  Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('  Server closed. Goodbye.');
    process.exit(0);
  });
  // Force close after 10 seconds if connections linger
  setTimeout(() => {
    console.error('  Forcing shutdown after 10s timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
