const Discord = require("discord.js");

const ticketSchema = require("../../database/models/tickets");
const ticketChannels = require("../../database/models/ticketChannels");
const ticketMessageConfig = require("../../database/models/ticketMessage");

module.exports = async (client, interaction, args) => {
  if (!interaction.guild) return;

  const type = interaction.isCommand?.() ? "editreply" : "reply";
  const selectedId = interaction.ticketCategoryId || interaction.values?.[0] || null;
  const reason = interaction.options?.getString?.("reason") || "Not given";

  try {
    const existing = await ticketChannels.findOne({
      Guild: interaction.guild.id,
      creator: interaction.user.id,
      resolved: false,
    }).lean();

    if (existing) {
      return client.errNormal({ error: "Ticket limit reached. 1/1", type }, interaction);
    }

    const data = await ticketSchema.findOne({ Guild: interaction.guild.id });
    if (!data) return client.errNormal({ error: "Do the ticket setup first!", type }, interaction);

    let categoryConfig = null;
    if (selectedId) {
      categoryConfig = data.Categories?.find((item) =>
        item.Enabled !== false && (item._id?.toString() === selectedId || item.Name === selectedId || item.Category === selectedId)
      );
    }
    if (!categoryConfig && data.Categories?.length) {
      categoryConfig = data.Categories.find((item) => item.Enabled !== false) || data.Categories[0];
    }

    if (!categoryConfig) {
      if (!data.Category || !data.Role) return client.errNormal({ error: "No ticket category is configured.", type }, interaction);
      categoryConfig = {
        Name: "Support",
        Category: data.Category,
        Role: data.Role,
        Logs: data.Logs,
        Transcript: data.Logs,
        Description: "Support ticket",
        Emoji: "🎫",
      };
    }

    const parent = interaction.guild.channels.cache.get(categoryConfig.Category);
    const role = interaction.guild.roles.cache.get(categoryConfig.Role);
    if (!parent || parent.type !== Discord.ChannelType.GuildCategory) {
      return client.errNormal({ error: `The category for **${categoryConfig.Name}** no longer exists.`, type }, interaction);
    }
    if (!role) return client.errNormal({ error: `The support role for **${categoryConfig.Name}** no longer exists.`, type }, interaction);

    const perms = [
      Discord.PermissionsBitField.Flags.ViewChannel,
      Discord.PermissionsBitField.Flags.SendMessages,
      Discord.PermissionsBitField.Flags.AttachFiles,
      Discord.PermissionsBitField.Flags.ReadMessageHistory,
      Discord.PermissionsBitField.Flags.AddReactions,
    ];

    const count = (data.TicketCount || 0) + 1;
    data.TicketCount = count;
    await data.save();

    const ticketId = String(count).padStart(4, "0");
    const channel = await interaction.guild.channels.create({
      name: `${categoryConfig.Name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40)}-${ticketId}`,
      type: Discord.ChannelType.GuildText,
      parent: parent.id,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [Discord.PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: perms },
        { id: role.id, allow: perms },
      ],
    });

    await new ticketChannels({
      Guild: interaction.guild.id,
      TicketID: count,
      channelID: channel.id,
      creator: interaction.user.id,
      claimed: "None",
      Category: categoryConfig.Name,
    }).save();

    const configuredMessage = await ticketMessageConfig.findOne({ Guild: interaction.guild.id }).lean();
    const openTicket = configuredMessage?.openTicket || `Thanks for creating a ticket!\nSupport will be with you shortly.`;

    const row = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder().setCustomId("Bot_closeticket").setEmoji("🔒").setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder().setCustomId("Bot_claimTicket").setEmoji("✋").setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder().setCustomId("Bot_transcriptTicket").setEmoji("📝").setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder().setCustomId("Bot_noticeTicket").setEmoji("🔔").setStyle(Discord.ButtonStyle.Primary),
    );

    await client.embed({
      title: `${categoryConfig.Emoji || "🎫"}・${categoryConfig.Name}`,
      desc: openTicket,
      fields: [
        { name: "👤┆Creator", value: `${interaction.user}`, inline: true },
        { name: "📂┆Category", value: categoryConfig.Name, inline: true },
        { name: "📄┆Subject", value: reason, inline: true },
        { name: "⏰┆Created", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
      ],
      components: [row],
      content: `${interaction.user}, ${role}`,
    }, channel);

    const logsChannel = categoryConfig.Logs ? interaction.guild.channels.cache.get(categoryConfig.Logs) : null;
    if (logsChannel) {
      await client.embed({
        title: "📝・Ticket opened",
        desc: `A new **${categoryConfig.Name}** ticket has been created.`,
        fields: [
          { name: "👤┆Creator", value: `${interaction.user.tag} (${interaction.user.id})` },
          { name: "📂┆Category", value: categoryConfig.Name },
          { name: "📌┆Channel", value: `${channel}` },
        ],
      }, logsChannel).catch(() => {});
    }

    return client.succNormal({
      text: `Your **${categoryConfig.Name}** ticket has been created! ${channel}`,
      type,
    }, interaction);
  } catch (error) {
    console.error("Ticket creation error:", error);
    return client.errNormal({ error: "I could not create the ticket. Check my permissions and ticket configuration.", type }, interaction);
  }
};