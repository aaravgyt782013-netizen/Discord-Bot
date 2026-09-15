const Discord = require("discord.js");
const ticketSchema = require("../../database/models/tickets");
const ticketChannels = require("../../database/models/ticketChannels");
const ticketMessageConfig = require("../../database/models/ticketMessage");

module.exports = async (client, interaction, args) => {
  const type = interaction.isCommand?.() ? "editreply" : "reply";

  try {
    const ticket = await ticketChannels.findOne({ Guild: interaction.guild.id, channelID: interaction.channel.id });
    if (!ticket) return client.errNormal({ error: "This is not a ticket!", type }, interaction);
    if (ticket.resolved) return client.errNormal({ error: "Ticket is already closed!", type }, interaction);

    const data = await ticketSchema.findOne({ Guild: interaction.guild.id });
    if (!data) return client.errNormal({ error: "Ticket setup was not found.", type }, interaction);

    const category = data.Categories?.find((item) => item.Name === ticket.Category);
    const parentId = category?.Category || data.Category;
    if (interaction.channel.parentId !== parentId) return client.errNormal({ error: "This ticket category is no longer configured.", type }, interaction);

    const logsChannel = interaction.guild.channels.cache.get(category?.Logs || data.Logs);
    const transcriptChannel = interaction.guild.channels.cache.get(category?.Transcript || category?.Logs || data.Logs);
    const creator = await client.users.fetch(ticket.creator).catch(() => null);

    await interaction.channel.permissionOverwrites.edit(ticket.creator, {
      ViewChannel: false, SendMessages: false, AttachFiles: false, ReadMessageHistory: false, AddReactions: false,
    }).catch(() => {});

    ticket.resolved = true;
    await ticket.save();
    await interaction.channel.setName(`closed-${String(ticket.TicketID).padStart(4, "0")}`).catch(() => {});

    if (logsChannel) {
      await client.embed({
        title: "🔒・Ticket closed",
        desc: `A **${ticket.Category || "Support"}** ticket was closed.`,
        fields: [
          { name: "📘┆Ticket ID", value: `${ticket.TicketID}` },
          { name: "👤┆Closer", value: `${interaction.user.tag} (${interaction.user.id})` },
          { name: "👤┆Creator", value: `<@!${ticket.creator}>` },
        ],
      }, logsChannel).catch(() => {});
    }

    if (transcriptChannel) await client.transcript(interaction, transcriptChannel).catch(() => {});
    if (creator) {
      const configured = await ticketMessageConfig.findOne({ Guild: interaction.guild.id }).lean().catch(() => null);
      await client.embed({
        desc: configured?.dmMessage || "Your ticket has been closed. A transcript has been saved.",
        fields: [{ name: "📄┆Ticket ID", value: `${ticket.TicketID}` }],
      }, creator).catch(() => {});
    }

    const row = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder().setCustomId("Bot_transcriptTicket").setEmoji("📝").setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder().setCustomId("Bot_openTicket").setEmoji("🔓").setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder().setCustomId("Bot_deleteTicket").setEmoji("⛔").setStyle(Discord.ButtonStyle.Danger),
    );

    await client.embed({ title: "🔒・Closed", desc: `📝 - Save transcript\n🔓 - Reopen ticket\n⛔ - Delete ticket`, components: [row] }, interaction.channel);
    return client.simpleEmbed({ desc: `Ticket closed by <@!${interaction.user.id}>`, type }, interaction);
  } catch (error) {
    console.error("Ticket close error:", error);
    return client.errNormal({ error: "Could not close the ticket.", type }, interaction);
  }
};