const Discord = require("discord.js");

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

module.exports = async (client, player, track) => {
  const row = new Discord.ActionRowBuilder().addComponents(
    new Discord.ButtonBuilder()
      .setEmoji(client.emotes.music.previous)
      .setCustomId("Bot-musicprev")
      .setStyle(Discord.ButtonStyle.Secondary),
    new Discord.ButtonBuilder()
      .setEmoji(client.emotes.music.pause)
      .setCustomId("Bot-musicpause")
      .setStyle(Discord.ButtonStyle.Secondary),
    new Discord.ButtonBuilder()
      .setEmoji(client.emotes.music.stop)
      .setCustomId("Bot-musicstop")
      .setStyle(Discord.ButtonStyle.Secondary),
    new Discord.ButtonBuilder()
      .setEmoji(client.emotes.music.next)
      .setCustomId("Bot-musicnext")
      .setStyle(Discord.ButtonStyle.Secondary),
  );

  const channel = client.channels.cache.get(player.textId);
  if (!channel?.isTextBased?.()) return;

  const thumbnail = track.thumbnail || track.info?.artworkUrl || track.info?.thumbnail || null;
  const duration = formatDuration(track.duration);
  const requester = track.requester?.toString?.() || track.requester || "Unknown";
  const author = track.author || track.info?.author || "Unknown";

  // Intentionally send a fresh message for every track. Never edit/reuse the
  // previous Now Playing message, so the channel keeps a complete play history.
  await channel.send({
    embeds: [new Discord.EmbedBuilder()
      .setColor(client.config.colors.normal)
      .setTitle(`${client.emotes.normal.music}・Now Playing`)
      .setDescription(`[${track.title || "Unknown track"}](${track.uri || "https://discord.com"})`)
      .addFields(
        { name: "🎵 Song", value: track.title || "Unknown", inline: false },
        { name: "⏱️ Duration", value: duration, inline: true },
        { name: "👤 Requester", value: String(requester), inline: true },
        { name: "🎬 Author", value: String(author), inline: true },
      )
      .setThumbnail(thumbnail)
      .setFooter({ text: "LightCore Music" })
      .setTimestamp()],
    components: [row],
  }).catch((error) => console.error("Failed to send Now Playing message:", error));
};
