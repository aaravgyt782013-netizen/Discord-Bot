const { SlashCommandBuilder } = require("discord.js");
const runPet = require("../../commands/economy/pet");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pet")
    .setDescription("Manage your LightCore pet")
    .addStringOption((o) => o.setName("action").setDescription("Pet action").addChoices({ name: "View", value: "view" }, { name: "Adopt", value: "adopt" }, { name: "Feed", value: "feed" }))
    .addStringOption((o) => o.setName("type").setDescription("Pet type").addChoices({ name: "Fox", value: "fox" }, { name: "Cat", value: "cat" }, { name: "Dog", value: "dog" }, { name: "Dragon", value: "dragon" })),
  run: async (client, interaction) => runPet(client, interaction),
};
