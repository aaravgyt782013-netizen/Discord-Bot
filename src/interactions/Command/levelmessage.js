const { SlashCommandBuilder } = require("discord.js");
const levelMessage = require("../../commands/levelmessage");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("levelmessage")
    .setDescription("Set the server's custom level-up message")
    .addStringOption((option) => option.setName("message").setDescription("Message template or reset").setRequired(true).setMaxLength(1000)),
  run: async (client, interaction) => levelMessage(client, interaction),
};
