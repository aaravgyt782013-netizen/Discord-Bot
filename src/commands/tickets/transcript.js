const Discord = require("discord.js");
const ticketSchema = require("../../database/models/tickets");
const ticketChannels = require("../../database/models/ticketChannels");

module.exports = async (client, interaction, args) => {
  const perms = await client.checkUserPerms({
    flags: [Discord.PermissionsBitField.Flags.ManageMessages],
    perms: [Discord.PermissionsBitField.Flags.ManageMessages],
  }, interaction);
  if (perms === false) return;

  const type = interaction.isCommand?.() ? "editreply" : "reply";

  try {
    const ticket = await ticketChannels.findOne({ Guild: interaction.guild.id, channelID: interaction.channel.id });
    if (!ticket) return client.errNormal({ error: "This is not a ticket!", type }, interaction);

    const data = await ticketSchema.findOne({ Guild: interaction.guild.id });
    if (!data) return client.errNormal({ error: "Ticket setup was not found.", type }, interaction);

    const category = data.Categories?.find((item) => item.Name === ticket.Category);
    const parentId = category?.Category || data.Category;
    if (interaction.channel.parentId !== parentId) return client.errNormal({ error: "This is not a configured ticket category!", type }, interaction);

    const transcriptChannelId = category?.Transcript || category?.Logs || data.Logs;
    const transcriptChannel = transcriptChannelId ? interaction.guild.channels.cache.get(transcriptChannelId) : null;
    if (!transcriptChannel) return client.errNormal({ error: "No transcript channel is configured for this ticket category.", type }, interaction);

    await client.simpleEmbed({ desc: `${client.emotes.animated.loading}・Transcript saving...`, type }, interaction);
    await client.transcript(interaction, transcriptChannel);
    return client.simpleEmbed({ desc: `Transcript saved to ${transcriptChannel}`, type: "editreply" }, interaction);
  } catch (error) {
    console.error("Ticket transcript error:", error);
    return client.errNormal({ error: "Could not save the transcript.", type }, interaction);
  }
};