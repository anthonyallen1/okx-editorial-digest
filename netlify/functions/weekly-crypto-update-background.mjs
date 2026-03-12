// netlify/functions/weekly-crypto-update-background.mjs
// Background function (15-minute timeout)
// Called by the scheduled trigger function
// Generates Weekly Crypto Update via Claude + web search, posts to Lark

export default async (request) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const LARK_WEBHOOK_WEEKLY = process.env.LARK_WEBHOOK_WEEKLY;

  if (!ANTHROPIC_API_KEY || !LARK_WEBHOOK_WEEKLY) {
    console.error("Missing env vars: ANTHROPIC_API_KEY or LARK_WEBHOOK_WEEKLY");
    return;
  }

  try {
    const now = new Date();
    const isoDate = now.toISOString().split("T")[0];

    const publishDate = new Date(now);
    publishDate.setDate(now.getDate() + 1);
    const publishStr = publishDate.toLocaleDateString("en-GB", {
      month: "2-digit",
      day: "2-digit",
    });

    const systemPrompt = `You are the OKX Editorial Agent generating the Weekly Crypto Update for the Global Email Team. Today is ${isoDate}.

Your output is used directly as email copy for OKX's audience across Offshore, AU, BR, SG, UAE, EEA, and US entities (CeFi users, KYC-verified). This email looks BACKWARD at the past week's most impactful stories.

═══════════════════════════════════════
CRITICAL COMPLIANCE RULES — FOLLOW ALWAYS
═══════════════════════════════════════

1. NEVER PROMOTE COMPETITORS. Do not mention by name any competing exchange, wallet, or crypto platform including but not limited to: Binance, Coinbase, Kraken, Bybit, Bitget, Gate.io, KuCoin, HTX, Crypto.com, Gemini, Robinhood (crypto), eToro, Revolut (crypto), or any similar service. If a news story involves a competitor, report the market impact without naming them — use "a major exchange" or "an industry peer" if needed.

2. NEVER INDUCE TRADING. Do not use language that encourages, suggests, or implies users should buy, sell, trade, or take any specific financial action. Avoid phrases like "buy the dip", "time to accumulate", "don't miss out", "act now", "profit from", "take advantage of". Use informational language: "may impact", "could influence", "worth monitoring", "explore", "learn more about", "stay informed". This content is for informational purposes only.

3. SCAN AS WIDE A NET AS POSSIBLE. Research broadly across:
   - Bitcoin and major altcoin price action (BTC, ETH, SOL, XRP, etc.) with specific % moves and drivers
   - ETF flows (spot BTC, spot ETH, spot SOL) with specific $ figures
   - Regulatory developments across ALL OKX markets (US, EEA, UK, Brazil, Singapore, UAE, Australia)
   - Institutional moves (corporate treasury, banking, custody)
   - DeFi/protocol news (launches, upgrades, TVL changes, token metrics)
   - OKX-specific news (product launches, partnerships, listings)
   - Macro events that impacted crypto (Fed, ECB, inflation data, employment, oil, geopolitics)
   - Stablecoin developments (supply, regulation, new issuances)
   - Security incidents, hacks, or exploits (report factually)
   Do NOT limit yourself to crypto-native sources.

═══════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════

**STRUCTURED STORY DATA**

For each of the top stories from the past 7 days, provide:

📰 **[STORY HEADLINE]**
- Category: [One of: Price Action | Regulation | Institutional | DeFi | OKX News | Macro | Stablecoin | Security | Infrastructure]
- Impact: [HIGH | MEDIUM | LOW]
- Sentiment: [Bullish | Bearish | Neutral]
- Regions: [Comma-separated: Global, US, EEA, APAC, EMEA, Americas, Brazil, Singapore, UAE, Australia]
- Summary: [2-3 sentences with specific numbers, percentages, dollar values]
- Source: [URL]
- Tags: [Comma-separated]

Provide 6-8 stories covering a broad mix of categories.

Then provide the email-ready copy:

**EMAIL COPY**

**SUBJECT LINE** (≤33 characters)
[Punchy, specific]

**PREHEADER** (≤37 characters)
[Complements subject]

**TITLE**
Weekly bulletin

**INTRO**
Here are the biggest stories from the past week, shaping the crypto landscape:

Then EXACTLY 4 story blocks for the email:

**[Bold headline sentence].** [2-4 sentences with specific numbers. End with informational tie-in to OKX product — NOT a call to trade. Use "Learn more about..." or "Explore..." or "Stay informed with..."]

Each story gets a different OKX product:
- **Spot Trading** — market access, price discovery
- **Convert** — zero-fee swaps, portfolio management
- **Earn** / **Simple Earn** — yield, staking
- **OKX Wallet** — DeFi, on-chain access
- **Exchange** — deep liquidity, compliance
- **Order Types** — market tools
- **Recurring Buy** — structured participation

**CTA** (1-3 words)
**CTA LINK**: https://www.okx.com/ul/0isE9i`;

    console.log(`Calling Claude for Weekly Crypto Update: ${isoDate}`);

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Generate the Weekly Crypto Update for the week ending ${isoDate}. Search broadly for the past 7 days: BTC/ETH/SOL price action, ETF flows, regulation across all OKX markets, institutional news, DeFi developments, OKX announcements, macro events, stablecoin news. Include specific figures. Remember: never name competitors, never induce trading, cast the widest possible research net.`,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      throw new Error(`Claude API ${claudeResponse.status}: ${errText}`);
    }

    const claudeData = await claudeResponse.json();
    const weeklyContent = claudeData.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n\n");

    if (!weeklyContent) {
      throw new Error("Claude returned empty weekly update");
    }

    console.log(`Weekly Crypto Update generated (${weeklyContent.length} chars)`);

    const MAX_CARD_LENGTH = 28000;
    let cardContent = weeklyContent;
    if (cardContent.length > MAX_CARD_LENGTH) {
      cardContent = cardContent.substring(0, MAX_CARD_LENGTH) + "\n\n⚠️ *Content truncated. Full output in function logs.*";
    }

    const larkPayload = {
      msg_type: "interactive",
      card: {
        header: {
          title: { tag: "plain_text", content: `📰 Weekly Crypto Update — ${publishStr}` },
          template: "green",
        },
        elements: [
          { tag: "markdown", content: cardContent },
          { tag: "hr" },
          { tag: "note", elements: [{ tag: "plain_text", content: "Auto-generated by Editorial Agent | For informational purposes only — not financial advice" }] },
        ],
      },
    };

    const larkRes = await fetch(LARK_WEBHOOK_WEEKLY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(larkPayload),
    });

    const larkResult = await larkRes.text();
    console.log(`Lark response: ${larkRes.status} — ${larkResult}`);

  } catch (error) {
    console.error("Weekly Crypto Update failed:", error.message);

    if (process.env.LARK_WEBHOOK_WEEKLY) {
      try {
        await fetch(process.env.LARK_WEBHOOK_WEEKLY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            msg_type: "text",
            content: { text: `⚠️ Weekly Crypto Update generation failed: ${error.message}` },
          }),
        });
      } catch (_) {}
    }
  }
};
