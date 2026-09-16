const Discord = require("discord.js");
const Schema = require("../../database/models/functions");

const usersMap = new Map();

module.exports = async (client) => {
  client.on(Discord.Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot || message.channel.type === Discord.ChannelType.DM || message.member?.permissions?.has(Discord.PermissionsBitField.Flags.ManageMessages)) return;
    try {
      const data = await Schema.findOne({ Guild: message.guild.id }).lean().exec();
      if (!data?.AntiSpam) return;
      const limit = Math.max(2, Number(data.SpamLimit || 5));
      const window = Math.max(2000, Number(data.SpamWindow || 10000));
      const key = `${message.guild.id}:${message.author.id}`;
      const now = Date.now();
      const state = (usersMap.get(key) || []).filter((time) => now - time <= window);
      state.push(now);
      usersMap.set(key, state);
      if (state.length < limit) return;
      usersMap.delete(key);
      await message.delete().catch(() => {});
      await client.embed({ title: `${client.emotes.normal.error}・Moderator`, desc: `It is not allowed to spam in this server!`, color: client.config.colors.error, content: `${message.author}` }, message.channel).catch(() => {});
    } catch (error) {
      console.error("Anti-spam handler error:", error);
    }
  });
};
