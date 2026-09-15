const Discord = require("discord.js");
const ticketSchema = require("../../database/models/tickets");
const ticketChannels = require("../../database/models/ticketChannels");
const ticketMessageConfig = require("../../database/models/ticketMessage");

const openingTickets = new Set();

module.exports = async (client, interaction) => {
  if (!interaction.guild) return;
  const type = interaction.isCommand?.() ? "editreply" : "reply";
  const selectedId = interaction.ticketCategoryId || interaction.values?.[0] || null;
  const reason = interaction.options?.getString?.("reason") || "Not given";
  const lockKey = `${interaction.guild.id}:${interaction.user.id}`;
  if (openingTickets.has(lockKey)) return client.errNormal({ error: "Your ticket request is already being processed. Please wait a moment.", type }, interaction);
  openingTickets.add(lockKey);

  try {
    const existing = await ticketChannels.findOne({ Guild: interaction.guild.id, creator: interaction.user.id, resolved: false }).lean();
    if (existing) {
      const existingChannel = interaction.guild.channels.cache.get(existing.channelID);
      return client.errNormal({ error: existingChannel ? `You already have an open ticket: ${existingChannel}` : "You already have an unresolved ticket. Please finish it before opening another.", type }, interaction);
    }

    const data = await ticketSchema.findOne({ Guild: interaction.guild.id });
    if (!data) return client.errNormal({ error: "Ticket setup is not configured yet. Ask an administrator to run `.setup tickets`.", type }, interaction);

    let categoryConfig = selectedId ? data.Categories?.find((item) => item.Enabled !== false && (item._id?.toString() === selectedId || item.Name === selectedId || item.Category === selectedId)) : null;
    if (!categoryConfig && data.Categories?.length) categoryConfig = data.Categories.find((item) => item.Enabled !== false) || data.Categories[0];
    if (!categoryConfig) {
      if (!data.Category || !data.Role) return client.errNormal({ error: "No ticket category is configured.", type }, interaction);
      categoryConfig = { Name: "Support", Category: data.Category, Role: data.Role, Logs: data.Logs, Transcript: data.Logs, Description: "Support ticket", Emoji: "🎫" };
    }

    const parent = interaction.guild.channels.cache.get(categoryConfig.Category);
    const role = interaction.guild.roles.cache.get(categoryConfig.Role);
    if (!parent || parent.type !== Discord.ChannelType.GuildCategory) return client.errNormal({ error: `The Discord category for **${categoryConfig.Name}** no longer exists. Please update the ticket setup.`, type }, interaction);
    if (!role) return client.errNormal({ error: `The support role for **${categoryConfig.Name}** no longer exists. Please update the ticket setup.`, type }, interaction);

    const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
    if (!botMember || !parent.permissionsFor(botMember)?.has(Discord.PermissionsBitField.Flags.ManageChannels)) {
      return client.errNormal({ error: "I need **Manage Channels** to create ticket channels. Please update my server permissions and try again.", type }, interaction);
    }

    const perms = [Discord.PermissionsBitField.Flags.ViewChannel, Discord.PermissionsBitField.Flags.SendMessages, Discord.PermissionsBitField.Flags.AttachFiles, Discord.PermissionsBitField.Flags.ReadMessageHistory, Discord.PermissionsBitField.Flags.AddReactions];
    const count = (data.TicketCount || 0) + 1;
    const ticketId = String(count).padStart(4, "0");
    const cleanName = String(categoryConfig.Name || "support").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "support";

    const channel = await interaction.guild.channels.create({
      name: `${cleanName}-${ticketId}`,
      type: Discord.ChannelType.GuildText,
      parent: parent.id,
      reason: `LightCore ticket opened by ${interaction.user.tag}`,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [Discord.PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: perms },
        { id: role.id, allow: perms },
      ],
    });

    data.TicketCount = count;
    await data.save();
    await new ticketChannels({ Guild: interaction.guild.id, TicketID: count, channelID: channel.id, creator: interaction.user.id, claimed: "None", Category: categoryConfig.Name, resolved: false }).save();

    const configuredMessage = await ticketMessageConfig.findOne({ Guild: interaction.guild.id }).lean();
    const openTicket = configuredMessage?.openTicket || `Thanks for creating a ticket, ${interaction.user}!\nSupport will be with you shortly.`;
    const row = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder().setCustomId("Bot_closeticket").setEmoji("🔒").setLabel("Close").setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder().setCustomId("Bot_claimTicket").setEmoji("✋").setLabel("Claim").setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder().setCustomId("Bot_transcriptTicket").setEmoji("📝").setLabel("Transcript").setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder().setCustomId("Bot_noticeTicket").setEmoji("🔔").setLabel("Notice").setStyle(Discord.ButtonStyle.Primary),
    );

    await client.embed({ title: `${categoryConfig.Emoji || "🎫"}・${categoryConfig.Name}`, desc: openTicket, fields: [
      { name: "👤┆Creator", value: `${interaction.user}`, inline: true },
      { name: "📂┆Category", value: categoryConfig.Name, inline: true },
      { name: "📄┆Subject", value: String(reason).slice(0, 1024), inline: true },
      { name: "⏰┆Created", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
    ], components: [row], content: `${interaction.user}, ${role}` }, channel);

    const logsChannel = categoryConfig.Logs ? interaction.guild.channels.cache.get(categoryConfig.Logs) : null;
    if (logsChannel?.isTextBased?.()) await client.embed({ title: "📝・Ticket opened", desc: `A new **${categoryConfig.Name}** ticket has been created.`, fields: [
      { name: "👤┆Creator", value: `${interaction.user.tag} (${interaction.user.id})` },
      { name: "📂┆Category", value: categoryConfig.Name },
      { name: "📌┆Channel", value: `${channel}` },
    ] }, logsChannel).catch(() => {});

    return client.succNormal({ text: `Your **${categoryConfig.Name}** ticket has been created! ${channel}`, type }, interaction);
  } catch (error) {
    console.error("Ticket creation error:", error);
    return client.errNormal({ error: "I could not create the ticket. Check my permissions and ticket configuration, then try again.", type }, interaction);
  } finally {
    openingTickets.delete(lockKey);
  }
};
