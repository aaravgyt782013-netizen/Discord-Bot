const Discord = require("discord.js");
const ticketSchema = require("../../database/models/tickets");

module.exports = async (client, interaction, args) => {
  const name = interaction.options.getString("name");
  const description = interaction.options.getString("description");

  try {
    const ticketData = await ticketSchema.findOne({ Guild: interaction.guild.id });
    if (!ticketData) return client.errNormal({ error: "Run the ticket setup first!", type: "editreply" }, interaction);

    const channel = interaction.guild.channels.cache.get(ticketData.Channel);
    if (!channel) return client.errNormal({ error: "The configured ticket panel channel no longer exists.", type: "editreply" }, interaction);

    const categories = (ticketData.Categories?.length ? ticketData.Categories : [{
      Name: "Support",
      Category: ticketData.Category,
      Role: ticketData.Role,
      Logs: ticketData.Logs,
      Transcript: ticketData.Logs,
      Description: "Support ticket",
      Emoji: "🎫",
      Enabled: true,
    }]).filter((c) => c.Enabled !== false && c.Category && c.Role);

    if (!categories.length) return client.errNormal({ error: "Add at least one ticket category first!", type: "editreply" }, interaction);

    const options = categories.slice(0, 25).map((category, index) => ({
      label: String(category.Name || `Category ${index + 1}`).slice(0, 100),
      description: String(category.Description || "Open a support ticket").slice(0, 100),
      value: String(category.Name || category.Category).slice(0, 100),
      emoji: category.Emoji || "🎫",
    }));

    const menu = new Discord.StringSelectMenuBuilder()
      .setCustomId("Bot_ticket_select")
      .setPlaceholder("Select a ticket category...")
      .addOptions(options);

    const row = new Discord.ActionRowBuilder().addComponents(menu);

    await client.embed({
      title,
      desc: description,
      components: [row],
    }, channel);

    return client.succNormal({ text: `Ticket dropdown panel has been set up with **${categories.length}** categories!`, type: "editreply" }, interaction);
  } catch (error) {
    console.error("Ticket panel error:", error);
    return client.errNormal({ error: "Could not create the ticket panel.", type: "editreply" }, interaction);
  }
};