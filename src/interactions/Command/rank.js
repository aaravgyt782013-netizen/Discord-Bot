const { SlashCommandBuilder } = require("discord.js");
const levelingCommand = require("../../handlers/games/levelingCommand");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("View a user's server level and XP progress")
    .addUserOption((o) => o.setName("user").setDescription("User to inspect")),
  run: async (client, interaction) => levelingCommand.rank(interaction, interaction.options.getUser("user") || interaction.user),
};
