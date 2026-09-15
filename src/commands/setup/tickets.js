const ticketSchema = require("../../database/models/tickets");

module.exports = async (client, interaction, args) => {
  const category = interaction.options.getChannel("category");
  const role = interaction.options.getRole("role");
  const channel = interaction.options.getChannel("channel");
  const logs = interaction.options.getChannel("logs");

  if (!category || !role || !channel || !logs) {
    return client.errNormal({ error: "Please provide the category, support role, panel channel and logs channel.", type: "editreply" }, interaction);
  }

  try {
    let data = await ticketSchema.findOne({ Guild: interaction.guild.id });
    if (!data) data = new ticketSchema({ Guild: interaction.guild.id, TicketCount: 0, Categories: [] });

    const categoryName = category.name || `Category ${data.Categories.length + 1}`;
    const existing = data.Categories.find((item) => item.Category === category.id);

    if (existing) {
      existing.Name = categoryName;
      existing.Category = category.id;
      existing.Role = role.id;
      existing.Logs = logs.id;
      existing.Transcript = logs.id;
      existing.Enabled = true;
    } else {
      data.Categories.push({
        Name: categoryName,
        Category: category.id,
        Role: role.id,
        Logs: logs.id,
        Transcript: logs.id,
        Description: `Open a ${categoryName} ticket`,
        Emoji: "🎫",
        Enabled: true,
      });
    }

    // Keep the original fields for compatibility with existing ticket commands.
    if (!data.Category) data.Category = category.id;
    if (!data.Role) data.Role = role.id;
    data.Channel = channel.id;
    if (!data.Logs) data.Logs = logs.id;

    await data.save();

    return client.succNormal({
      text: `**${categoryName}** ticket category has been configured. You can run this command again for more categories.`,
      fields: [
        { name: "📂┆Category", value: `${category}` },
        { name: "🛡️┆Support role", value: `${role}` },
        { name: "📋┆Panel", value: `${channel}` },
        { name: "📝┆Logs / transcript", value: `${logs}` },
        { name: "🎫┆Total categories", value: `${data.Categories.length}` },
      ],
      type: "editreply",
    }, interaction);
  } catch (error) {
    console.error("Ticket setup error:", error);
    return client.errNormal({ error: "Could not save the ticket category configuration.", type: "editreply" }, interaction);
  }
};