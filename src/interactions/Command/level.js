const { SlashCommandBuilder } = require("discord.js");
const levelingCommand = require("../../handlers/games/levelingCommand");

module.exports = {
  data: new SlashCommandBuilder().setName("level").setDescription("View your server level and XP progress"),
  run: async (client, interaction) => levelingCommand.rank(interaction, interaction.user),
};
