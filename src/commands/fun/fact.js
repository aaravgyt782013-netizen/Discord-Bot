const fetch = require("node-fetch");

/**
 * @type {import("../../typings.d").Command}
 */
module.exports = async (client, interaction) => {
  try {
    const response = await fetch("https://uselessfacts.jsph.pl/random.json?language=en", {
      headers: { Accept: "application/json" },
      timeout: 8000,
    });

    if (!response.ok) {
      throw new Error(`Facts API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const fact = String(data?.text || "I couldn't get a fact right now.").slice(0, 4000);

    return client.embed(
      {
        title: `😂・Fact`,
        desc: fact,
        type: "editreply",
      },
      interaction,
    );
  } catch (error) {
    console.error("Fact command failed:", error);
    return client.embed(
      {
        title: `❌・Fact`,
        desc: "I couldn't fetch a random fact right now. Please try again in a moment.",
        type: "editreply",
      },
      interaction,
    );
  }
};
