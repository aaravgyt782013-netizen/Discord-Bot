const Discord = require("discord.js");
const ticketSchema = require("../../database/models/tickets");

function buildSetupPanel(client, interaction, data) {
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
    desc: "Build your ticket system interactively. Each category can use its own Discord category, support role, logs channel and transcript channel. Configure the public panel separately and publish it when ready.",
    fields: [
      { name: "🗂️┆Configured categories", value: list.slice(0, 4000), inline: false },
      { name: "⚙️┆Per-category configuration", value: "Name • Emoji • Description • Discord category • Support role • Logs • Transcript", inline: false },
      { name: "🎨┆Panel", value: "Use Panel Editor to customize the title/description and choose the public channel. Publishing updates the existing panel when possible instead of creating duplicates.", inline: false },
      { name: "🛡️┆Safety", value: "Only the administrator who opened this setup can use its controls.", inline: false },
    ],
    components: [row],
    type: interaction.isCommand?.() ? "editreply" : "reply",
  }, interaction);
}

module.exports = async (client, interaction) => {
  if (!interaction.guild) return;
  try {
    let data = await ticketSchema.findOne({ Guild: interaction.guild.id });
    if (!data) {
      data = new ticketSchema({ Guild: interaction.guild.id, TicketCount: 0, Categories: [], SetupDrafts: [] });
      await data.save();
    }
    return buildSetupPanel(client, interaction, data);
  } catch (error) {
    console.error("Ticket setup wizard error:", error);
    return client.errNormal({ error: "I could not open the ticket setup wizard. Please try again.", type: interaction.isCommand?.() ? "editreply" : "reply" }, interaction);
  }
};
