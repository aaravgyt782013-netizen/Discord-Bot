const { SlashCommandBuilder } = require("discord.js");
const levelingCommand = require("../../handlers/games/levelingCommand");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("level")
    .setDescription("View a user's server level and XP progress")
    .addUserOption((option) => option.setName("user").setDescription("User to inspect"))
    .addStringOption((option) => option.setName("scope").setDescription("Use the leaderboard instead").addChoices({ name: "Server leaderboard", value: "server" }, { name: "Global leaderboard", value: "global" })),
  run: async (client, interaction) => {
    const scope = interaction.options.getString("scope");
    const rawTarget = interaction.options._hoistedOptions?.find((option) => option.name === "user")?.value;
    const prefixLeaderboard = typeof rawTarget === "string" && ["leaderboard", "global", "server"].includes(rawTarget.toLowerCase());

    if (scope === "global" || prefixLeaderboard) {
      const selectedScope = scope || (rawTarget.toLowerCase() === "global" ? "global" : "server");
      return levelingCommand.leaderboard(interaction, selectedScope);
    }
    return levelingCommand.rank(interaction, interaction.options.getUser("user") || interaction.user);
  },
};
