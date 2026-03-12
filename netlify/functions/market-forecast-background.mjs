// netlify/functions/market-forecast-background.mjs
// Background function (15-minute timeout)
// Generates Market Forecast via Claude + web search, posts to Lark

export default async (request) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const LARK_WEBHOOK_FORECAST = process.env.LARK_WEBHOOK_FORECAST;

  if (!ANTHROPIC_API_KEY || !LARK_WEBHOOK_FORECAST) {
    console.error("Missing env vars");
    return;
  }

  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatShort = (d) =>
      d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });

    const weekRange = `${formatShort(monday)}-${formatShort(sunday)}`;
    const isoDate = now.toISOString().split("T")[0];

    const systemPrompt = `You are the OKX Editorial Agent generating the weekly Market Forecast email. Today is ${isoDate}.

COMPLIANCE RULES:
- NEVER name competitors (Binance, Coinbase, Kraken, Bybit, Bitget, Gate.io, KuCoin, HTX, Crypto.com, Gemini, Robinhood, eToro, Revolut etc). Use "a major exchange" if needed.
- NEVER induce trading. No "buy the dip", "time to accumulate", "act now". Use "worth monitoring", "may impact", "could influence".
- This content is for informational purposes only.

RESEARCH SCOPE — cast the widest possible net:
- Macro: CPI, PPI, GDP, FOMC, jobless claims, central bank decisions globally
- Regulation: SEC, CFTC, MiCA, FCA, MAS, VARA, ASIC, BCB
- Token unlocks with $ values and % of supply
- Protocol upgrades, emission changes
- Conferences and industry events
- Cultural moments (Eid, Nowruz, holidays relevant to OKX markets)
- OKX partnerships (F1/McLaren, football, product launches)
- Geopolitical events impacting risk sentiment

OUTPUT FORMAT:

First, produce the GLOBAL section — this is the main email content that goes to all markets:

═══ GLOBAL ═══

**Subject line** (≤33 chars): [hook]
**Preheader** (≤37 chars): [complement]
**Title** (2-6 words): [e.g. "This week's highlights"]

**Intro** (2-4 sentences setting the week's macro context with specific figures)

Then day-by-day:

**Monday, [Date]**
• **[Event name]:** [1-3 sentences on why it matters. Specific numbers.]
• **[Event name]:** [1-3 sentences.]

**Tuesday, [Date]**
[...continue for each day with events. Skip days with nothing significant.]

**Weekend ([Date range])**
• [Any weekend events]

**Trending Strategy: [2-5 word title]**
[2-3 informational sentences connecting events to market context.]
• **[OKX Product]:** [Informational connection to this week]
• **[OKX Product]:** [Informational connection to this week]

**CTA:** [1-3 words]
**CTA link:** www.okx.com/trade-spot/

OKX products to rotate: Spot Trading, Convert, Simple Earn, Recurring Buy, Order Types, OKX Wallet, Exchange, OKX Card.

Then produce a section for EACH region. Each regional section includes the global content PLUS additional stories specific to that market. Use this format:

═══ SINGAPORE ═══
**Additional stories for this market:**
• **[Event/story]:** [1-3 sentences on local relevance — MAS regulation, local partnerships, APAC-specific macro, local conferences, etc.]
• **[Event/story]:** [...]
[Include 2-4 locally relevant additions]

═══ UAE ═══
**Additional stories for this market:**
• **[Event/story]:** [VARA regulation, MENA-specific macro, local events, etc.]
• **[Event/story]:** [...]

═══ US ═══
**Additional stories for this market:**
• **[Event/story]:** [SEC, CFTC, state-level crypto bills, US macro detail, etc.]
• **[Event/story]:** [...]

═══ BRAZIL ═══
**Additional stories for this market:**
• **[Event/story]:** [BCB regulation, stablecoin tax, local macro, etc.]
• **[Event/story]:** [...]

═══ AUSTRALIA ═══
**Additional stories for this market:**
• **[Event/story]:** [ASIC, Travel Rule, ATO, local conferences, etc.]
• **[Event/story]:** [...]

═══ EEA ═══
**Additional stories for this market:**
• **[Event/story]:** [MiCA deadlines, ESMA, ECB, UK FCA, EU summits, etc.]
• **[Event/story]:** [...]

IMPORTANT: The regional sections should contain ONLY the additional local content — not repeat the global stories. The email team will combine global + regional when building for each market.`;

    console.log(`Calling Claude for Market Forecast: ${weekRange}`);

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
            content: `Generate the Market Forecast for the week of ${weekRange}. Search for: macro calendar events globally, token unlocks with $ values, regulation across US/EEA/Singapore/UAE/Brazil/Australia, protocol upgrades, conferences, cultural events, OKX partnerships, and geopolitics. Produce the global email copy first, then additional stories for each of the 6 regional markets.`,
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

    console.log(`Market Forecast generated (${forecastContent.length} chars)`);

    const MAX_CARD_LENGTH = 28000;
    let cardContent = forecastContent;
    if (cardContent.length > MAX_CARD_LENGTH) {
      cardContent = cardContent.substring(0, MAX_CARD_LENGTH) + "\n\n⚠️ *Content truncated. Full output in function logs.*";
    }

    const larkPayload = {
      msg_type: "interactive",
      card: {
        header: {
          title: { tag: "plain_text", content: `📊 Market Forecast — ${weekRange}` },
          template: "green",
        },
        elements: [
          { tag: "markdown", content: cardContent },
          { tag: "hr" },
          { tag: "note", elements: [{ tag: "plain_text", content: "Auto-generated by Editorial Agent | For informational purposes only" }] },
        ],
      },
    };

    const larkRes = await fetch(LARK_WEBHOOK_FORECAST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(larkPayload),
    });

    const larkResult = await larkRes.text();
    console.log(`Lark response: ${larkRes.status} — ${larkResult}`);

  } catch (error) {
    console.error("Market Forecast failed:", error.message);
    if (process.env.LARK_WEBHOOK_FORECAST) {
      try {
        await fetch(process.env.LARK_WEBHOOK_FORECAST, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ msg_type: "text", content: { text: `⚠️ Market Forecast failed: ${error.message}` } }),
        });
      } catch (_) {}
    }
  }
};
