const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require("discord.js");
const configCommand = require("../../commands/automod/config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Manage AutoMod")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addSubcommand((s) => s.setName("help").setDescription("Get information about AutoMod"))
    .addSubcommand((s) => s.setName("antiinvite").setDescription("Enable/disable Discord invite filtering").addBooleanOption((o) => o.setName("active").setDescription("Enable filtering").setRequired(true)))
    .addSubcommand((s) => s.setName("antilinks").setDescription("Enable/disable link filtering").addBooleanOption((o) => o.setName("active").setDescription("Enable filtering").setRequired(true)))
    .addSubcommand((s) => s.setName("antispam").setDescription("Enable/disable spam filtering").addBooleanOption((o) => o.setName("active").setDescription("Enable filtering").setRequired(true)))
    .addSubcommand((s) => s.setName("config").setDescription("Configure AutoMod thresholds").addStringOption((o) => o.setName("type").setDescription("Setting").setRequired(true).addChoices({name:"Spam",value:"spam"},{name:"Spam Off",value:"spam-off"},{name:"Caps",value:"caps"},{name:"Caps Off",value:"caps-off"},{name:"Mass Mentions",value:"mentions"},{name:"Invites",value:"invite"},{name:"Links",value:"links"})).addIntegerOption((o) => o.setName("value").setDescription("Limit or percentage").setRequired(false).setMinValue(2).setMaxValue(100)).addIntegerOption((o) => o.setName("seconds").setDescription("Spam window").setRequired(false).setMinValue(2).setMaxValue(60)).addBooleanOption((o) => o.setName("active").setDescription("Enable/disable invites or links").setRequired(false)))
    .addSubcommand((s) => s.setName("linkschannel").setDescription("Allow links in a channel").addStringOption((o) => o.setName("type").setDescription("Action").setRequired(true).addChoices({name:"Add",value:"add"},{name:"Remove",value:"remove"})).addChannelOption((o) => o.setName("channel").setDescription("Channel").setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommandGroup((g) => g.setName("blacklist").setDescription("Manage banned words").addSubcommand((s) => s.setName("display").setDescription("Show banned words")).addSubcommand((s) => s.setName("add").setDescription("Add a banned word").addStringOption((o) => o.setName("word").setDescription("Word").setRequired(true))).addSubcommand((s) => s.setName("remove").setDescription("Remove a banned word").addStringOption((o) => o.setName("word").setDescription("Word").setRequired(true)))),
  run: async (client, interaction, args) => {
    await interaction.deferReply({ withResponse: true });
    if (interaction.options.getSubcommand() === "config") return configCommand(client, interaction, args);
    const perms = await client.checkUserPerms({ flags: [PermissionsBitField.Flags.ManageMessages], perms: [PermissionsBitField.Flags.ManageMessages] }, interaction);
    if (perms === false) return;
    return client.loadSubcommands(client, interaction, args);
  },
};
