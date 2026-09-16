const Discord = require("discord.js");
const Schema = require("../../database/models/afk");

function buildAfkEmbed(user, reason, createdAt) {
  return new Discord.EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: `${user.username} is AFK`, iconURL: user.displayAvatarURL?.({ size: 128 }) || undefined })
    .setDescription(`${user} is currently away.`)
    .addFields(
      { name: "💬 Reason", value: reason || "Not specified", inline: false },
      { name: "🕒 Since", value: `<t:${Math.floor(new Date(createdAt).getTime() / 1000)}:R>`, inline: true },
    )
    .setTimestamp();
}

/**
 * @type {import("../../typings.d").Command}
 */
module.exports = async (client, interaction) => {
  const reason = String(interaction.options.getString("reason") || "Not specified").trim().slice(0, 1000) || "Not specified";

  try {
    const existing = await Schema.findOne({ Guild: interaction.guild.id, User: interaction.user.id }).exec();
    if (existing) {
      return client.errNormal({ error: "You're already AFK!", type: "editreply" }, interaction);
    }

    const createdAt = new Date();
    await Schema.create({ Guild: interaction.guild.id, User: interaction.user.id, Message: reason, CreatedAt: createdAt });

    if (!interaction.member.displayName.includes("[AFK] ")) {
      await interaction.member.setNickname(`[AFK] ${interaction.member.displayName}`).catch(() => {});
    }

    await interaction.editReply?.({
      embeds: [new Discord.EmbedBuilder().setColor(0x57f287).setTitle("💤 AFK enabled").setDescription(`Your AFK status is now active.\n\n**Reason:** ${reason}`).setTimestamp()],
    }).catch(() => {});

    if (interaction.channel?.send) {
      await interaction.channel.send({ embeds: [buildAfkEmbed(interaction.user, reason, createdAt)] }).catch(() => {});
    }
  } catch (error) {
    console.error("AFK set error:", error);
    return client.errNormal({ error: "I couldn't set your AFK status. Please try again.", type: "editreply" }, interaction);
  }
};
