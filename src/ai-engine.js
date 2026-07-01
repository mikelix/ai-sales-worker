/**
 * AI Sales Lead Follow-up Engine
 * Generates contextual, personalized messages for HK SMEs
 * Supports Cantonese (zh-HK) and English
 */

// Language detection from inquiry text
function detectLanguage(text) {
  // Cantonese-specific characters and patterns
  const cantonesePatterns = /[嘅咗喺呢嗰冇乜噫啦囉囡咁嗮]/;
  // General Chinese characters (used in both Cantonese and Mandarin)
  const chineseChars = /[\u4e00-\u9fff]/;
  // Common Cantonese phrases
  const cantonesePhrases = /幾多|咩|係咁|可以|唔|嘅|呢|嗰|查詢|報價|採購|批發|幾錢|有冇|想|請問/;

  if (cantonesePatterns.test(text)) return 'zh-HK';
  if (cantonesePhrases.test(text)) return 'zh-HK';
  if (chineseChars.test(text)) return 'zh-HK';
  return 'en';
}

// Industry context templates
const industryContext = {
  trading: {
    en: {
      products: 'electronic components, hardware, wholesale goods',
      painPoints: 'pricing, bulk order discounts, delivery timeline, quality assurance',
      qualifiers: 'order volume, product specifications, delivery schedule, budget'
    },
    'zh-HK': {
      products: '電子零件、五金配件、批發貨品',
      painPoints: '批發價、大量訂購折扣、交貨時間、質量保證',
      qualifiers: '訂購數量、產品規格、交貨日期、預算'
    }
  },
  retail: {
    en: {
      products: 'display equipment, retail fixtures, POS systems',
      painPoints: 'display quality, durability, setup time, cost per unit',
      qualifiers: 'store count, display type, quantity, installation needs'
    },
    'zh-HK': {
      products: '陳列設備、零售傢俱、POS系統',
      painPoints: '陳列質量、耐用度、安裝時間、單位成本',
      qualifiers: '店舖數量、陳列類型、數量、安裝需求'
    }
  },
  fnb: {
    en: {
      products: 'kitchen equipment, tableware, F&B supplies',
      painPoints: 'food safety standards, equipment reliability, bulk pricing',
      qualifiers: 'restaurant type, seating capacity, equipment list, budget'
    },
    'zh-HK': {
      products: '廚房設備、餐具、餐飲用品',
      painPoints: '食物安全標準、設備可靠性、批發價格',
      qualifiers: '餐廳類型、座位數量、設備清單、預算'
    }
  },
  professional: {
    en: {
      products: 'office equipment, IT systems, corporate supplies',
      painPoints: 'reliability, after-sales support, corporate pricing, integration',
      qualifiers: 'team size, current setup, budget range, timeline'
    },
    'zh-HK': {
      products: '辦公設備、IT系統、企業用品',
      painPoints: '可靠性、售後支援、企業定價、系統整合',
      qualifiers: '團隊人數、現有設備、預算範圍、時間表'
    }
  }
};

// Message templates
const templates = {
  // Initial acknowledgment (sent immediately)
  acknowledgment: {
    en: (name, company) =>
      `Hi ${name}! Thanks for reaching out${company ? ` to ${company}` : ''}. I'm your AI assistant here. I'll get back to you with details shortly!`,
    'zh-HK': (name, company) =>
      `${name}你好！多謝你嘅查詢${company ? `（${company}）` : ''}。我係你嘅AI助手，我會即刻跟進，稍後回覆你！`
  },

  // Personalized follow-up (sent within 5 min)
  initial_followup: {
    en: (name, inquiry, industry) => {
      const ctx = industryContext[industry]?.en || industryContext.trading.en;
      return `Hi ${name}! Thanks for your inquiry about "${inquiry}".

I can help you with that. To give you the most relevant options, a few quick questions:

1. What specific ${ctx.products.split(',')[0]} are you looking for?
2. What's your approximate order volume or quantity?
3. Any timeline requirements for delivery?

Once I have these details, I'll prepare a tailored quote for you right away.`;
    },
    'zh-HK': (name, inquiry, industry) => {
      const ctx = industryContext[industry]?.['zh-HK'] || industryContext.trading['zh-HK'];
      return `${name}你好！收到你嘅查詢：「${inquiry}」

我可以幫你處理。為咗俾你最合適嘅選擇，想問幾個簡單問題：

1. 你需要邊款${ctx.products.split(',')[0]}？
2. 大約幾多數量？
3. 幾時需要到貨？

有咗呢啲資料，我就可以即刻幫你準備報價。`;
    }
  },

  // BANT qualification follow-up
  qualification_bant: {
    en: (name, leadInfo) => {
      const budgetQ = leadInfo.qualification_progress?.budget ? '' : '1) What\'s your budget range for this order?';
      const authorityQ = leadInfo.qualification_progress?.authority ? '' : '2) Are you the decision-maker for this purchase, or should I include someone else in the conversation?';
      const needQ = leadInfo.qualification_progress?.need ? '' : '3) Can you share more details about what you specifically need?';
      const timelineQ = leadInfo.qualification_progress?.timeline ? '' : '4) When do you need this delivered?';

      const questions = [budgetQ, authorityQ, needQ, timelineQ].filter(q => q).join('\n');
      if (!questions) return null; // All qualified already

      return `Great, ${name}! Thanks for the details so far. Just a few more questions so I can make sure we get you exactly what you need:

${questions}

No pressure - just helps me match the best options for you.`;
    },
    'zh-HK': (name, leadInfo) => {
      const budgetQ = leadInfo.qualification_progress?.budget ? '' : '1) 呢個訂單嘅預算範圍係幾多？';
      const authorityQ = leadInfo.qualification_progress?.authority ? '' : '2) 你係呢個採購嘅決策人嗎？定係需要包括其他同事？';
      const needQ = leadInfo.qualification_progress?.need ? '' : '3) 可以分享下你具體需要咩嗎？';
      const timelineQ = leadInfo.qualification_progress?.timeline ? '' : '4) 你幾時需要到貨？';

      const questions = [budgetQ, authorityQ, needQ, timelineQ].filter(q => q).join('\n');
      if (!questions) return null;

      return `${name}，收到！多謝你提供嘅資料。想再問幾個問題，確保我俾到你最合適嘅選擇：

${questions}

唔緊要，慢慢答就得，幫我更好幫你。`;
    }
  },

  // Qualification complete - escalate to human
  escalation: {
    en: (name, company) =>
      `Hi ${name}! Based on everything we've discussed, I think you'd benefit from a direct conversation with our sales specialist who can finalize the details and get you the best deal. Shall I arrange a quick call?`,
    'zh-HK': (name, company) =>
      `${name}你好！根據我們討論嘅內容，我建議你同我哋嘅銷售專員直接傾，佢可以幫你搞掂細節同俾你最優惠嘅價格。要我安排一個通話嗎？`
  },

  // Conversion confirmation
  conversion_confirm: {
    en: (name) =>
      `Excellent news, ${name}! I'm glad we could help. Our team will follow up with the final paperwork and delivery schedule. If you need anything else, just message us here anytime.`,
    'zh-HK': (name) =>
      `${name}，好消息！好開心可以幫到你。我哋嘅團隊會跟進最後嘅文件同交貨安排。如果有任何需要，隨時喺呢度留言就得。`
  },

  // No response follow-up (after 24h)
  no_response_reminder: {
    en: (name) =>
      `Hi ${name}! Just checking in - did you get my previous message? No rush, just wanted to make sure I can help you with what you need. Feel free to reply whenever convenient.`,
    'zh-HK': (name) =>
      `${name}你好！想跟進一下 - 你有收到我之前嘅消息嗎？唔急，只想確認下可以幫到你。方便嘅時候回覆就得。`
  }
};

// Conversation handler - determines what message to send based on lead state
function generateNextMessage(lead, inboundMessage = null) {
  const lang = lead.language || 'en';
  const industry = lead.industry || 'trading';
  const name = lead.name;

  // Parse qualification progress from notes
  let qualificationProgress = {};
  if (lead.qualification_notes) {
    try { qualificationProgress = JSON.parse(lead.qualification_notes); } catch (e) {}
  }

  // Handle inbound message and determine next step
  if (inboundMessage) {
    const analysis = analyzeInboundMessage(inboundMessage, lang);

    // Update qualification progress based on inbound
    if (analysis.budgetHint) qualificationProgress.budget = true;
    if (analysis.authorityHint) qualificationProgress.authority = true;
    if (analysis.needHint) qualificationProgress.need = true;
    if (analysis.timelineHint) qualificationProgress.timeline = true;

    // Count how many BANT criteria are met
    const bantScore = Object.values(qualificationProgress).filter(v => v).length;

    // Determine response based on lead status and qualification progress
    if (lead.status === 'new') {
      // First response to a new lead
      const content = templates.initial_followup[lang](name, lead.inquiry, industry);
      return {
        content,
        language: lang,
        ai_generated: true,
        template_used: `initial_followup_${lang === 'zh-HK' ? 'zhHK' : 'en'}`,
        newStatus: 'contacted',
        qualificationProgress,
        bantScore
      };
    }

    if (lead.status === 'contacted') {
      // Continue qualification
      if (bantScore >= 3) {
        // Sufficiently qualified - escalate
        const content = templates.escalation[lang](name, lead.company);
        return {
          content,
          language: lang,
          ai_generated: true,
          template_used: `escalation_${lang === 'zh-HK' ? 'zhHK' : 'en'}`,
          newStatus: 'qualified',
          qualificationProgress,
          bantScore
        };
      }

      // Need more qualification
      const content = templates.qualification_bant[lang](name, {
        qualification_progress: qualificationProgress
      });
      if (content) {
        return {
          content,
          language: lang,
          ai_generated: true,
          template_used: `qualification_bant_${lang === 'zh-HK' ? 'zhHK' : 'en'}`,
          newStatus: 'contacted',
          qualificationProgress,
          bantScore
        };
      }
    }

    if (lead.status === 'qualified') {
      // Lead is qualified, respond to ongoing conversation
      return {
        content: lang === 'en'
          ? `Thanks for the update, ${name}! I'll make sure our team has this information. We'll reach out to finalize the details.`
          : `多謝你嘅更新，${name}！我會確保我哋嘅團隊收到呢啲資料。佢哋會同你聯絡搞掂細節。`,
        language: lang,
        ai_generated: true,
        template_used: 'qualified_followup',
        newStatus: 'qualified',
        qualificationProgress,
        bantScore
      };
    }

    // Default: contextual response based on analysis
    return {
      content: lang === 'en'
        ? `Thanks, ${name}! I've noted that. Let me process this and get back to you shortly.`
        : `收到，${name}！我記落咗。等我處理一下，稍後回覆你。`,
      language: lang,
      ai_generated: true,
      template_used: 'contextual_response',
      newStatus: lead.status,
      qualificationProgress,
      bantScore
    };
  }

  // No inbound message - generate proactive follow-up based on status
  // Preserve existing qualification_score when no new BANT signals to analyze
  const existingScore = lead.qualification_score || 0;

  if (lead.status === 'new') {
    const content = templates.initial_followup[lang](name, lead.inquiry, industry);
    return {
      content,
      language: lang,
      ai_generated: true,
      template_used: `initial_followup_${lang === 'zh-HK' ? 'zhHK' : 'en'}`,
      newStatus: 'contacted',
      qualificationProgress,
      bantScore: existingScore
    };
  }

  if (lead.status === 'contacted' && !qualificationProgress.budget) {
    const content = templates.qualification_bant[lang](name, { qualification_progress: qualificationProgress });
    if (content) {
      return {
        content,
        language: lang,
        ai_generated: true,
        template_used: `qualification_bant_${lang === 'zh-HK' ? 'zhHK' : 'en'}`,
        newStatus: 'contacted',
        qualificationProgress,
        bantScore: Math.max(existingScore, Object.values(qualificationProgress).filter(v => v).length)
      };
    }
  }

  return null; // No message needed
}

// Analyze inbound message for BANT signals
function analyzeInboundMessage(text, lang) {
  const analysis = {
    budgetHint: false,
    authorityHint: false,
    needHint: false,
    timelineHint: false,
    sentiment: 'neutral',
    intent: 'unknown'
  };

  const lower = text.toLowerCase();

  // Budget signals
  const budgetSignalsEn = ['budget', 'cost', 'price', 'how much', 'afford', 'invest', 'dollar', 'hkd', 'money', 'cheap', 'expensive'];
  const budgetSignalsZh = ['預算', '幾錢', '價錢', '成本', '費用', '錢', '多少錢', '平', '貴'];
  if (budgetSignalsEn.some(s => lower.includes(s)) || budgetSignalsZh.some(s => text.includes(s))) {
    analysis.budgetHint = true;
  }

  // Authority signals
  const authSignalsEn = ['i decide', 'my decision', 'i\'m the', 'boss', 'manager', 'director', 'owner', 'we will', 'approve'];
  const authSignalsZh = ['我決定', '決策', '老闆', '經理', '負責人', '我係', '批准'];
  if (authSignalsEn.some(s => lower.includes(s)) || authSignalsZh.some(s => text.includes(s))) {
    analysis.authorityHint = true;
  }

  // Need signals
  const needSignalsEn = ['need', 'require', 'looking for', 'want', 'must have', 'important', 'essential', 'specific'];
  const needSignalsZh = ['需要', '要求', '想', '要', '必須', '重要', '特定', '指定'];
  if (needSignalsEn.some(s => lower.includes(s)) || needSignalsZh.some(s => text.includes(s))) {
    analysis.needHint = true;
  }

  // Timeline signals
  const timelineSignalsEn = ['deadline', 'asap', 'urgent', 'by', 'within', 'weeks', 'months', 'days', 'soon', 'tomorrow', 'next week', 'this month'];
  const timelineSignalsZh = ['幾時', '期限', '急', '盡快', '之內', '星期', '下個', '呢個月', '明日', '下星期', '要到貨'];
  if (timelineSignalsEn.some(s => lower.includes(s)) || timelineSignalsZh.some(s => text.includes(s))) {
    analysis.timelineHint = true;
  }

  // Sentiment
  const positiveEn = ['great', 'good', 'thanks', 'interested', 'yes', 'perfect', 'excellent', 'love', 'like'];
  const positiveZh = ['好', '唔錯', '多謝', '有興趣', '係', '正', '喜歡'];
  const negativeEn = ['no', 'not interested', 'cancel', 'too expensive', 'bad', 'disappointed', 'wrong'];
  const negativeZh = ['唔', '唔要', '取消', '太貴', '唔好', '唔滿意', '錯'];

  if (positiveEn.some(s => lower.includes(s)) || positiveZh.some(s => text.includes(s))) analysis.sentiment = 'positive';
  if (negativeEn.some(s => lower.includes(s)) || negativeZh.some(s => text.includes(s))) analysis.sentiment = 'negative';

  // Intent classification
  if (lower.includes('quote') || lower.includes('報價') || lower.includes('price') || text.includes('價')) analysis.intent = 'pricing';
  else if (lower.includes('catalog') || lower.includes('product') || text.includes('目錄') || text.includes('產品') || text.includes('款式')) analysis.intent = 'product_info';
  else if (lower.includes('order') || lower.includes('place') || text.includes('訂購') || text.includes('落單')) analysis.intent = 'ordering';
  else if (lower.includes('delivery') || lower.includes('ship') || text.includes('交貨') || text.includes('送貨')) analysis.intent = 'delivery';
  else if (lower.includes('complaint') || lower.includes('problem') || text.includes('問題') || text.includes('投訴')) analysis.intent = 'complaint';
  else analysis.intent = 'general';

  return analysis;
}

module.exports = {
  detectLanguage,
  generateNextMessage,
  analyzeInboundMessage,
  templates,
  industryContext
};
