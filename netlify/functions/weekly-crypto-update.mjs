// netlify/functions/weekly-crypto-update.mjs
// Schedule: Thursday 12:00 UTC
// Generates the Weekly Crypto Update content via Claude + web search
// Posts structured card to Lark group "Global Email Weekly Crypto Update"

export default async (request) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const LARK_WEBHOOK_WEEKLY = process.env.LARK_WEBHOOK_WEEKLY;

  if (!ANTHROPIC_API_KEY || !LARK_WEBHOOK_WEEKLY) {
    console.error("Missing env vars: ANTHROPIC_API_KEY or LARK_WEBHOOK_WEEKLY");
    return new Response("Missing config", { status: 500 });
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

    // ----------------------------------------------------------
    // STEP 1: Generate Weekly Crypto Update content via Claude
    // ----------------------------------------------------------
    const systemPrompt = `You are the OKX Editorial Agent generating the Weekly Crypto Update for the Global Email Team. Today is Thursday ${isoDate}.

Your output is used directly as email copy for OKX's audience across Offshore, AU, BR, SG, UAE, EEA, and US entities (CeFi users, KYC-verified). This email looks BACKWARD at the past week's most impactful stories.

═══════════════════════════════════════
CRITICAL COMPLIANCE RULES — FOLLOW ALWAYS
═══════════════════════════════════════

1. NEVER PROMOTE COMPETITORS. Do not mention by name any competing exchange, wallet, or crypto platform including but not limited to: Binance, Coinbase, Kraken, Bybit, Bitget, Gate.io, KuCoin, HTX, Crypto.com, Gemini, Robinhood (crypto), eToro, Revolut (crypto), or any similar service. If a news story involves a competitor, report the market impact without naming them — use "a major exchange" or "an industry peer" if needed.

2. NEVER INDUCE TRADING. Do not use language that encourages, suggests, or implies users should buy, sell, trade, or take any specific financial action. Avoid phrases like "buy the dip", "time to accumulate", "don't miss out", "act now", "profit from", "take advantage of". Use informational language: "may impact", "could influence", "worth monitoring", "explore", "learn more about", "stay informed". This content is for informational purposes only. Each story's product tie-in must be informational, not a call to action. Use patterns like "Learn more about [product area] with **[Product Name]**" or "Explore [topic] on **[Product Name]**" rather than "Trade now" or "Build your position".

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
   Do NOT limit yourself to crypto-native sources. Check Bloomberg, Reuters, FT, CoinDesk, The Block, Decrypt, DL News, and macro news sources.

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

Provide 6-8 stories covering a broad mix of categories. More is better than fewer — the email team will select the best 4 for the final email.

Then provide the email-ready copy:

**EMAIL COPY**

**SUBJECT LINE** (≤33 characters)
[Punchy, specific. Examples: "Weekly Update: BTC Surges 10%", "Weekly Update: Crypto meets AI"]

**PREHEADER** (≤37 characters)
[Complements subject. Examples: "Your weekly crypto snapshot.", "This week: Bitcoin starts to climb"]

**TITLE**
Weekly bulletin

**INTRO**
Here are the biggest stories from the past week, shaping the crypto landscape:

Then EXACTLY 4 story blocks for the email. Each follows this format:

**[Bold headline sentence].** [2-4 sentences expanding on the story with specific numbers. End with an informational tie-in to an OKX product — NOT a call to trade. Use language like "Learn more about..." or "Explore..." or "Stay informed with..."]

The 4 email stories should cover a MIX of:
- Bitcoin/ETH price action and what drove it
- Regulatory/institutional developments
- DeFi/protocol-specific news or ecosystem milestones
- OKX-specific news if available, OR another significant industry story

Each story MUST end with an informational product tie-in using bold formatting:
"Explore [topic] with **[Product Name]**." or "Learn more on **[Product Name]**."

OKX products (rotate — each story gets a different one):
- **Spot Trading** — market access, price discovery
- **Convert** — zero-fee swaps, portfolio management
- **Earn** / **Simple Earn** — yield, staking, passive strategies
- **OKX Wallet** — DeFi, on-chain, dApp ecosystem access
- **Exchange** — deep liquidity, compliance, institutional access
- **Order Types** — market tools, risk management
- **Recurring Buy** — structured, disciplined market participation

**CTA** (1-3 words)
[e.g. "Explore OKX", "See Crypto Prices"]

**CTA LINK**
https://www.okx.com/ul/0isE9i

═══════════════════════════════════════
RESEARCH INSTRUCTIONS
═══════════════════════════════════════

Search for the PAST 7 DAYS' biggest crypto and macro stories. Cast a wide net:
1. Bitcoin and top-10 altcoin price movements with specific % and $ figures
2. ETF flow data (spot BTC, ETH, SOL) with daily/weekly totals
3. Regulatory actions across US, EU, UK, Brazil, Singapore, UAE, Australia
4. Institutional adoption (corporate, banking, custody, ETF)
5. DeFi protocol news (launches, hacks, TVL, governance)
6. OKX announcements (check okx.com/learn and press releases)
7. Macro events that moved crypto markets
8. Stablecoin supply and regulatory developments
Prioritise stories that moved markets or have lasting implications.`;

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
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
          },
        ],
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

    console.log(`Weekly Crypto Update generated for ${publishStr}`);

    // ----------------------------------------------------------
    // STEP 2: Post to Lark group
    // ----------------------------------------------------------
    const MAX_CARD_LENGTH = 28000;
    let cardContent = weeklyContent;
    let truncated = false;
    if (cardContent.length > MAX_CARD_LENGTH) {
      cardContent = cardContent.substring(0, MAX_CARD_LENGTH) + "\n\n⚠️ *Content truncated due to length. Full output available in function logs.*";
      truncated = true;
    }

    const larkPayload = {
      msg_type: "interactive",
      card: {
        header: {
          title: {
            tag: "plain_text",
            content: `📰 Weekly Crypto Update — ${publishStr}`,
          },
          template: "green",
        },
        elements: [
          {
            tag: "markdown",
            content: cardContent,
          },
          {
            tag: "hr",
          },
          {
            tag: "note",
            elements: [
              {
                tag: "plain_text",
                content:
                  "Auto-generated by Editorial Agent | For informational purposes only — not financial advice",
              },
            ],
          },
        ],
      },
    };

    const larkRes = await fetch(LARK_WEBHOOK_WEEKLY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(larkPayload),
    });

    if (!larkRes.ok) {
      const larkErr = await larkRes.text();
      throw new Error(`Lark webhook ${larkRes.status}: ${larkErr}`);
    }

    console.log("Weekly Crypto Update posted to Lark" + (truncated ? " (truncated)" : ""));

    return new Response(
      JSON.stringify({ success: true, date: publishStr, truncated }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Weekly Crypto Update failed:", error.message);

    if (process.env.LARK_WEBHOOK_WEEKLY) {
      try {
        await fetch(process.env.LARK_WEBHOOK_WEEKLY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            msg_type: "text",
            content: {
              text: `⚠️ Weekly Crypto Update generation failed: ${error.message}`,
            },
          }),
        });
      } catch (_) {}
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

// Thursday 12:00 UTC
export const config = {
  schedule: "0 12 * * 4",
};
