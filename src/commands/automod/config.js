const Schema = require("../../database/models/functions");

module.exports = async (client, interaction) => {
  const type = interaction.options.getString("type");
  const value = interaction.options.getInteger("value");
  const seconds = interaction.options.getInteger("seconds");
  const active = interaction.options.getBoolean?.("active");
  const update = {};

  if (type === "spam") {
    if (!Number.isInteger(value) || value < 2 || value > 20 || !Number.isInteger(seconds) || seconds < 2 || seconds > 60) return client.errNormal({ error: "Spam settings require 2–20 messages and a 2–60 second window.", type: "editreply" }, interaction);
    update.AntiSpam = true; update.SpamLimit = value; update.SpamWindow = seconds * 1000;
  } else if (type === "spam-off") update.AntiSpam = false;
  else if (type === "caps") {
    if (!Number.isInteger(value) || value < 50 || value > 100) return client.errNormal({ error: "Caps threshold must be between 50 and 100 percent.", type: "editreply" }, interaction);
    update.CapsPercentage = value; update.AntiCaps = true;
  } else if (type === "caps-off") update.AntiCaps = false;
  else if (type === "mentions") {
    if (!Number.isInteger(value) || value < 2 || value > 20) return client.errNormal({ error: "Mass-mention limit must be between 2 and 20.", type: "editreply" }, interaction);
    update.MassMentionLimit = value;
  } else if (type === "invite" || type === "links") {
    if (typeof active !== "boolean") return client.errNormal({ error: "Choose true or false for this setting.", type: "editreply" }, interaction);
    update[type === "invite" ? "AntiInvite" : "AntiLinks"] = active;
  } else return client.errNormal({ error: "Unknown AutoMod setting.", type: "editreply" }, interaction);

  await Schema.findOneAndUpdate({ Guild: interaction.guild.id }, { $set: update, $setOnInsert: { Guild: interaction.guild.id, Prefix: "." } }, { upsert: true, new: true }).exec();
  return client.succNormal({ text: `AutoMod **${type}** configuration updated.`, type: "editreply" }, interaction);
};
