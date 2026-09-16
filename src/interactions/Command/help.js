const { Client, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

const CATEGORY_ORDER = [
  "economy",
  "leveling",
  "music",
  "moderation",
  "tickets",
  "fun",
  "utility",
  "automation",
  "admin",
  "gambling",
  "other",
];

const LABELS = {
  economy: ["Economy", "💰"],
  leveling: ["Leveling", "🆙"],
  music: ["Music", "🎵"],
  moderation: ["Moderation", "🛡️"],
  tickets: ["Tickets", "🎫"],
  fun: ["Fun & Games", "🎮"],
  utility: ["Utility", "🔧"],
  automation: ["Automation", "🤖"],
  admin: ["Admin", "🛠️"],
  gambling: ["Gambling", "🎰"],
  other: ["Other", "📦"],
};

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
      .addOptions(CATEGORY_ORDER.map((category) => ({
        label: LABELS[category][0],
        description: isPrefix
          ? `View ${LABELS[category][0].toLowerCase()} prefix commands`
          : `View ${LABELS[category][0].toLowerCase()} slash commands`,
        emoji: LABELS[category][1],
        value: category,
      })));

    const syntax = isPrefix ? `Prefix: **${prefix}**` : "Slash commands: **/**";
    const example = isPrefix ? `Example: **${prefix}help**` : "Example: **/help**";

    return client.embed({
      title: "❓・LightCore Help",
      desc: `Welcome to **LightCore**!\n\n${syntax}\n${example}\n\nSelect a category below to see the **currently loaded commands** for this mode.`,
      fields: [
        { name: "🔗┆Invite", value: `[Invite LightCore](${client.config.discord.botInvite})`, inline: true },
        { name: "🛟┆Support", value: `[Support server](${client.config.discord.serverInvite})`, inline: true },
      ],
      components: [new ActionRowBuilder().addComponents(menu)],
      type: "editreply",
    }, interaction);
  },
};
