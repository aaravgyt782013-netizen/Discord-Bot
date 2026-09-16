const { SlashCommandBuilder, ChannelType } = require("discord.js");
const levelingCommand = require("../../handlers/games/levelingCommand");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("levels")
    .setDescription("View and manage the per-server leveling system")
    .addSubcommand((sub) => sub.setName("help").setDescription("Show leveling commands"))
    .addSubcommand((sub) => sub.setName("rank").setDescription("View a user's server rank").addUserOption((o) => o.setName("user").setDescription("User to inspect")))
    .addSubcommand((sub) => sub.setName("leaderboard").setDescription("View the server XP leaderboard"))
    .addSubcommand((sub) => sub.setName("config").setDescription("Configure server leveling")
      .addIntegerOption((o) => o.setName("threshold").setDescription("Messages required per XP grant").setMinValue(1).setMaxValue(100))
      .addIntegerOption((o) => o.setName("min_xp").setDescription("Minimum random XP per grant").setMinValue(1).setMaxValue(1000))
      .addIntegerOption((o) => o.setName("max_xp").setDescription("Maximum random XP per grant").setMinValue(1).setMaxValue(1000))
      .addNumberOption((o) => o.setName("multiplier").setDescription("XP curve multiplier").setMinValue(0.1).setMaxValue(10))
      .addChannelOption((o) => o.setName("channel").setDescription("Level-up announcement channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addBooleanOption((o) => o.setName("announcements").setDescription("Enable level-up announcements"))
      .addIntegerOption((o) => o.setName("coin_reward").setDescription("Global coins awarded per level").setMinValue(0).setMaxValue(1000000)))
    .addSubcommand((sub) => sub.setName("reward").setDescription("Assign a stacking level milestone role")
      .addIntegerOption((o) => o.setName("level").setDescription("Milestone level").setRequired(true).setMinValue(1))
      .addRoleOption((o) => o.setName("role").setDescription("Role awarded at this level").setRequired(true)))
    .addSubcommand((sub) => sub.setName("deletereward").setDescription("Remove a level milestone role")
      .addIntegerOption((o) => o.setName("level").setDescription("Milestone level").setRequired(true).setMinValue(1)))
    .addSubcommand((sub) => sub.setName("rewards").setDescription("List configured milestone roles"))
    .addSubcommand((sub) => sub.setName("setxp").setDescription("Set a user's server XP")
      .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
      .addIntegerOption((o) => o.setName("amount").setDescription("XP amount").setRequired(true).setMinValue(0)))
    .addSubcommand((sub) => sub.setName("setlevel").setDescription("Set a user's server level")
      .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
      .addIntegerOption((o) => o.setName("level").setDescription("Level").setRequired(true).setMinValue(0))),

  run: async (client, interaction) => {
    if (!interaction.guild) return interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    const sub = interaction.options.getSubcommand();
    if (sub === "rank") return levelingCommand.rank(interaction, interaction.options.getUser("user") || interaction.user);
    if (sub === "leaderboard") return levelingCommand.leaderboard(interaction);
    if (sub === "config") return levelingCommand.configure(interaction);
    if (sub === "reward") return levelingCommand.addReward(interaction);
    if (sub === "deletereward") return levelingCommand.deleteReward(interaction);
    if (sub === "rewards") return levelingCommand.rewards(interaction);
    if (sub === "setxp") return levelingCommand.setXP(interaction);
    if (sub === "setlevel") return levelingCommand.setLevel(interaction);
    return levelingCommand.help(interaction);
  },
};
