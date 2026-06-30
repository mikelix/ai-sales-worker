/**
 * AI Sales Worker - Frontend Application (Phase 3A: CEO Demo Polish)
 * Dashboard, Pipeline, Conversations, Settings, CEO Demo Mode
 * + Real funnel, Attention card, Empty states, Confirmation dialogs, Loading indicators, Auto-scroll
 * + Mobile responsive, Landing header, Demo Mode guided walkthrough
 */

const API = '/api';
let currentLeadId = null;
let currentFilter = null;
let dashboardData = null;
let pendingAction = null;
let demoStep = 0; // CEO Demo Mode state

const DEMO_STEPS = [
  {
    title: '1. New Lead Arrives',
    desc: 'A WhatsApp inquiry arrives from a Hong Kong SME customer. The AI detects the language (Cantonese or English) automatically.',
    action: 'Click "New Lead" to create a lead and watch the AI respond instantly.',
    icon: '<svg class="w-8 h-8 text-whatsapp" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>',
    highlight: 'btn-new-lead',
    tab: 'dashboard'
  },
  {
    title: '2. AI Replies Automatically',
    desc: 'Within seconds, the AI Worker sends an acknowledgment in the customer\'s language. Then it follows up with qualification questions.',
    action: 'Click on any lead in the Conversations tab to see the AI\'s bilingual responses.',
    icon: '<svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>',
    highlight: 'conv-lead-list',
    tab: 'conversations'
  },
  {
    title: '3. BANT Score Increases',
    desc: 'Every inbound message is analyzed for Budget, Authority, Need, and Timeline signals. The score increases from 0 to 4.',
    action: 'Type a message like "I need 500 units, budget HKD 50K, my boss approved" to see BANT score jump.',
    icon: '<svg class="w-8 h-8 text-pipeline-qualified" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    highlight: 'chat-messages',
    tab: 'conversations'
  },
  {
    title: '4. Lead Becomes Hot',
    desc: 'When BANT score hits 3+, the lead is auto-qualified. The AI suggests escalation: "I think you\'d benefit from a call with our specialist."',
    action: 'Look at the Pipeline tab — qualified leads are highlighted in green.',
    icon: '<svg class="w-8 h-8 text-hkRed" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>',
    highlight: 'pipe-qualified-count',
    tab: 'pipeline'
  },
  {
    title: '5. CEO Sees "Needs Attention"',
    desc: 'The "Needs Attention Today" card highlights leads ready for action — qualified leads to convert, escalated leads needing a call, stale conversations.',
    action: 'See the green card at the top of the Dashboard — click any lead to take action.',
    icon: '<svg class="w-8 h-8 text-whatsapp" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>',
    highlight: 'attention-card',
    tab: 'dashboard'
  },
  {
    title: '6. CEO Converts the Lead',
    desc: 'One click to convert a qualified lead into revenue. The dashboard updates instantly — conversion rate, revenue, pipeline counts all refresh.',
    action: 'Open a qualified lead\'s conversation and click "Convert" to close the deal.',
    icon: '<svg class="w-8 h-8 text-hkGold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 8v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    highlight: 'btn-convert',
    tab: 'conversations'
  }
];

// ============ Init ============
async function initApp() {
  showLoading('view-dashboard');
  showLoading('view-pipeline');
  await loadDashboard();
  await loadPipeline();
  await loadConversations();
  await loadSettings();
}

// ============ CEO Demo Mode ============
function startDemoMode() {
  demoStep = 0;
  document.getElementById('demo-overlay').classList.remove('hidden');
  renderDemoStep();
}

function exitDemoMode() {
  document.getElementById('demo-overlay').classList.add('hidden');
  // Remove any highlights
  document.querySelectorAll('.demo-highlight').forEach(el => el.classList.remove('demo-highlight'));
}

function renderDemoStep() {
  const step = DEMO_STEPS[demoStep];
  document.getElementById('demo-step-title').textContent = step.title;
  document.getElementById('demo-step-desc').textContent = step.desc;
  document.getElementById('demo-step-action').textContent = step.action;
  document.getElementById('demo-step-icon').innerHTML = step.icon;
  document.getElementById('demo-current').textContent = demoStep + 1;

  // Update step dots
  for (let i = 0; i < 6; i++) {
    const dot = document.getElementById(`demo-step-${i + 1}`);
    dot.className = `w-3 h-3 rounded-full ${i <= demoStep ? 'bg-whatsapp' : 'bg-gray-300'}`;
  }

  // Show/hide prev button
  document.getElementById('btn-demo-prev').style.display = demoStep > 0 ? '' : 'none';

  // Change next button text on last step
  const nextBtn = document.getElementById('btn-demo-next');
  nextBtn.textContent = demoStep === 5 ? 'Finish Demo' : 'Next Step';
}

function demoNextStep() {
  if (demoStep < 5) {
    demoStep++;
    renderDemoStep();
    // Switch to the relevant tab
    switchTab(DEMO_STEPS[demoStep].tab);
  } else {
    exitDemoMode();
    showNotification('Demo complete! Try exploring on your own.', 'success');
  }
}

function demoPrevStep() {
  if (demoStep > 0) {
    demoStep--;
    renderDemoStep();
    switchTab(DEMO_STEPS[demoStep].tab);
  }
}

// ============ Loading Indicators ============
function showLoading(viewId) {
  const el = document.getElementById(viewId);
  if (!el) return;
  const containers = el.querySelectorAll('.bg-white.rounded-xl, .card-polish');
  containers.forEach(c => {
    if (!c.classList.contains('loading-overlay')) {
      c.classList.add('loading-overlay');
    }
  });
}

function hideLoading(viewId) {
  const el = document.getElementById(viewId);
  if (!el) return;
  const containers = el.querySelectorAll('.loading-overlay');
  containers.forEach(c => c.classList.remove('loading-overlay'));
}

function showSpinner(spinnerId) {
  const el = document.getElementById(spinnerId);
  if (el) el.classList.remove('hidden');
}

function hideSpinner(spinnerId) {
  const el = document.getElementById(spinnerId);
  if (el) el.classList.add('hidden');
}

// ============ Empty States ============
function emptyStateHTML(iconSvg, message, actionText, actionFn) {
  const actionBtn = actionText ? `<button onclick="${actionFn}" class="mt-3 btn-smooth bg-whatsapp hover:bg-whatsappDark text-white px-4 py-2 rounded-lg text-sm font-medium">${actionText}</button>` : '';
  return `<div class="empty-state">
    <div class="empty-state-icon">${iconSvg}</div>
    <div class="text-sm text-gray-500">${message}</div>
    ${actionBtn}
  </div>`;
}

const EMPTY_ICONS = {
  leads: '<svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0-5a3 3 0 015.356 1.857M12 12a3 3 0 003-3 3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3zm6 4a3 3 0 01-3-3"/></svg>',
  chat: '<svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>',
  funnel: '<svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 4h18l-6 8v6l-6 2v-8L3 4z"/></svg>',
  table: '<svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>'
};

// ============ Dashboard ============
async function loadDashboard() {
  showLoading('view-dashboard');
  try {
    const res = await fetch(`${API}/dashboard`);
    dashboardData = await res.json();
    renderDashboard(dashboardData);
  } catch (e) {
    console.error('Dashboard load failed:', e);
  }
  hideLoading('view-dashboard');
}

async function loadAttention() {
  try {
    const res = await fetch(`${API}/attention`);
    const attentionData = await res.json();
    renderAttentionCard(attentionData);
  } catch (e) {
    console.error('Attention load failed:', e);
  }
}

function renderAttentionCard(data) {
  const card = document.getElementById('attention-card');
  const itemsDiv = document.getElementById('attention-items');
  const totalSpan = document.getElementById('attention-total');

  if (data.totalAttention === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  totalSpan.textContent = `${data.totalAttention} items`;

  let html = '';

  if (data.newWaiting.length > 0) {
    html += `<div class="text-xs font-semibold text-pipeline-new mb-1 mt-1">New leads awaiting first response (${data.newWaiting.length})</div>`;
    data.newWaiting.forEach(l => {
      html += renderAttentionItem(l, 'Waiting for AI follow-up');
    });
  }

  if (data.readyForAction.length > 0) {
    html += `<div class="text-xs font-semibold text-pipeline-qualified mb-1 mt-1">Ready for conversion/escalation (${data.readyForAction.length})</div>`;
    data.readyForAction.forEach(l => {
      const action = l.status === 'qualified' ? 'Ready to convert' : 'BANT 3+ — consider qualifying';
      html += renderAttentionItem(l, action);
    });
  }

  if (data.escalatedLeads.length > 0) {
    html += `<div class="text-xs font-semibold text-pipeline-escalated mb-1 mt-1">Escalated — CEO call needed (${data.escalatedLeads.length})</div>`;
    data.escalatedLeads.forEach(l => {
      html += renderAttentionItem(l, 'Call this lead today');
    });
  }

  if (data.staleLeads.length > 0) {
    html += `<div class="text-xs font-semibold text-pipeline-contacted mb-1 mt-1">Stale conversations (>24h no response) (${data.staleLeads.length})</div>`;
    data.staleLeads.forEach(l => {
      html += renderAttentionItem(l, 'Send follow-up reminder');
    });
  }

  itemsDiv.innerHTML = html;
}

function renderAttentionItem(lead, reason) {
  return `<div class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer" onclick="openConversation(${lead.id})">
    <div class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">${lead.name.charAt(0)}</div>
    <div class="flex-1 min-w-0">
      <div class="text-sm font-medium text-gray-700 truncate">${lead.name}</div>
      <div class="text-xs text-gray-400 truncate">${reason}</div>
    </div>
    <span class="status-badge bg-${statusColor(lead.status)}/10 text-${statusColor(lead.status)}">${statusLabel(lead.status)}</span>
    <span class="text-xs text-gray-400">HKD ${formatNumber(lead.estimated_value)}</span>
  </div>`;
}

function renderDashboard(data) {
  document.getElementById('kpi-leads').textContent = data.totalLeads;
  document.getElementById('kpi-leads-sub').textContent = `Today: ${data.dailyLeads?.[0]?.count || 0}`;
  document.getElementById('kpi-response').textContent = `${data.responseRate}%`;
  document.getElementById('kpi-response-time').textContent = data.avgResponseTimeSeconds ? `${Math.round(data.avgResponseTimeSeconds / 60)}min` : '-';
  document.getElementById('kpi-conversion').textContent = `${data.conversionRate}%`;
  document.getElementById('kpi-qualified').textContent = data.qualified;
  document.getElementById('kpi-revenue').textContent = `HKD ${formatNumber(data.totalRevenue)}`;
  document.getElementById('kpi-pipeline').textContent = formatNumber(data.pipelineValue);

  // Real pipeline funnel counts from DB
  const funnel = document.getElementById('pipeline-funnel');
  const pc = data.pipelineCounts || {};

  if (data.totalLeads === 0) {
    funnel.innerHTML = emptyStateHTML(EMPTY_ICONS.funnel, 'No leads in pipeline yet.', 'Add First Lead', 'openNewLeadModal()');
  } else {
    const stages = [
      { label: 'New', count: pc.new || 0, color: 'bg-pipeline-new' },
      { label: 'Contacted', count: pc.contacted || 0, color: 'bg-pipeline-contacted' },
      { label: 'Qualified', count: pc.qualified || 0, color: 'bg-pipeline-qualified' },
      { label: 'Converted', count: pc.converted || 0, color: 'bg-pipeline-converted' }
    ];
    const maxCount = Math.max(...stages.map(s => s.count), 1);
    funnel.innerHTML = stages.map(s => {
      const widthPct = data.totalLeads > 0 ? Math.max(15, (s.count / maxCount) * 100) : 15;
      return `<div class="flex items-center gap-3">
        <span class="text-xs text-gray-500 w-20">${s.label}</span>
        <div class="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
          <div class="${s.color} h-4 rounded-full transition-all duration-300" style="width:${widthPct}%"></div>
        </div>
        <span class="text-xs font-medium text-gray-700 w-8">${s.count}</span>
      </div>`;
    }).join('');
  }

  // Industry breakdown
  const industryDiv = document.getElementById('industry-breakdown');
  if (data.industryBreakdown && data.industryBreakdown.length > 0) {
    const industries = { trading: 'Trading', retail: 'Retail', fnb: 'F&B', professional: 'Professional' };
    industryDiv.innerHTML = data.industryBreakdown.map(ib => {
      const pct = data.totalLeads > 0 ? (ib.count / data.totalLeads * 100) : 0;
      return `<div class="flex items-center gap-3">
        <span class="text-xs text-gray-500 w-24">${industries[ib.industry] || ib.industry}</span>
        <div class="flex-1 bg-gray-100 rounded-full h-3 relative overflow-hidden">
          <div class="bg-whatsapp h-3 rounded-full transition-all duration-300" style="width:${pct}%"></div>
        </div>
        <span class="text-xs font-medium text-gray-700">${ib.count} | HKD ${formatNumber(ib.total_value)}</span>
      </div>`;
    }).join('');
  } else if (data.totalLeads === 0) {
    industryDiv.innerHTML = emptyStateHTML(EMPTY_ICONS.funnel, 'No industry data yet.');
  }

  // Recent leads
  const recentDiv = document.getElementById('recent-leads');
  fetch(`${API}/leads`).then(r => r.json()).then(leads => {
    if (leads.length === 0) {
      recentDiv.innerHTML = emptyStateHTML(EMPTY_ICONS.leads, 'No leads yet. Create your first one!', 'Add Lead', 'openNewLeadModal()');
    } else {
      recentDiv.innerHTML = leads.slice(0, 5).map(l => `
        <div class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer" onclick="openConversation(${l.id})">
          <div class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">${l.name.charAt(0)}</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-700 truncate">${l.name}</div>
            <div class="text-xs text-gray-400 truncate">${l.inquiry.substring(0, 40)}${l.inquiry.length > 40 ? '...' : ''}</div>
          </div>
          <span class="status-badge bg-${statusColor(l.status)}/10 text-${statusColor(l.status)}">${statusLabel(l.status)}</span>
        </div>
      `).join('');
    }
  });

  // Daily trend bar chart
  const trendDiv = document.getElementById('daily-trend');
  if (data.dailyLeads && data.dailyLeads.length > 0) {
    const maxCount = Math.max(...data.dailyLeads.map(d => d.count), 1);
    trendDiv.innerHTML = data.dailyLeads.reverse().map(d => {
      const height = Math.max(8, (d.count / maxCount) * 100);
      const dateLabel = d.date.substring(5);
      return `<div class="flex-1 flex flex-col items-center gap-1">
        <span class="text-xs font-medium text-gray-700">${d.count}</span>
        <div class="w-full bg-whatsapp/80 rounded-t transition-all duration-300" style="height:${height}px"></div>
        <span class="text-xs text-gray-400">${dateLabel}</span>
      </div>`;
    }).join('');
  } else {
    trendDiv.innerHTML = emptyStateHTML(EMPTY_ICONS.funnel, 'No daily trend data yet.');
  }

  // Load attention card after dashboard
  loadAttention();
}

// ============ Pipeline ============
async function loadPipeline() {
  showLoading('view-pipeline');
  try {
    const res = await fetch(`${API}/pipeline`);
    const data = await res.json();

    for (const [stage, count] of Object.entries(data.counts)) {
      const el = document.getElementById(`pipe-${stage}-count`);
      if (el) el.textContent = count;
    }
    for (const [stage, value] of Object.entries(data.values)) {
      const el = document.getElementById(`pipe-${stage}-value`);
      if (el) el.textContent = formatNumber(value);
    }

    const leadsRes = await fetch(`${API}/leads${currentFilter ? `?status=${currentFilter}` : ''}`);
    const leads = await leadsRes.json();
    renderLeadsTable(leads);
  } catch (e) {
    console.error('Pipeline load failed:', e);
  }
  hideLoading('view-pipeline');
}

function renderLeadsTable(leads) {
  const tbody = document.getElementById('leads-table');
  if (leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8">
      ${emptyStateHTML(EMPTY_ICONS.table, 'No leads in this pipeline stage.', 'Add New Lead', 'openNewLeadModal()')}
    </td></tr>`;
    return;
  }
  tbody.innerHTML = leads.map(l => `
    <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
      <td class="px-4 py-3">
        <div class="font-medium text-gray-800">${l.name}</div>
        <div class="text-xs text-gray-400">${l.company || '-'} | ${l.phone || '-'}</div>
      </td>
      <td class="px-4 py-3 text-gray-600">${sourceLabel(l.source)}</td>
      <td class="px-4 py-3 text-gray-600 max-w-xs truncate">${l.inquiry}</td>
      <td class="px-4 py-3">
        <span class="status-badge bg-${statusColor(l.status)}/10 text-${statusColor(l.status)}">${statusLabel(l.status)}</span>
      </td>
      <td class="px-4 py-3 font-medium ${l.estimated_value > 0 ? 'text-hkRed' : 'text-gray-400'}">HKD ${formatNumber(l.estimated_value)}</td>
      <td class="px-4 py-3">
        <div class="flex gap-1">
          ${[1,2,3,4].map(i => `<span class="w-3 h-3 rounded-full transition-all ${l.qualification_score >= i ? 'bg-green-500' : 'bg-gray-200'}"></span>`).join('')}
        </div>
      </td>
      <td class="px-4 py-3 text-xs text-gray-400">${formatDate(l.created_at)}</td>
      <td class="px-4 py-3">
        <button onclick="openConversation(${l.id})" class="text-xs text-whatsapp hover:text-whatsappDark transition-colors">Chat</button>
        <button onclick="triggerAiFollowupFor(${l.id})" class="text-xs text-blue-600 hover:text-blue-800 ml-2 transition-colors">AI</button>
      </td>
    </tr>
  `).join('');
}

function filterPipeline(status) {
  currentFilter = status;
  loadPipeline();
}

// ============ Conversations ============
async function loadConversations() {
  try {
    const res = await fetch(`${API}/leads`);
    const leads = await res.json();
    const list = document.getElementById('conv-lead-list');

    if (leads.length === 0) {
      list.innerHTML = `<div class="p-4">
        ${emptyStateHTML(EMPTY_ICONS.chat, 'No conversations yet. Create a lead to start!', 'Add Lead', 'openNewLeadModal()')}
      </div>`;
      return;
    }

    list.innerHTML = leads.map(l => `
      <div class="px-4 py-3 hover:bg-whatsapp/5 cursor-pointer flex items-center gap-3 transition-colors ${currentLeadId === l.id ? 'bg-whatsapp/10 border-l-2 border-whatsapp' : ''}" onclick="openConversation(${l.id})">
        <div class="w-9 h-9 rounded-full bg-whatsapp/10 flex items-center justify-center text-whatsapp font-semibold text-sm">${l.name.charAt(0)}</div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-800">${l.name}</div>
          <div class="text-xs text-gray-400 truncate">${l.last_message_at ? l.inquiry.substring(0, 30) + '...' : 'No messages yet'}</div>
        </div>
        <div class="flex flex-col items-end gap-1">
          <span class="status-badge bg-${statusColor(l.status)}/10 text-${statusColor(l.status)} text-xs">${statusLabel(l.status)}</span>
          <span class="text-xs text-gray-300">${formatTime(l.last_message_at)}</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Conversations load failed:', e);
  }
}

async function openConversation(leadId) {
  currentLeadId = leadId;

  const chatDiv = document.getElementById('chat-messages');
  chatDiv.innerHTML = '<div class="flex justify-center py-10"><div class="loading-spinner" style="width:32px;height:32px;"></div></div>';

  try {
    const lead = await (await fetch(`${API}/leads/${leadId}`)).json();
    const messages = await (await fetch(`${API}/leads/${leadId}/messages`)).json();

    document.getElementById('chat-lead-name').textContent = lead.name;
    document.getElementById('chat-lead-company').textContent = `${lead.company || 'Individual'} | ${lead.phone || ''} | ${statusLabel(lead.status)}`;
    document.getElementById('chat-avatar').textContent = lead.name.charAt(0);

    // Show/hide action buttons
    document.getElementById('btn-ai-followup').classList.toggle('hidden', lead.status === 'converted' || lead.status === 'lost');
    document.getElementById('btn-convert').classList.toggle('hidden', lead.status !== 'qualified');
    document.getElementById('btn-lost').classList.toggle('hidden', lead.status === 'converted' || lead.status === 'lost');

    if (messages.length === 0) {
      chatDiv.innerHTML = emptyStateHTML(EMPTY_ICONS.chat, 'No messages yet. Send a message or trigger AI follow-up.');
    } else {
      chatDiv.innerHTML = messages.map(m => renderMessageBubble(m)).join('');
    }

    scrollToBottom(chatDiv);
    loadConversations();
    switchTab('conversations');
  } catch (e) {
    console.error('Conversation load failed:', e);
    chatDiv.innerHTML = '<div class="text-center text-red-400 text-sm py-10">Failed to load conversation. Please try again.</div>';
  }
}

function scrollToBottom(el) {
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
}

function renderMessageBubble(msg) {
  const isInbound = msg.direction === 'inbound';
  const isAi = msg.ai_generated;
  const time = formatTime(msg.created_at);

  if (isInbound) {
    return `<div class="flex gap-2 max-w-[80%]">
      <div class="wa-chat-bubble-in px-3 py-2">
        <div class="text-sm text-gray-800">${msg.content}</div>
        <div class="text-xs text-gray-500 mt-1 text-right">${time}</div>
      </div>
    </div>`;
  }

  if (isAi) {
    return `<div class="flex gap-2 max-w-[80%] ml-auto">
      <div class="wa-chat-bubble-ai px-3 py-2">
        <div class="flex items-center gap-1 mb-1">
          <svg class="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/></svg>
          <span class="text-xs text-blue-500 font-medium">AI Worker</span>
          ${msg.template_used ? `<span class="text-xs text-blue-400">${msg.template_used}</span>` : ''}
        </div>
        <div class="text-sm text-gray-800">${msg.content}</div>
        <div class="text-xs text-gray-400 mt-1 text-right">${time}</div>
      </div>
    </div>`;
  }

  return `<div class="flex gap-2 max-w-[80%] ml-auto">
    <div class="wa-chat-bubble-out px-3 py-2">
      <div class="text-sm text-gray-800">${msg.content}</div>
      <div class="text-xs text-gray-400 mt-1 text-right">${time}</div>
    </div>
  </div>`;
}

// ============ Message Sending ============
async function sendInbound() {
  if (!currentLeadId) return;
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content) return;

  input.value = '';
  showSpinner('spinner-send');

  try {
    const res = await fetch(`${API}/leads/${currentLeadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: 'inbound', content, auto_reply: true })
    });
    await res.json();

    await openConversation(currentLeadId);
    await loadDashboard();
    await loadPipeline();
  } catch (e) {
    console.error('Send failed:', e);
  }
  hideSpinner('spinner-send');
}

async function sendManualOutbound() {
  if (!currentLeadId) return;
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content) return;

  input.value = '';
  showSpinner('spinner-send');

  try {
    const res = await fetch(`${API}/leads/${currentLeadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: 'outbound', content, ai_generated: false })
    });
    await res.json();

    await openConversation(currentLeadId);
    await loadDashboard();
  } catch (e) {
    console.error('Send failed:', e);
  }
  hideSpinner('spinner-send');
}

async function triggerAiFollowup() {
  if (!currentLeadId) return;
  try {
    const res = await fetch(`${API}/leads/${currentLeadId}/ai-followup`, { method: 'POST' });
    const data = await res.json();

    if (data.message) {
      await openConversation(currentLeadId);
      await loadDashboard();
      await loadPipeline();
    } else {
      showNotification(data.reason || 'No follow-up needed at this stage', 'warning');
    }
  } catch (e) {
    console.error('AI followup failed:', e);
  }
}

async function triggerAiFollowupFor(leadId) {
  try {
    const res = await fetch(`${API}/leads/${leadId}/ai-followup`, { method: 'POST' });
    const data = await res.json();
    if (data.message) {
      await loadPipeline();
      await loadDashboard();
      showNotification('AI follow-up sent!');
    } else {
      showNotification(data.reason || 'No follow-up needed', 'warning');
    }
  } catch (e) {
    console.error('AI followup failed:', e);
  }
}

// ============ Confirmation Dialogs ============
function confirmAction(actionType) {
  if (!currentLeadId) return;
  pendingAction = { type: actionType, leadId: currentLeadId };

  const icon = document.getElementById('confirm-icon');
  const title = document.getElementById('confirm-title');
  const message = document.getElementById('confirm-message');
  const detail = document.getElementById('confirm-detail');
  const btn = document.getElementById('confirm-btn');

  const chatName = document.getElementById('chat-lead-name').textContent;
  const chatCompany = document.getElementById('chat-lead-company').textContent;

  if (actionType === 'convert') {
    icon.className = 'w-10 h-10 rounded-full flex items-center justify-center bg-red-50';
    icon.innerHTML = '<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    title.textContent = 'Mark as Converted';
    message.textContent = `Are you sure you want to mark ${chatName} as converted?`;
    detail.textContent = `This confirms ${chatName} has become a paying customer. This action cannot be undone. | ${chatCompany}`;
    btn.className = 'btn-smooth bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex-1';
    btn.textContent = 'Confirm Conversion';
  } else if (actionType === 'lost') {
    icon.className = 'w-10 h-10 rounded-full flex items-center justify-center bg-gray-100';
    icon.innerHTML = '<svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
    title.textContent = 'Mark as Lost';
    message.textContent = `Are you sure you want to mark ${chatName} as lost?`;
    detail.textContent = `This lead will be moved to the lost pipeline. This action cannot be undone. | ${chatCompany}`;
    btn.className = 'btn-smooth bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex-1';
    btn.textContent = 'Confirm Lost';
  }

  document.getElementById('modal-confirm').classList.remove('hidden');
}

function cancelConfirmation() {
  pendingAction = null;
  document.getElementById('modal-confirm').classList.add('hidden');
}

async function executeConfirmedAction() {
  if (!pendingAction) return;

  const { type, leadId } = pendingAction;
  document.getElementById('modal-confirm').classList.add('hidden');

  if (type === 'convert') {
    await fetch(`${API}/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'converted' })
    });
    showNotification(`Lead converted! Revenue added to dashboard.`, 'success');
  } else if (type === 'lost') {
    await fetch(`${API}/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'lost', lost_reason: 'Manual mark by CEO' })
    });
    showNotification('Lead marked as lost.', 'info');
  }

  pendingAction = null;
  await openConversation(leadId);
  await loadDashboard();
  await loadPipeline();
}

// ============ New Lead ============
function openNewLeadModal() {
  document.getElementById('modal-new-lead').classList.remove('hidden');
}

function closeNewLeadModal() {
  document.getElementById('modal-new-lead').classList.add('hidden');
}

async function submitNewLead() {
  const data = {
    name: document.getElementById('lead-name').value.trim(),
    phone: document.getElementById('lead-phone').value.trim(),
    company: document.getElementById('lead-company').value.trim(),
    industry: document.getElementById('lead-industry').value,
    inquiry: document.getElementById('lead-inquiry').value.trim(),
    estimated_value: parseFloat(document.getElementById('lead-value').value) || 0,
    source: 'whatsapp'
  };

  if (!data.name) {
    showNotification('Name is required', 'error');
    return;
  }
  if (!data.inquiry) {
    showNotification('Inquiry message is required', 'error');
    return;
  }

  showSpinner('spinner-new-lead');

  try {
    const res = await fetch(`${API}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();

    if (res.ok) {
      closeNewLeadModal();
      document.getElementById('lead-name').value = '';
      document.getElementById('lead-phone').value = '';
      document.getElementById('lead-company').value = '';
      document.getElementById('lead-inquiry').value = '';
      document.getElementById('lead-value').value = '0';

      await openConversation(result.lead.id);
      await loadDashboard();
      await loadPipeline();

      showNotification(`New lead created: ${data.name}. AI auto-follow-up sent!`, 'success');
    } else {
      showNotification(result.error || 'Failed to create lead', 'error');
    }
  } catch (e) {
    showNotification('Failed to create lead. Please try again.', 'error');
  }
  hideSpinner('spinner-new-lead');
}

// ============ Settings ============
async function loadSettings() {
  try {
    const profile = await (await fetch(`${API}/profile`)).json();
    document.getElementById('setting-company').value = profile.company_name;
    document.getElementById('setting-industry').value = profile.industry;
    document.getElementById('setting-whatsapp').value = profile.whatsapp_number;
    document.getElementById('setting-lang-en').checked = profile.languages_supported.includes('en');
    document.getElementById('setting-lang-zhHK').checked = profile.languages_supported.includes('zh-HK');
    document.getElementById('setting-auto-followup').checked = profile.auto_follow_up_enabled;
    document.getElementById('setting-delay').value = profile.follow_up_delay_seconds;
  } catch (e) {
    console.error('Settings load failed:', e);
  }
}

async function saveSettings() {
  const langs = [];
  if (document.getElementById('setting-lang-en').checked) langs.push('en');
  if (document.getElementById('setting-lang-zhHK').checked) langs.push('zh-HK');

  try {
    await fetch(`${API}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: document.getElementById('setting-company').value,
        industry: document.getElementById('setting-industry').value,
        whatsapp_number: document.getElementById('setting-whatsapp').value,
        languages_supported: langs.join(','),
        auto_follow_up_enabled: document.getElementById('setting-auto-followup').checked ? 1 : 0,
        follow_up_delay_seconds: parseInt(document.getElementById('setting-delay').value)
      })
    });
    showNotification('Settings saved', 'success');
  } catch (e) {
    showNotification('Failed to save settings', 'error');
  }
}

// ============ Tab Navigation ============
function switchTab(tab) {
  const tabs = ['dashboard', 'pipeline', 'conversations', 'settings'];
  tabs.forEach(t => {
    document.getElementById(`view-${t}`).classList.toggle('hidden', t !== tab);
    document.getElementById(`tab-${t}`).className = t === tab ? 'tab-btn py-3 px-1 text-sm font-medium tab-active' : 'tab-btn py-3 px-1 text-sm font-medium tab-inactive';
  });

  if (tab === 'conversations' && !currentLeadId) {
    fetch(`${API}/leads`).then(r => r.json()).then(leads => {
      if (leads.length > 0) openConversation(leads[0].id);
    });
  }
}

// ============ Utilities ============
function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toLocaleString();
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-HK', { month: 'short', day: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit' });
}

function statusColor(status) {
  const colors = { new: 'pipeline-new', contacted: 'pipeline-contacted', qualified: 'pipeline-qualified', converted: 'pipeline-converted', lost: 'pipeline-lost', escalated: 'pipeline-escalated' };
  return colors[status] || 'gray-400';
}

function statusLabel(status) {
  const labels = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', converted: 'Converted', lost: 'Lost', escalated: 'Escalated' };
  return labels[status] || status;
}

function sourceLabel(source) {
  const labels = { whatsapp: 'WhatsApp', website: 'Website', referral: 'Referral', manual: 'Manual' };
  return labels[source] || source;
}

function showNotification(msg, type = 'success') {
  const notif = document.createElement('div');
  const bgColors = {
    success: 'bg-whatsapp',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };
  notif.className = `fixed top-4 right-4 ${bgColors[type] || bgColors.success} text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50 fade-in`;
  notif.textContent = msg;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// ============ Start ============
initApp();
