// netlify/functions/market-forecast.mjs
// Schedule: Monday 03:00 UTC
// Generates the weekly Market Forecast content via Claude + web search
// Posts structured card to Lark group "Global Email Market Forecast"

export default async (request) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const LARK_WEBHOOK_FORECAST = process.env.LARK_WEBHOOK_FORECAST;

  if (!ANTHROPIC_API_KEY || !LARK_WEBHOOK_FORECAST) {
    console.error("Missing env vars: ANTHROPIC_API_KEY or LARK_WEBHOOK_FORECAST");
    return new Response("Missing config", { status: 500 });
  }

  try {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatShort = (d) =>
      d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });

    const weekRange = `${formatShort(monday)}-${formatShort(sunday)}`;
    const isoDate = now.toISOString().split("T")[0];

    // ----------------------------------------------------------
    // STEP 1: Generate Market Forecast content via Claude
    // ----------------------------------------------------------
    const systemPrompt = `You are the OKX Editorial Agent generating the weekly Market Forecast for the Global Email Team. Today is Monday ${isoDate}.

Your output feeds directly into the OKX Editorial Agent dashboard — a two-week crypto event forecast used by the email marketing team across Offshore, AU, BR, SG, UAE, EEA, and US entities.

═══════════════════════════════════════
CRITICAL COMPLIANCE RULES — FOLLOW ALWAYS
═══════════════════════════════════════

1. NEVER PROMOTE COMPETITORS. Do not mention by name any competing exchange, wallet, or crypto platform including but not limited to: Binance, Coinbase, Kraken, Bybit, Bitget, Gate.io, KuCoin, HTX, Crypto.com, Gemini, Robinhood (crypto), eToro, Revolut (crypto), or any similar service. If a news story involves a competitor, report the market impact without naming them — use "a major exchange" or "an industry peer" if needed.

2. NEVER INDUCE TRADING. Do not use language that encourages, suggests, or implies users should buy, sell, trade, or take any specific financial action. Avoid phrases like "buy the dip", "time to accumulate", "don't miss out", "act now", "profit from", "take advantage of". Use informational language: "may impact", "could influence", "worth monitoring", "traders are watching". This content is for informational purposes only.

3. SCAN AS WIDE A NET AS POSSIBLE. Research broadly across:
   - Macro: CPI, PPI, GDP, FOMC, jobless claims, central bank decisions globally (Fed, ECB, BoE, BoJ, RBA, MAS)
   - Regulation: SEC, CFTC, MiCA, FCA, MAS, VARA, ASIC, BCB actions and deadlines
   - Token unlocks: Large scheduled unlocks with $ values and % of supply
   - Protocol upgrades: Hard forks, emission changes, network upgrades
   - Conferences: ETH events, policy weeks, industry summits
   - Cultural moments: Eid, Nowruz, national holidays relevant to OKX markets
   - OKX product news: Partnerships, launches, features (F1/McLaren, OKX Card, etc.)
   - Geopolitical: Oil, conflicts, tariffs — anything impacting risk sentiment
   Do NOT limit yourself to crypto-native sources. Check macro calendars, regulatory trackers, and event databases.

═══════════════════════════════════════
OUTPUT FORMAT — STRUCTURED EVENT DATA
═══════════════════════════════════════

Output a structured forecast for each day of the coming week (Monday through Sunday). For each day, list events in this format:

**[DAY], [DATE] [MONTH]**

For each event on that day:

📌 **[EVENT TITLE]**
- Category: [One of: Macro | Regulation | Token Unlock | Crypto | Conference | Culture | Partnership | Narrative | OKX Product]
- Impact: [HIGH | MEDIUM | LOW]
- Sentiment: [Bullish | Bearish | Neutral]
- Regions: [Comma-separated: Global, US, EEA, APAC, EMEA, Americas, Brazil, Singapore, UAE, Australia, or specific country]
- Short: [1-2 sentence summary — punchy, specific, with numbers]
- Detail: [3-5 sentence deeper context — why it matters for crypto markets. Be specific with figures, percentages, dollar values. NEVER induce trading. Use informational language only.]
- Source: [URL]
- Tags: [Comma-separated relevant tags]

After all daily events, include:

**🔭 LOOKING AHEAD: [NEXT WEEK DATE RANGE]**
- [3-5 bullet points previewing major events in the following week]

Then provide email-ready copy:

**EMAIL COPY**
- Subject line (≤33 chars): [Hook]
- Preheader (≤37 chars): [Complement]
- Title (2-6 words): [e.g. "This week's highlights"]
- Intro (2-4 sentences): [Set macro context with specific data points]
- Body: [Day-by-day highlights in brief bullet format, matching the style of OKX's Market Forecast emails]
- Trending Strategy title: [2-5 words]
- Trending Strategy body: [2-3 informational sentences connecting events to market context — NO trading inducement]
- Strategy bullet 1: [OKX product/feature + informational connection to this week]
- Strategy bullet 2: [OKX product/feature + informational connection to this week]
- CTA (1-3 words): [e.g. "Explore the markets"]
- CTA link: www.okx.com/trade-spot/

OKX products to reference (rotate naturally): Spot Trading, Convert, Simple Earn, Recurring Buy, Order Types, OKX Wallet, Exchange, OKX Card.

═══════════════════════════════════════
RESEARCH INSTRUCTIONS
═══════════════════════════════════════

Search for ALL of the following for this week (${weekRange}):
1. US and global macro economic calendar events with exact times
2. Scheduled token unlocks with $ values and % of circulating supply
3. Regulatory deadlines, consultations, and government actions across ALL OKX markets
4. Protocol upgrades, emission changes, network milestones
5. Crypto conferences and industry events
6. Cultural moments relevant to OKX's global audience
7. OKX partnership activations (F1, football, etc.)
8. Geopolitical events impacting risk sentiment

If a day has no significant events, skip it. Do NOT pad with filler content.`;

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
            content: `Generate the full Market Forecast for the week of ${weekRange}. Search broadly: macro calendar, token unlocks, regulation across all OKX markets (US, EEA, Brazil, Singapore, UAE, Australia), protocol upgrades, conferences, cultural events, and geopolitics. Include specific dates, times, figures, and dollar values. Remember: never name competitors, never induce trading.`,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      throw new Error(`Claude API ${claudeResponse.status}: ${errText}`);
    }

    const claudeData = await claudeResponse.json();
    const forecastContent = claudeData.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n\n");

    if (!forecastContent) {
      throw new Error("Claude returned empty forecast");
    }

    console.log(`Market Forecast generated for ${weekRange}`);

    // ----------------------------------------------------------
    // STEP 2: Post to Lark group
    // ----------------------------------------------------------
    // Lark cards have a content length limit (~30KB).
    // If content is very long, truncate and add a note.
    const MAX_CARD_LENGTH = 28000;
    let cardContent = forecastContent;
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
            content: `📊 Market Forecast — ${weekRange}`,
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

    const larkRes = await fetch(LARK_WEBHOOK_FORECAST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(larkPayload),
    });

    if (!larkRes.ok) {
      const larkErr = await larkRes.text();
      throw new Error(`Lark webhook ${larkRes.status}: ${larkErr}`);
    }

    console.log("Market Forecast posted to Lark" + (truncated ? " (truncated)" : ""));

    return new Response(
      JSON.stringify({ success: true, week: weekRange, truncated }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Market Forecast failed:", error.message);

    if (process.env.LARK_WEBHOOK_FORECAST) {
      try {
        await fetch(process.env.LARK_WEBHOOK_FORECAST, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            msg_type: "text",
            content: {
              text: `⚠️ Market Forecast generation failed: ${error.message}`,
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

// Monday 03:00 UTC
export const config = {
  schedule: "0 3 * * 1",
};
