# 5-Minute CEO Demo Script

**For:** Hong Kong / Shenzhen SME CEO demo  
**Audience:** A CEO who has 5 minutes and a skeptical tech-savvy colleague  
**Device:** iPhone or Android phone (primary), desktop browser (backup)  
**Setup:** Fresh database with 5 seed leads loaded, auto-follow-up ON  

---

## Pre-Demo Checklist (2 min before)

1. Start the server: `node server.js`
2. Open `http://localhost:3000` on your phone and desktop
3. Verify seed data is loaded (5 leads visible on dashboard)
4. Verify "Needs Attention Today" card shows 3 items
5. Have the demo phone number ready: any lead's phone number for context

---

## Minute 0-1: The Problem (Opening Hook)

**Say (EN):**
> "Most SMEs in Hong Kong lose 40% of their leads because no one follows up fast enough. WhatsApp messages sit unanswered. Leads go cold in 24 hours."

**Say (ZH-HK):**
> "香港好多中小企流失四成客戶，因為冇人跟進 WhatsApp 查詢。24小時唔覆，客就走咗。"

**Show:**
- Dashboard view on phone
- Point at the **"Needs Attention Today"** card — 3 leads need action right now
- Point at the **Total Leads** KPI card (5 leads, 1 converted = only 20% conversion)

**Transition:**
> "Now watch what happens when an AI Worker handles every lead automatically."

---

## Minute 1-2: New Lead Arrives + AI Replies

**Action:**
1. Click **"New Lead"** button
2. Fill in a Cantonese inquiry:
   - Name: `王太太`
   - Inquiry: `我想查詢你們嘅電子零件批發價格，我需要500件，預算大約5萬港幣`
   - Industry: Trading
   - Estimated Value: HKD 50,000
3. Click **"Create Lead + Auto Follow-up"**

**Say (EN):**
> "A Cantonese inquiry just arrived. Within seconds, the AI detected the language and replied in Cantonese. No human needed."

**Say (ZH-HK):**
> "一個粵語查詢剛入來。幾秒之內，AI偵測到語言，自動用粵語回覆。唔需要人手。"

**Show:**
- The conversation opens automatically
- Point at the **green AI Worker badge** on the acknowledgment message
- Point at the ** Cantonese response** — the CEO sees their language being used

---

## Minute 2-3: BANT Score Increases

**Action:**
1. In the chat input, type an inbound message with BANT signals:
   `我老闆已經批准咗，我們需要盡快到貨，預算5萬港幣`

2. Click **Send**

**Say (EN):**
> "The customer replies with budget, authority, need, and timeline signals. The AI scans for BANT keywords and the score jumps from 0 to 3."

**Say (ZH-HK):**
> "客戶回覆有預算、決策權、需求同時間線。AI分析BANT信號，分數由0跳到3。"

**Show:**
- The AI auto-reply appears in the conversation
- Switch to **Pipeline tab** — point at the lead moving from "Contacted" to "Qualified"
- Point at the **BANT dots** (3 green dots out of 4)

---

## Minute 3-4: Lead Becomes Hot + CEO Attention

**Action:**
1. Switch back to **Dashboard tab**
2. Point at the **"Needs Attention Today"** card — it now shows the qualified lead

**Say (EN):**
> "When a lead hits BANT score 3, the AI auto-qualifies it and flags it for the CEO. You don't need to check every conversation — the AI tells you which leads need your attention today."

**Say (ZH-HK):**
> "當BANT分數達到3，AI自動認定為合格客戶，標記給CEO睇。你唔需要逐個對話檢查——AI話你知今日要跟進邊個。"

**Show:**
- The attention card with the new qualified lead highlighted
- Click on the lead name in the attention card — it jumps to conversation

---

## Minute 4-5: CEO Converts the Lead

**Action:**
1. In the conversation, click the **"Convert"** button
2. Confirm the conversion in the dialog
3. Watch the dashboard update: conversion rate, revenue, pipeline counts all refresh

**Say (EN):**
> "One click. The lead is converted. Revenue is recorded. The pipeline updates instantly. From WhatsApp inquiry to paying customer — in under 5 minutes, without a human sales rep touching the keyboard."

**Say (ZH-HK):**
> "一個click。客戶成交。收入記錄咗。Pipeline即時更新。由WhatsApp查詢到成交客戶——5分鐘內，唔需要銷售員碰過鍵盤。"

**Show:**
- The confirmation dialog (shows this is intentional, not accidental)
- Dashboard after conversion: Revenue KPI updated, pipeline funnel updated
- Point at the **Revenue KPI card** — HKD value increased

---

## Closing Statement

**Say (EN):**
> "This is just the first AI Worker. Rule-based today, LLM-powered tomorrow. WhatsApp simulation now, real WhatsApp Business API next. The wedge product is sales lead follow-up — but the platform can add workers for customer service, cash flow, admin workflows. Every SME in Hong Kong needs this."

**Say (ZH-HK):**
> "這只是第一個AI Worker。今日用規則引擎，明天接LLM。今日模擬WhatsApp，下一步接WhatsApp Business API。切入產品係銷售跟進——但平台可以加客服、现金流、行政流程嘅Worker。每間香港中小企都需要。"

**If the CEO asks "Is this real AI?":**
> "The qualification engine (BANT scoring) is deterministic and reliable — that's good for business. The conversational engine is rule-based for this demo. We can swap in GPT-4o or Claude for natural conversations in one afternoon — the architecture is designed for that."

**If the CEO asks "Can I try this with my real WhatsApp?":**
> "Next step is WhatsApp Business API integration. Meta requires approval, but providers like Wati and Twilio can fast-track that. The dashboard you see is the management layer — the real WhatsApp connection is the execution layer."

---

## What NOT to Say

- Don't say "this is just a prototype" — say "this is the first AI Worker"
- Don't say "it's not real AI" — say "the qualification is deterministic, the conversation is upgradeable"
- Don't say "we don't have WhatsApp yet" — say "WhatsApp Business API integration is the next step"
- Don't apologize for limitations — frame them as upgrade paths

---

## Backup: If Something Breaks

- If the server crashes: restart `node server.js` (takes 3 seconds)
- If the database is corrupt: `rm data/sales-worker.db` and restart (auto-re-seeds)
- If mobile layout looks wrong: switch to desktop browser at same URL
- If a lead won't convert: check that its status is "qualified" first (BANT >= 3)
