// netlify/functions/market-forecast.mjs
// Lightweight scheduled trigger — calls the background function
// Schedule: Monday 03:00 UTC

export default async (request, context) => {
  const siteUrl = process.env.URL || "https://okx-editorial-digest.netlify.app";

  try {
    const res = await fetch(
      `${siteUrl}/.netlify/functions/market-forecast-background`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggered: new Date().toISOString() }),
      }
    );

    console.log(`Triggered market-forecast-background: ${res.status}`);
    return new Response("Triggered", { status: 200 });
  } catch (error) {
    console.error("Failed to trigger background function:", error.message);
    return new Response("Trigger failed", { status: 500 });
  }
};

export const config = {
  schedule: "0 3 * * 1",
};
