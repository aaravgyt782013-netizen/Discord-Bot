const { Client, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get help with LightCore"),

  /** @param {Client} client */
  run: async (client, interaction) => {
    await interaction.deferReply({ withResponse: true });

    const prefix = client.config.discord.prefix || ".";
    const isPrefix = Boolean(interaction.message);
    const mode = isPrefix ? "prefix" : "slash";
    const owner = interaction.user.id;
    const customId = isPrefix ? `lc_phelp:${owner}` : `lc_help:${mode}:${owner}`;

    const menu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(isPrefix ? "Choose a prefix help category" : "Choose a LightCore help category")
      .addOptions([
        { label: "Moderation", description: isPrefix ? "View moderation prefix commands" : "View moderation slash commands", emoji: "🛡️", value: "moderation" },
        { label: "Tickets", description: isPrefix ? "View ticket prefix commands" : "View ticket slash commands", emoji: "🎫", value: "tickets" },
        { label: "Setup", description: isPrefix ? "View setup prefix commands" : "View setup slash commands", emoji: "⚙️", value: "setup" },
        { label: "Fun & Games", description: isPrefix ? "View fun and game prefix commands" : "View fun and game slash commands", emoji: "🎮", value: "fun" },
        { label: "Music", description: isPrefix ? "View music prefix commands" : "View music slash commands", emoji: "🎵", value: "music" },
        { label: "Economy", description: isPrefix ? "View economy prefix commands" : "View economy slash commands", emoji: "💰", value: "economy" },
        { label: "Utility", description: isPrefix ? "View utility prefix commands" : "View utility slash commands", emoji: "🔧", value: "utility" },
        { label: "Automation", description: isPrefix ? "View automation prefix commands" : "View automation slash commands", emoji: "🤖", value: "automation" },
        { label: "Other", description: isPrefix ? "View other prefix commands" : "View other slash commands", emoji: "📦", value: "other" },
      ]);

    const syntax = isPrefix ? `Prefix: **${prefix}**` : "Slash commands: **/**";
    const example = isPrefix ? `Example: **${prefix}ticket help**` : "Example: **/tickets help**";

    return client.embed({
      title: "❓・LightCore Help",
      desc: `Welcome to **LightCore**!\n\n${syntax}\n${example}\n\nSelect a category below to see **all loaded commands** for this mode.`,
      fields: [
        { name: "🔗┆Invite", value: `[Invite LightCore](${client.config.discord.botInvite})`, inline: true },
        { name: "🛟┆Support", value: `[Support server](${client.config.discord.serverInvite})`, inline: true },
      ],
      components: [new ActionRowBuilder().addComponents(menu)],
      type: "editreply",
    }, interaction);
  },
};
