const { SlashCommandBuilder } = require("discord.js");
const levelingCommand = require("../../handlers/games/levelingCommand");

module.exports = {
  data: new SlashCommandBuilder().setName("leaderboard").setDescription("View the server leveling leaderboard"),
  run: async (client, interaction) => levelingCommand.leaderboard(interaction),
};
