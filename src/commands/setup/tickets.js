const Discord = require("discord.js");
const ticketSchema = require("../../database/models/tickets");

module.exports = async (client, interaction) => {
  if (!interaction.guild) return;
  try {
    let data = await ticketSchema.findOne({ Guild: interaction.guild.id });
    if (!data) data = new ticketSchema({ Guild: interaction.guild.id, TicketCount: 0, Categories: [] });

    const categories = (data.Categories || []).filter((item) => item.Enabled !== false);
    const list = categories.length
      ? categories.map((item, index) => `${index + 1}. ${item.Emoji || "🎫"} **${item.Name}** — ${item.Description || "Support ticket"}`).join("\n")
      : "No categories configured yet.";

    const row = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder().setCustomId(`lc_ts_add:${interaction.user.id}`).setLabel("Add Category").setEmoji("➕").setStyle(Discord.ButtonStyle.Success),
      new Discord.ButtonBuilder().setCustomId(`lc_ts_manage:${interaction.user.id}`).setLabel("Manage Categories").setEmoji("🗂️").setStyle(Discord.ButtonStyle.Secondary),
      new Discord.ButtonBuilder().setCustomId(`lc_ts_panel:${interaction.user.id}`).setLabel("Panel Editor").setEmoji("🎨").setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder().setCustomId(`lc_ts_publish:${interaction.user.id}`).setLabel("Publish Panel").setEmoji("📨").setStyle(Discord.ButtonStyle.Success),
    );

    return client.embed({
      title: "🎫・LightCore Ticket Setup",
      desc: "Use this setup panel to build your ticket system. Add multiple categories, configure each one independently, then customise and publish your public dropdown panel.",
      fields: [
        { name: "🗂️┆Categories", value: list, inline: false },
        { name: "⚙️┆Per category", value: "Every category can have its own Discord category, support role, logs channel and transcript channel.", inline: false },
        { name: "🎨┆Panel Editor", value: "At the end, set the panel title, description and channel, then publish it for your members.", inline: false },
      ],
      components: [row],
      type: interaction.isCommand?.() ? "editreply" : "reply",
    }, interaction);
  } catch (error) {
    console.error("Ticket setup wizard error:", error);
    return client.errNormal({ error: "I could not open the ticket setup wizard.", type: interaction.isCommand?.() ? "editreply" : "reply" }, interaction);
  }
};
