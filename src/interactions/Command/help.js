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
    const uniquePrefix = [...new Set(prefixCommands)].sort();

    // Keep the normal Help Panel layout. Prefix mode only changes command syntax.
    const commandSyntax = (name) => `${isPrefix ? prefix : "/"}${name}`;
    const ticketHelp = `${commandSyntax("ticket help")}`;
    const prefixPreview = uniquePrefix.slice(0, 80).map((name) => `\`${prefix}${name}\``).join(" • ") || "No prefix commands loaded yet.";
    const more = uniquePrefix.length > 80 ? `\n…and ${uniquePrefix.length - 80} more prefix commands.` : "";

    const row = new Discord.ActionRowBuilder().addComponents(
      new Discord.StringSelectMenuBuilder()
        .setCustomId("Bot-helppanel")
        .setPlaceholder("Choose a LightCore help section")
        .addOptions([
          { label: "Commands", description: "View LightCore commands", emoji: "⌨️", value: "commands-Bothelp" },
          { label: "Invite", description: "Invite LightCore to your server", emoji: "📨", value: "invite-Bothelp" },
          { label: "Support server", description: "Join the LightCore support server", emoji: "❓", value: "support-Bothelp" },
          { label: "Changelogs", description: "View LightCore updates", emoji: "📃", value: "changelogs-Bothelp" },
        ]),
    );

    const desc = isPrefix
      ? `Welcome to **LightCore**!\nUse the menu below for help. Prefix commands use **${prefix}**.\n\n**Prefix commands:**\n${prefixPreview}${more}\n\n**Ticket help:** **${ticketHelp}**`
      : `Welcome to **LightCore**!\nUse the menu below for help. Slash commands use **/** and prefix commands use **${prefix}**.\n\nExample: **/tickets help**`;

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
