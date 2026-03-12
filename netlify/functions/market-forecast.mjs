// netlify/functions/market-forecast.mjs
// Schedule: Monday 03:00 UTC
// Generates weekly Market Forecast content and posts to Lark group "Global Email Market Forecast"

export default async (request) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const LARK_WEBHOOK_FORECAST = process.env.LARK_WEBHOOK_FORECAST;

  if (!ANTHROPIC_API_KEY || !LARK_WEBHOOK_FORECAST) {
    console.error("Missing env vars: ANTHROPIC_API_KEY or LARK_WEBHOOK_FORECAST");
    return new Response("Missing config", { status: 500 });
  }

  try {
    // -------------------------------------------------------
    // Calculate the date range for this week (Mon-Sun)
    // -------------------------------------------------------
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = (d) => d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
    const dateRange = `${fmt(monday)}-${fmt(sunday)}`;
    const isoDate = today.toISOString().split("T")[0];

    // -------------------------------------------------------
    // STEP 1: Call Claude API with Market Forecast prompt
    // -------------------------------------------------------
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
        system: `You are an expert crypto and macro markets editorial analyst working for OKX, one of the world's largest crypto exchanges. You produce the weekly "Market Forecast" email content for OKX's EMEA email marketing team.

Today is ${isoDate}. You are writing the forecast for the week of ${dateRange}.

Your output must match EXACTLY this structure and tone. Study the examples below carefully — they represent the exact style, depth, and format required.

## OUTPUT FORMAT (follow precisely):

**Subject line** (max 33 characters, must be a hook):
Examples from past weeks: "CPI Alert: Market-Moving Data", "Macro Matters: Preparing for Friday's NFP Report", "This Week's Crypto Outlook"

**Preheader** (max 37 characters, complements subject):
Examples: "Plus: Korea's crypto plan, token unlocks and Polkadot halving", "How global volatility and US jobs data could influence digital asset markets"

**Title H1** (2-6 words):
Usually "This week's highlights" or similar

**Body intro** (2-4 sentences setting the scene for the week):
Example: "This week includes several planned macro events: CPI on Wednesday. Korea's crypto plan tomorrow. The Fed will decide next week. March's $5.8B unlock wave rolls on."

**Day-by-day breakdown (Monday through Weekend)**:
For each day, list 1-3 key events with:
- Bold event name followed by a colon
- 2-3 sentences of context explaining WHY this matters for crypto markets
- Include specific data points: dollar amounts, percentages, token quantities
- Where relevant, mention token unlock amounts with approximate USD values

Focus on these event categories (in priority order):
1. Macro data releases (CPI, PPI, NFP, GDP, FOMC, PCE, jobless claims)
2. Regulatory developments (especially Asia, EU, US crypto regulation)
3. Major token unlocks (include token name, amount, and USD value)
4. Industry events (conferences, protocol upgrades, halvings)
5. Central bank activity (Fed reinvestments, rate decisions)

**Trending Strategy section**:
Title: "Trending Strategy: [Theme Through Volatility/Action/Opportunity]"
- 2-3 sentences of market context
- 2 bullet points tying OKX products to the week's events:
  - Use specific product names: Convert, Spot Trading, Simple Earn, Recurring Buy, OKX Wallet
  - Frame them as tools for navigating the specific conditions described

**CTA** (1-3 words): e.g. "Track the market on OKX"
**CTA link**: www.okx.com/trade-spot/

## STYLE RULES:
- Authoritative but accessible — write for informed retail traders, not academics
- Every event should explain the "so what" for crypto markets specifically
- Use phrases like "could shape", "often influences", "historically", "potentially" — avoid definitive predictions
- Bold the event/topic name at the start of each bullet
- Include hyperlink-worthy phrases in square brackets like [critical inflation read] or [halving-style event] — the email team will add the actual links
- Do NOT include legal disclaimers, targeting info, or QA checklists — only the content sections
- Keep the body concise. Each day's events should be 3-5 sentences max
- Weekend events are grouped as "Weekend (Sat date – Sun date)"`,
        messages: [
          {
            role: "user",
            content: `Generate the Market Forecast email content for the week of ${dateRange}. 

Search for:
1. Key macroeconomic data releases scheduled this week (CPI, PPI, GDP, jobless claims, FOMC, etc.)
2. Major token unlocks happening this week (check Token Unlocks or similar sources for specific amounts)
3. Crypto regulatory developments expected this week
4. Notable crypto industry events, protocol upgrades, or governance votes
5. Central bank activity (Fed, ECB, BoJ reinvestments or decisions)

Return the content in the exact format specified. Every section must be populated.`,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      throw new Error(`Claude API error ${claudeResponse.status}: ${errorText}`);
    }

    const claudeData = await claudeResponse.json();
    const forecastContent = claudeData.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n\n");

    if (!forecastContent) {
      throw new Error("Claude returned empty forecast");
    }

    console.log(`Market Forecast generated for ${dateRange}`);

    // -------------------------------------------------------
    // STEP 2: Post to Lark group as interactive card
    // -------------------------------------------------------
    const larkPayload = {
      msg_type: "interactive",
      card: {
        header: {
          title: {
            tag: "plain_text",
            content: `📊 Market Forecast — ${dateRange}`,
          },
          template: "green",
        },
        elements: [
          {
            tag: "markdown",
            content: forecastContent,
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
                  "Auto-generated by Editorial Agent | Ready for OKP build — review content, add images, and set targeting",
              },
            ],
          },
        ],
      },
    };

    const larkResponse = await fetch(LARK_WEBHOOK_FORECAST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(larkPayload),
    });

    if (!larkResponse.ok) {
      const larkError = await larkResponse.text();
      throw new Error(`Lark webhook error ${larkResponse.status}: ${larkError}`);
    }

    const larkResult = await larkResponse.json();
    console.log("Lark forecast post result:", JSON.stringify(larkResult));

    return new Response(
      JSON.stringify({ success: true, week: dateRange }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Market Forecast function failed:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

// -------------------------------------------------------
// Netlify scheduled function config
// Runs at 03:00 UTC every Monday
// -------------------------------------------------------
export const config = {
  schedule: "0 3 * * 1",
};
