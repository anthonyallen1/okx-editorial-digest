// netlify/functions/weekly-crypto-update-background.mjs
// Background function (15-minute timeout)
// Generates Weekly Crypto Update via Claude + web search, posts to Lark

export default async (request) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const LARK_WEBHOOK_WEEKLY = process.env.LARK_WEBHOOK_WEEKLY;

  if (!ANTHROPIC_API_KEY || !LARK_WEBHOOK_WEEKLY) {
    console.error("Missing env vars");
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

    const systemPrompt = `You are the OKX Editorial Agent generating the Weekly Crypto Update email. Today is ${isoDate}.

This email looks BACKWARD at the past week's most impactful stories.

COMPLIANCE RULES:
- NEVER name competitors (Binance, Coinbase, Kraken, Bybit, Bitget, Gate.io, KuCoin, HTX, Crypto.com, Gemini, Robinhood, eToro, Revolut etc). Use "a major exchange" if needed.
- NEVER induce trading. No "buy the dip", "time to accumulate", "act now". Use "explore", "learn more about", "stay informed".
- This content is for informational purposes only.

RESEARCH SCOPE — cast the widest possible net across the past 7 days:
- BTC, ETH, SOL, XRP and major altcoin price moves with specific % and $ figures
- ETF flows (spot BTC, ETH, SOL) with $ figures
- Regulation across US, EEA, UK, Brazil, Singapore, UAE, Australia
- Institutional moves (corporate treasury, banking, custody)
- DeFi/protocol news (launches, upgrades, TVL, governance)
- OKX news (product launches, partnerships, listings)
- Macro events that moved crypto (Fed, ECB, inflation, employment, oil, geopolitics)
- Stablecoin developments
- Security incidents

OUTPUT FORMAT:

First, produce the GLOBAL section:

═══ GLOBAL ═══

**Subject line** (≤33 chars): [hook]
**Preheader** (≤37 chars): [complement]
**Title:** Weekly bulletin

**Intro:** Here are the biggest stories from the past week, shaping the crypto landscape:

Then EXACTLY 4 story blocks:

**[Bold headline sentence].** [2-4 sentences with specific numbers, percentages, dollar values. End with an informational tie-in to an OKX product — NOT a call to trade. Use "Learn more with **[Product]**" or "Explore [topic] on **[Product]**" or "Stay informed with **[Product]**".]

**[Bold headline sentence].** [...]

**[Bold headline sentence].** [...]

**[Bold headline sentence].** [...]

Each story gets a different OKX product: Spot Trading, Convert, Earn/Simple Earn, OKX Wallet, Exchange, Order Types, Recurring Buy.

**CTA:** [1-3 words]
**CTA link:** https://www.okx.com/ul/0isE9i

Then produce a section for EACH region with additional locally relevant stories from the past week:

═══ SINGAPORE ═══
**Additional stories for this market:**
• **[Story]:** [1-3 sentences — MAS actions, APAC-specific developments, local partnerships, etc.]
• **[Story]:** [...]

═══ UAE ═══
**Additional stories for this market:**
• **[Story]:** [VARA updates, MENA developments, local events, etc.]
• **[Story]:** [...]

═══ US ═══
**Additional stories for this market:**
• **[Story]:** [SEC/CFTC actions, state-level bills, US-specific macro, etc.]
• **[Story]:** [...]

═══ BRAZIL ═══
**Additional stories for this market:**
• **[Story]:** [BCB regulation, stablecoin tax, local developments, etc.]
• **[Story]:** [...]

═══ AUSTRALIA ═══
**Additional stories for this market:**
• **[Story]:** [ASIC, Travel Rule, ATO, local news, etc.]
• **[Story]:** [...]

═══ EEA ═══
**Additional stories for this market:**
• **[Story]:** [MiCA, ESMA, ECB, UK FCA, EU policy, etc.]
• **[Story]:** [...]

IMPORTANT: Regional sections contain ONLY additional local stories — don't repeat global content. The email team combines global + regional for each market.`;

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
        max_tokens: 4096,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Generate the Weekly Crypto Update for the week ending ${isoDate}. Search broadly for the past 7 days: price action, ETF flows, regulation across US/EEA/Singapore/UAE/Brazil/Australia, institutional news, DeFi, OKX announcements, macro, stablecoins. Produce the global email copy first, then additional stories for each of the 6 regional markets.`,
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
          { tag: "note", elements: [{ tag: "plain_text", content: "Auto-generated by Editorial Agent | For informational purposes only" }] },
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
          body: JSON.stringify({ msg_type: "text", content: { text: `⚠️ Weekly Crypto Update failed: ${error.message}` } }),
        });
      } catch (_) {}
    }
  }
};
