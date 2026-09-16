const { SlashCommandBuilder, ChannelType } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("notifier")
    .setDescription("Manage YouTube upload notifications")
    .addSubcommand(s => s.setName("add").setDescription("Add a YouTube channel notifier").addStringOption(o => o.setName("youtube_url").setDescription("YouTube channel URL").setRequired(true)).addChannelOption(o => o.setName("channel").setDescription("Announcement channel").setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove a YouTube channel notifier").addStringOption(o => o.setName("youtube_url").setDescription("YouTube channel URL").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("List active YouTube notifiers")),
  run: async () => {},
};
