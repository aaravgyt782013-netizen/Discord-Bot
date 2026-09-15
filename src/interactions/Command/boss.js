const { SlashCommandBuilder } = require("discord.js");
const runBoss = require("../../commands/economy/boss");

module.exports = {
  data: new SlashCommandBuilder().setName("boss").setDescription("Take on a LightCore PvE challenge for a reward"),
  run: async (client, interaction) => runBoss(client, interaction),
};
