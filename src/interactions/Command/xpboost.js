const { SlashCommandBuilder } = require("discord.js");
const xpBoost = require("../../commands/xpboost");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("xpboost")
    .setDescription("Set a server-wide or individual leveling XP boost")
    .addStringOption((option) => option.setName("target").setDescription("server or a member mention/ID/username").setRequired(true))
    .addStringOption((option) => option.setName("multiplier").setDescription("Boost such as 1.5x, 2x, or off").setRequired(true).setMaxLength(10)),
  run: async (client, interaction) => xpBoost(client, interaction),
};
