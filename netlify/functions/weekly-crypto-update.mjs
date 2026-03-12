// netlify/functions/weekly-crypto-update.mjs
// Schedule: Thursday 12:00 UTC
// Generates the Weekly Crypto Update email content via Claude + web search
// Posts formatted card to Lark group "Global Email Weekly Crypto Update"

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

    // Calculate the publish date (typically the day after — Friday)
    const publishDate = new Date(now);
    publishDate.setDate(now.getDate() + 1);
    const publishStr = publishDate.toLocaleDateString("en-GB", {
      month: "2-digit",
      day: "2-digit",
    });

    // ----------------------------------------------------------
    // STEP 1: Generate Weekly Crypto Update content via Claude
    // ----------------------------------------------------------
    const systemPrompt = `You are the OKX Editorial Agent generating the Weekly Crypto Update email for the Global Email Team. Today is Thursday ${isoDate}.

Your output will be used directly as email copy for OKX's audience across Offshore, AU, BR, SG, UAE, and US entities (CeFi users, KYC-verified). The tone is informed, punchy, and market-aware — editorial quality, not blog filler.

This email looks BACKWARD at the past week's most impactful stories, NOT forward. It's a weekly wrap/digest.

OUTPUT FORMAT — follow this EXACTLY:

**SUBJECT LINE** (hook within 33 characters)
[Punchy, specific. Examples: "Weekly Update: BTC Surges 10%", "Weekly Update: Crypto meets AI", "Your Weekly Crypto Update"]

**PREHEADER** (hook within 37 characters)
[Complements subject. Examples: "Your weekly crypto snapshot.", "Your snapshot of the biggest stories shaping the crypto landscape.", "This week: Bitcoin starts to climb"]

**TITLE** (2-6 words)
Weekly bulletin

**INTRO** (1 sentence)
Here are the biggest stories from the past week, shaping the crypto landscape:

Then provide EXACTLY 4 story blocks. Each block follows this format:

**[Bold headline sentence].** [2-4 sentences expanding on the story with specific numbers, percentages, dollar values. End with a natural tie-in to an OKX product using bold product name formatting.]

The 4 stories should cover a MIX of:
- Bitcoin/ETH price action and what drove it (ETF flows, liquidations, technical levels)
- Regulatory/institutional developments (legislation, ETF approvals, central bank moves, major company actions)
- DeFi/protocol-specific news (launches, upgrades, token metrics, ecosystem milestones)
- OKX-specific news if available (product launches, partnerships, listings), OR another macro/industry story

Each story MUST end with a product tie-in. Use this pattern:
"[Action verb] with **[Product Name]**." or "Explore [benefit] with **[Product Name]**."

OKX products to use (rotate across the 4 stories — each story gets a different one):
- **Spot Trading** — for BTC/ETH price action stories, market entry
- **Convert** — for zero-fee swaps, portfolio rebalancing, asset rotation
- **Earn** / **Simple Earn** — for yield, staking, passive income
- **OKX Wallet** — for DeFi, on-chain, dApp ecosystem stories
- **Exchange** — for compliance, institutional, deep liquidity stories
- **Order Types** — for volatility management, risk stories
- **Recurring Buy** — for DCA strategies during uncertainty

After the 4 stories:

**CTA** (1-3 words)
[e.g. "Discover trading tools", "Explore OKX", "See Crypto Prices"]

**CTA LINK**
https://www.okx.com/ul/0isE9i

CONTENT GUIDELINES:
- Search for the PAST 7 DAYS' biggest crypto and macro stories
- Prioritize stories that moved markets or have lasting implications
- Use specific numbers: "$700M in spot ETF inflows", "surged 10% to $73,900", "$18 billion run rate"
- Bold the opening phrase/headline of each story block
- Keep each story block to 3-5 sentences total (including the product tie-in)
- Stories should feel independent — each is a self-contained news item, not a thread
- Do NOT include image specs, OKP template metadata, legal approvals, or QA checklists — just the email copy
- Do NOT include any section for "Full card", entity approvals, or mock up references`;

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2500,
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
            content: `Generate the Weekly Crypto Update email content for the week ending ${isoDate}. Search for the past 7 days' biggest crypto headlines: Bitcoin and major altcoin price movements, institutional/regulatory news, notable DeFi developments, and any OKX-specific announcements. Include specific figures and data points.`,
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
            content: weeklyContent,
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
                  "Auto-generated by Editorial Agent | Copy into OKP template for build",
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

    console.log("Weekly Crypto Update posted to Lark");

    return new Response(
      JSON.stringify({ success: true, date: publishStr }),
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
