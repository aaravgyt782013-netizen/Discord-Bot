const { SlashCommandBuilder } = require("discord.js");
const runQuest = require("../../commands/economy/quest");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quest")
    .setDescription("View or claim your LightCore daily quest")
    .addStringOption((o) => o.setName("action").setDescription("Quest action").addChoices({ name: "View", value: "view" }, { name: "Claim", value: "claim" })),
  run: async (client, interaction) => runQuest(client, interaction),
};
