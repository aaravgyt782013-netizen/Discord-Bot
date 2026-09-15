const Profile = require("../../database/models/economyProfile");

const PETS = {
  fox: { emoji: "🦊", label: "Fox", cost: 500, bonus: 5 },
  cat: { emoji: "🐱", label: "Cat", cost: 450, bonus: 4 },
  dog: { emoji: "🐶", label: "Dog", cost: 400, bonus: 3 },
  dragon: { emoji: "🐉", label: "Dragon", cost: 1500, bonus: 10 },
};

/** @type {import("../../typings.d").Command} */
module.exports = async (client, interaction) => {
  const action = interaction.options.getString("action") || "view";
  const type = interaction.options.getString("type") || "fox";
  const pet = PETS[type];

  let profile = await Profile.findOne({ User: interaction.user.id });
  if (!profile) profile = await Profile.create({ User: interaction.user.id });

  if (action === "adopt") {
    if (!pet) return client.errNormal({ error: "That pet type does not exist.", type: "editreply" }, interaction);
    if (profile.Pet?.type) return client.errNormal({ error: `You already have ${profile.Pet.name || "a pet"}.`, type: "editreply" }, interaction);

    const Economy = require("../../database/models/economy");
    const updated = await Economy.findOneAndUpdate(
      { User: interaction.user.id, Money: { $gte: pet.cost } },
      { $inc: { Money: -pet.cost } },
      { new: true },
    );
    if (!updated) return client.errNormal({ error: `You need $${pet.cost} in your wallet.`, type: "editreply" }, interaction);

    profile.Pet = { name: `${interaction.user.username}'s ${pet.label}`, type, energy: 100, adoptedAt: new Date() };
    await profile.save();
    return client.succNormal({ text: `${pet.emoji} You adopted a **${pet.label}**!`, type: "editreply" }, interaction);
  }

  if (action === "feed") {
    if (!profile.Pet?.type) return client.errNormal({ error: "You don't have a pet yet.", type: "editreply" }, interaction);
    profile.Pet.energy = Math.min(100, (profile.Pet.energy || 0) + 25);
    await profile.save();
    return client.succNormal({ text: `🍖 **${profile.Pet.name}** is now at ${profile.Pet.energy}% energy.`, type: "editreply" }, interaction);
  }

  const current = profile.Pet?.type ? PETS[profile.Pet.type] : null;
  client.embed({
    title: "🐾・LightCore Pets",
    desc: current ? `${current.emoji} **${profile.Pet.name}**\nEnergy: **${profile.Pet.energy}%**` : "You don't have a pet yet.",
    fields: [
      { name: "Available pets", value: Object.entries(PETS).map(([key, p]) => `${p.emoji} **${p.label}** — $${p.cost} — \`${key}\``).join("\n") },
    ],
    type: "editreply",
  }, interaction);
};
