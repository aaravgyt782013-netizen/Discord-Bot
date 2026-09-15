const { Client } = require("discord.js");
const { SlashCommandBuilder } = require("discord.js");
const Discord = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get help with LightCore"),

  /** @param {Client} client */
  run: async (client, interaction) => {
    await interaction.deferReply({ withResponse: true });

    const prefix = client.config.discord.prefix || ".";
    const isPrefix = Boolean(interaction.message);
    const prefixCommands = client.prefixCommands ? [...client.prefixCommands.keys()] : [];
    const slashCommands = client.commands ? [...client.commands.keys()] : [];

    const uniquePrefix = [...new Set(prefixCommands)].sort();
    const uniqueSlash = [...new Set(slashCommands)].sort();
    const prefixPreview = uniquePrefix.slice(0, 80).map((name) => `\`${prefix}${name}\``).join(" • ") || "No prefix commands loaded yet.";

    const row = new Discord.ActionRowBuilder().addComponents(
      new Discord.StringSelectMenuBuilder()
        .setCustomId("Bot-helppanel")
        .setPlaceholder("Choose a LightCore help section")
        .addOptions([
          { label: "Prefix commands", description: `Use ${prefix} commands`, emoji: "⌨️", value: "commands-Bothelp" },
          { label: "Invite LightCore", description: "Invite LightCore to your server", emoji: "📨", value: "invite-Bothelp" },
          { label: "Support server", description: "Join the LightCore support server", emoji: "❓", value: "support-Bothelp" },
          { label: "Changelogs", description: "View LightCore updates", emoji: "📃", value: "changelogs-Bothelp" },
        ]),
    );

    const more = uniquePrefix.length > 80 ? `\n…and ${uniquePrefix.length - 80} more prefix commands.` : "";
    const desc = isPrefix
      ? `**LightCore prefix help**\nUse **${prefix}** before a command. Slash commands are also available in prefix form.\n\n${prefixPreview}${more}\n\nExample: **${prefix}ticket help**`
      : `Welcome to **LightCore**!\nUse the menu below for help. Prefix commands use **${prefix}** and the bot also supports slash commands.\n\nLoaded: **${uniquePrefix.length}** prefix features • **${uniqueSlash.length}** slash commands`;

    return client.embed({
      title: `❓・LightCore Help`,
      desc,
      fields: [
        { name: "🔗┆Invite", value: `[Invite LightCore](${client.config.discord.botInvite})`, inline: true },
        { name: "🛟┆Support", value: `[Support server](${client.config.discord.serverInvite})`, inline: true },
      ],
      components: [row],
      type: "editreply",
    }, interaction);
  },
};