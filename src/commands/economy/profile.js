const Profile = require("../../database/models/economyProfile");
const Economy = require("../../database/models/economy");

/** @type {import("../../typings.d").Command} */
module.exports = async (client, interaction) => {
  const user = interaction.user;
  const [wallet, profile] = await Promise.all([
    Economy.findOne({ User: user.id }).lean(),
    Profile.findOneAndUpdate({ User: user.id }, {}, { upsert: true, new: true, setDefaultsOnInsert: true }).lean(),
  ]);

  const xp = profile?.XP || 0;
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const next = level * level * 100;
  const pet = profile?.Pet?.type ? `${profile.Pet.name || "Unnamed"} (${profile.Pet.type})` : "None";

  client.embed({
    title: "🪪・LightCore Profile",
    desc: `Global profile for **${user.tag}**`,
    fields: [
      { name: "💰┆Wallet", value: `$${wallet?.Money || 0}`, inline: true },
      { name: "🏦┆Bank", value: `$${wallet?.Bank || 0}`, inline: true },
      { name: "⭐┆Level", value: `${level}`, inline: true },
      { name: "✨┆XP", value: `${xp}/${next}`, inline: true },
      { name: "🐾┆Pet", value: pet, inline: true },
      { name: "🎒┆Items", value: `${profile?.Inventory ? Array.from(profile.Inventory.values()).reduce((a, b) => a + b, 0) : 0}`, inline: true },
    ],
    type: "editreply",
  }, interaction);
};
