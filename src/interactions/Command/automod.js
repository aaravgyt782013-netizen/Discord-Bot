const { CommandInteraction, Client } = require("discord.js");
const { SlashCommandBuilder } = require("discord.js");
const { ChannelType } = require("discord.js");
const Discord = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Manage the auto mod")
    .addSubcommand((subcommand) => subcommand.setName("help").setDescription("Get information about the auto setup commands"))
    .addSubcommand((subcommand) => subcommand.setName("antiinvite").setDescription("Enable/disable antiinvite").addBooleanOption((option) => option.setName("active").setDescription("Select a boolean").setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName("antilinks").setDescription("Enable/disable antilinks").addBooleanOption((option) => option.setName("active").setDescription("Select a boolean").setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName("antispam").setDescription("Enable/disable antispam").addBooleanOption((option) => option.setName("active").setDescription("Select a boolean").setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName("config").setDescription("Configure AutoMod thresholds").addStringOption((option) => option.setName("type").setDescription("Setting to change").setRequired(true).addChoices({ name: "Spam", value: "spam" }, { name: "Caps", value: "caps" }, { name: "Caps Off", value: "caps-off" }, { name: "Mass Mentions", value: "mentions" })).addIntegerOption((option) => option.setName("value").setDescription("Messages/percent/mention limit").setRequired(false).setMinValue(2).setMaxValue(100)).addIntegerOption((option) => option.setName("seconds").setDescription("Spam time window in seconds").setRequired(false).setMinValue(2).setMaxValue(60)))
    .addSubcommand((subcommand) => subcommand.setName("linkschannel").setDescription("Add a channel that is allowed to send links").addStringOption((option) => option.setName("type").setDescription("What do you want to do with the channel?").setRequired(true).addChoices({ name: "Add", value: "add" }, { name: "Remove", value: "remove" })).addChannelOption((option) => option.setName("channel").setDescription("Select a channel").setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommandGroup((group) => group.setName("blacklist").setDescription("Manage the blacklist").addSubcommand((subcommand) => subcommand.setName("display").setDescription("Show the whole blacklist")).addSubcommand((subcommand) => subcommand.setName("add").setDescription("Add a word to the blacklist").addStringOption((option) => option.setName("word").setDescription("The word for the blacklist").setRequired(true))).addSubcommand((subcommand) => subcommand.setName("remove").setDescription("Remove a word from the blacklist").addStringOption((option) => option.setName("word").setDescription("The word for the blacklist").setRequired(true)))),
  run: async (client, interaction, args) => {
    // Part2 security handler owns this subcommand so it can share the same logic with prefix mode.
    if (interaction.options.getSubcommand?.() === "config") return;
    await interaction.deferReply({ withResponse: true });
    const perms = await client.checkUserPerms({ flags: [Discord.PermissionsBitField.Flags.ManageMessages], perms: [Discord.PermissionsBitField.Flags.ManageMessages] }, interaction);
    if (perms == false) return;
    client.loadSubcommands(client, interaction, args);
  },
};
