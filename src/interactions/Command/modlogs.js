const { SlashCommandBuilder, ChannelType } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("modlogs")
    .setDescription("Configure moderation logs")
    .addSubcommand(s => s.setName("set").setDescription("Set the moderation log channel").addChannelOption(o => o.setName("channel").setDescription("Log channel").setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName("off").setDescription("Disable moderation logs")),
  run: async () => {},
};
