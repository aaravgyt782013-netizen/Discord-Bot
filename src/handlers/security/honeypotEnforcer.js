const Discord = require("discord.js");
const Honeypot = require("../../database/models/honeypot");

module.exports = async (client) => {
  client.on(Discord.Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot || !message.member) return;
    if (!message.member.permissions.has(Discord.PermissionsBitField.Flags.ManageMessages)) return;
    try {
      const config = await Honeypot.findOne({ Guild: message.guild.id, Enabled: true }).lean().exec();
      if (!config?.Channel || config.Channel !== message.channel.id) return;
      if (config.Action === "kick") await message.member.kick("LightCore honeypot triggered").catch(() => {});
      else await message.member.ban({ reason: "LightCore honeypot triggered", deleteMessageSeconds: 86400 }).catch(() => {});
    } catch (error) {
      console.error("Honeypot staff enforcement error:", error);
    }
  });
};
