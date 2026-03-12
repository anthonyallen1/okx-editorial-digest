// netlify/functions/weekly-crypto-update.mjs
// Lightweight scheduled trigger — calls the background function
// Schedule: Thursday 12:00 UTC

export default async (request, context) => {
  const siteUrl = process.env.URL || "https://okx-editorial-digest.netlify.app";

  try {
    const res = await fetch(
      `${siteUrl}/.netlify/functions/weekly-crypto-update-background`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggered: new Date().toISOString() }),
      }
    );

    console.log(`Triggered weekly-crypto-update-background: ${res.status}`);
    return new Response("Triggered", { status: 200 });
  } catch (error) {
    console.error("Failed to trigger background function:", error.message);
    return new Response("Trigger failed", { status: 500 });
  }
};

export const config = {
  schedule: "0 12 * * 4",
};
