/**
 * Security Middleware for AI Sales Worker
 * Provides: API-key auth, input validation, rate limiting
 */

// ===== 1. API-Key Authentication =====

const API_KEY = process.env.API_KEY || 'dev-api-key-2026-change-me-in-production';
const SKIP_AUTH = process.env.SKIP_AUTH === 'true'; // Set SKIP_AUTH=true for open demo (not recommended for production)
const isProduction = process.env.NODE_ENV === 'production';

function apiKeyAuth(req, res, next) {
  // Skip auth entirely if SKIP_AUTH=true (for demo / testing only)
  if (SKIP_AUTH) {
    return next();
  }

  const providedKey = req.headers['x-api-key'];

  // In production (Render), all requests must provide an API key
  // In development, localhost browser access is allowed without key
  if (!isProduction) {
    const clientIp = req.ip || req.connection.remoteAddress;
    const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
    if (!providedKey && isLocalhost) {
      // Local browser access — allow for demo
      return next();
    }
  }

  // In production, or if not localhost in dev, API key is required
  if (!providedKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header. Provide API key via X-API-Key header.' });
  }

  if (providedKey !== API_KEY) {
    return res.status(403).json({ error: 'Invalid API key.' });
  }

  next();
}

// ===== 2. Input Validation =====

const VALIDATION_ERRORS = {
  required: (field) => `${field} is required`,
  string: (field) => `${field} must be a string`,
  maxLength: (field, max) => `${field} must be at most ${max} characters`,
  number: (field) => `${field} must be a number`,
  positive: (field) => `${field} must be >= 0`,
  enum: (field, values) => `${field} must be one of: ${values.join(', ')}`,
  integer: (field) => `${field} must be an integer`,
  boolean: (field) => `${field} must be true or false`
};

function createValidationError(field, message) {
  return { field, message };
}

// Validate lead creation
function validateLeadCreation(req, res, next) {
  const errors = [];
  const body = req.body;

  // name: required, string, max 200 chars
  if (!body.name || typeof body.name !== 'string') {
    errors.push(createValidationError('name', VALIDATION_ERRORS.required('name')));
  } else if (body.name.length > 200) {
    errors.push(createValidationError('name', VALIDATION_ERRORS.maxLength('name', 200)));
  }

  // phone: optional, string, max 50 chars
  if (body.phone !== undefined && body.phone !== null) {
    if (typeof body.phone !== 'string') {
      errors.push(createValidationError('phone', VALIDATION_ERRORS.string('phone')));
    } else if (body.phone.length > 50) {
      errors.push(createValidationError('phone', VALIDATION_ERRORS.maxLength('phone', 50)));
    }
  }

  // email: optional, string, max 200 chars, basic format check
  if (body.email !== undefined && body.email !== null && body.email !== '') {
    if (typeof body.email !== 'string') {
      errors.push(createValidationError('email', VALIDATION_ERRORS.string('email')));
    } else if (body.email.length > 200) {
      errors.push(createValidationError('email', VALIDATION_ERRORS.maxLength('email', 200)));
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.push(createValidationError('email', 'email must be a valid email address'));
    }
  }

  // inquiry: required, string, max 2000 chars
  if (!body.inquiry || typeof body.inquiry !== 'string') {
    errors.push(createValidationError('inquiry', VALIDATION_ERRORS.required('inquiry')));
  } else if (body.inquiry.length > 2000) {
    errors.push(createValidationError('inquiry', VALIDATION_ERRORS.maxLength('inquiry', 2000)));
  }

  // company: optional, string, max 200 chars
  if (body.company !== undefined && body.company !== null) {
    if (typeof body.company !== 'string') {
      errors.push(createValidationError('company', VALIDATION_ERRORS.string('company')));
    } else if (body.company.length > 200) {
      errors.push(createValidationError('company', VALIDATION_ERRORS.maxLength('company', 200)));
    }
  }

  // industry: optional, must be valid enum
  const validIndustries = ['trading', 'retail', 'fnb', 'professional'];
  if (body.industry !== undefined && body.industry !== null) {
    if (!validIndustries.includes(body.industry)) {
      errors.push(createValidationError('industry', VALIDATION_ERRORS.enum('industry', validIndustries)));
    }
  }

  // estimated_value: optional, must be number >= 0
  if (body.estimated_value !== undefined && body.estimated_value !== null) {
    if (typeof body.estimated_value !== 'number' || isNaN(body.estimated_value)) {
      errors.push(createValidationError('estimated_value', VALIDATION_ERRORS.number('estimated_value')));
    } else if (body.estimated_value < 0) {
      errors.push(createValidationError('estimated_value', VALIDATION_ERRORS.positive('estimated_value')));
    } else if (body.estimated_value > 100000000) {
      errors.push(createValidationError('estimated_value', 'estimated_value must be <= 100,000,000'));
    }
  }

  // source: optional, must be valid enum
  const validSources = ['whatsapp', 'website', 'referral', 'manual'];
  if (body.source !== undefined && body.source !== null) {
    if (!validSources.includes(body.source)) {
      errors.push(createValidationError('source', VALIDATION_ERRORS.enum('source', validSources)));
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
}

// Validate lead update (PATCH)
function validateLeadUpdate(req, res, next) {
  const errors = [];
  const body = req.body;

  // Validate lead ID is a positive integer
  const leadId = parseInt(req.params.id, 10);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    errors.push(createValidationError('id', 'Lead ID must be a positive integer'));
  }

  // Security: Reject unknown fields (prevent SQL injection via column names)
  const ALLOWED_LEAD_UPDATE_FIELDS = new Set([
    'status', 'estimated_value', 'qualification_notes', 'assigned_rep',
    'company', 'industry', 'lost_reason'
  ]);
  for (const key of Object.keys(body)) {
    if (!ALLOWED_LEAD_UPDATE_FIELDS.has(key)) {
      errors.push(createValidationError(key, `Field '${key}' is not allowed. Allowed fields: ${Array.from(ALLOWED_LEAD_UPDATE_FIELDS).join(', ')}`));
    }
  }

  // status: optional, must be valid enum
  const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost', 'escalated'];
  if (body.status !== undefined) {
    if (!validStatuses.includes(body.status)) {
      errors.push(createValidationError('status', VALIDATION_ERRORS.enum('status', validStatuses)));
    }
  }

  // estimated_value: optional, must be number >= 0
  if (body.estimated_value !== undefined) {
    if (typeof body.estimated_value !== 'number' || isNaN(body.estimated_value)) {
      errors.push(createValidationError('estimated_value', VALIDATION_ERRORS.number('estimated_value')));
    } else if (body.estimated_value < 0) {
      errors.push(createValidationError('estimated_value', VALIDATION_ERRORS.positive('estimated_value')));
    }
  }

  // industry: optional, must be valid enum
  const validIndustries = ['trading', 'retail', 'fnb', 'professional'];
  if (body.industry !== undefined) {
    if (!validIndustries.includes(body.industry)) {
      errors.push(createValidationError('industry', VALIDATION_ERRORS.enum('industry', validIndustries)));
    }
  }

  // company: optional, string, max 200 chars
  if (body.company !== undefined) {
    if (typeof body.company !== 'string') {
      errors.push(createValidationError('company', VALIDATION_ERRORS.string('company')));
    } else if (body.company.length > 200) {
      errors.push(createValidationError('company', VALIDATION_ERRORS.maxLength('company', 200)));
    }
  }

  // qualification_notes: optional, string, max 5000 chars
  if (body.qualification_notes !== undefined) {
    if (typeof body.qualification_notes !== 'string') {
      errors.push(createValidationError('qualification_notes', VALIDATION_ERRORS.string('qualification_notes')));
    } else if (body.qualification_notes.length > 5000) {
      errors.push(createValidationError('qualification_notes', VALIDATION_ERRORS.maxLength('qualification_notes', 5000)));
    }
  }

  // assigned_rep: optional, string, max 200 chars
  if (body.assigned_rep !== undefined) {
    if (typeof body.assigned_rep !== 'string') {
      errors.push(createValidationError('assigned_rep', VALIDATION_ERRORS.string('assigned_rep')));
    } else if (body.assigned_rep.length > 200) {
      errors.push(createValidationError('assigned_rep', VALIDATION_ERRORS.maxLength('assigned_rep', 200)));
    }
  }

  // lost_reason: optional, string, max 500 chars
  if (body.lost_reason !== undefined) {
    if (typeof body.lost_reason !== 'string') {
      errors.push(createValidationError('lost_reason', VALIDATION_ERRORS.string('lost_reason')));
    } else if (body.lost_reason.length > 500) {
      errors.push(createValidationError('lost_reason', VALIDATION_ERRORS.maxLength('lost_reason', 500)));
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
}

// Validate profile update
function validateProfileUpdate(req, res, next) {
  const errors = [];
  const body = req.body;

  const ALLOWED_PROFILE_FIELDS = new Set([
    'company_name', 'industry', 'languages_supported',
    'follow_up_delay_seconds', 'whatsapp_number', 'auto_follow_up_enabled',
    'qualification_criteria'
  ]);

  // Reject unknown fields
  for (const key of Object.keys(body)) {
    if (!ALLOWED_PROFILE_FIELDS.has(key)) {
      errors.push(createValidationError(key, `Field '${key}' is not allowed. Allowed fields: ${Array.from(ALLOWED_PROFILE_FIELDS).join(', ')}`));
    }
  }

  // company_name: string, max 200 chars
  if (body.company_name !== undefined) {
    if (typeof body.company_name !== 'string') {
      errors.push(createValidationError('company_name', VALIDATION_ERRORS.string('company_name')));
    } else if (body.company_name.length > 200) {
      errors.push(createValidationError('company_name', VALIDATION_ERRORS.maxLength('company_name', 200)));
    }
  }

  // industry: enum
  const validIndustries = ['trading', 'retail', 'fnb', 'professional'];
  if (body.industry !== undefined) {
    if (!validIndustries.includes(body.industry)) {
      errors.push(createValidationError('industry', VALIDATION_ERRORS.enum('industry', validIndustries)));
    }
  }

  // whatsapp_number: string, max 30 chars
  if (body.whatsapp_number !== undefined) {
    if (typeof body.whatsapp_number !== 'string') {
      errors.push(createValidationError('whatsapp_number', VALIDATION_ERRORS.string('whatsapp_number')));
    } else if (body.whatsapp_number.length > 30) {
      errors.push(createValidationError('whatsapp_number', VALIDATION_ERRORS.maxLength('whatsapp_number', 30)));
    }
  }

  // follow_up_delay_seconds: integer, >= 0, <= 86400 (max 24h)
  if (body.follow_up_delay_seconds !== undefined) {
    if (typeof body.follow_up_delay_seconds !== 'number' || !Number.isInteger(body.follow_up_delay_seconds)) {
      errors.push(createValidationError('follow_up_delay_seconds', VALIDATION_ERRORS.integer('follow_up_delay_seconds')));
    } else if (body.follow_up_delay_seconds < 0 || body.follow_up_delay_seconds > 86400) {
      errors.push(createValidationError('follow_up_delay_seconds', 'follow_up_delay_seconds must be between 0 and 86400'));
    }
  }

  // auto_follow_up_enabled: boolean
  if (body.auto_follow_up_enabled !== undefined) {
    if (typeof body.auto_follow_up_enabled !== 'boolean') {
      errors.push(createValidationError('auto_follow_up_enabled', VALIDATION_ERRORS.boolean('auto_follow_up_enabled')));
    }
  }

  // languages_supported: string, max 50 chars
  if (body.languages_supported !== undefined) {
    if (typeof body.languages_supported !== 'string') {
      errors.push(createValidationError('languages_supported', VALIDATION_ERRORS.string('languages_supported')));
    } else if (body.languages_supported.length > 50) {
      errors.push(createValidationError('languages_supported', VALIDATION_ERRORS.maxLength('languages_supported', 50)));
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
}

// Validate message creation
function validateMessageCreation(req, res, next) {
  const errors = [];
  const body = req.body;

  // Validate lead ID is a positive integer
  const leadId = parseInt(req.params.id, 10);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    errors.push(createValidationError('id', 'Lead ID must be a positive integer'));
  }

  // content: required, string, max 5000 chars
  if (!body.content || typeof body.content !== 'string') {
    errors.push(createValidationError('content', VALIDATION_ERRORS.required('content')));
  } else if (body.content.length > 5000) {
    errors.push(createValidationError('content', VALIDATION_ERRORS.maxLength('content', 5000)));
  } else if (body.content.trim().length === 0) {
    errors.push(createValidationError('content', 'content cannot be empty'));
  }

  // direction: required, must be 'inbound' or 'outbound'
  if (!body.direction) {
    errors.push(createValidationError('direction', VALIDATION_ERRORS.required('direction')));
  } else if (!['inbound', 'outbound'].includes(body.direction)) {
    errors.push(createValidationError('direction', VALIDATION_ERRORS.enum('direction', ['inbound', 'outbound'])));
  }

  // language: optional, string, max 10 chars
  if (body.language !== undefined) {
    if (typeof body.language !== 'string') {
      errors.push(createValidationError('language', VALIDATION_ERRORS.string('language')));
    } else if (body.language.length > 10) {
      errors.push(createValidationError('language', VALIDATION_ERRORS.maxLength('language', 10)));
    }
  }

  // ai_generated: optional, must be boolean
  if (body.ai_generated !== undefined) {
    if (typeof body.ai_generated !== 'boolean') {
      errors.push(createValidationError('ai_generated', VALIDATION_ERRORS.boolean('ai_generated')));
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
}

// ===== 3. Rate Limiting =====

// Simple in-memory rate limiter: max 100 requests per 15 minutes per IP
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100;

const requestCounts = new Map(); // ip -> { count, windowStart }

function rateLimiter(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

  const now = Date.now();
  let record = requestCounts.get(clientIp);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    record = { count: 1, windowStart: now };
    requestCounts.set(clientIp, record);
    return next();
  }

  record.count++;

  if (record.count > RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.windowStart)) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Too many requests. Limit: ${RATE_LIMIT_MAX} per 15 minutes. Try again in ${retryAfterSeconds} seconds.`,
      retryAfter: retryAfterSeconds
    });
  }

  // Add rate limit headers for transparency
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_MAX - record.count);

  next();
}

// Cleanup old entries every 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
      requestCounts.delete(ip);
    }
  }
}, 10 * 60 * 1000);

module.exports = {
  apiKeyAuth,
  validateLeadCreation,
  validateLeadUpdate,
  validateProfileUpdate,
  validateMessageCreation,
  rateLimiter,
  API_KEY // Exported for documentation / testing
};
