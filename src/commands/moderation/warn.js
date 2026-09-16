const Discord = require("discord.js");
const Schema = require("../../database/models/warnings");
const Case = require("../../database/models/warnCase");

module.exports = async (client, interaction, args) => {
  const perms = await client.checkUserPerms({ flags: [Discord.PermissionsBitField.Flags.ManageMessages], perms: [Discord.PermissionsBitField.Flags.ManageMessages] }, interaction);
  if (perms == false) { client.errNormal({ error: "You don't have the required permissions to use this command!", type: "editreply" }, interaction); return; }

  const member = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason");
  if (!member || member.bot) return client.errNormal({ error: "Please provide a valid non-bot user.", type: "editreply" }, interaction);
  if (!reason || !reason.trim()) return client.errNormal({ error: "Please provide a reason.", type: "editreply" }, interaction);

  let caseNumber;
  const caseData = await Case.findOneAndUpdate({ Guild: interaction.guild.id }, { $inc: { Case: 1 }, $setOnInsert: { Guild: interaction.guild.id, Case: 0 } }, { upsert: true, new: true }).exec();
  caseNumber = caseData.Case;

  const data = await Schema.findOneAndUpdate(
    { Guild: interaction.guild.id, User: member.id },
    { $push: { Warnings: { Moderator: interaction.user.id, Reason: reason.trim(), Date: Date.now(), Case: caseNumber } }, $setOnInsert: { Guild: interaction.guild.id, User: member.id } },
    { upsert: true, new: true },
  ).exec();

  await client.embed({ title: "🔨・Warn", desc: `You've been warned in **${interaction.guild.name}**`, fields: [{ name: "👤┆Moderator", value: interaction.user.tag, inline: true }, { name: "📄┆Reason", value: reason.trim(), inline: true }] }, member).catch(() => {});
  client.emit("warnAdd", member, interaction.user, reason.trim(), interaction.guild);
  return client.succNormal({ text: "User has received a warning!", fields: [{ name: "👤┆User", value: `${member}`, inline: true }, { name: "👤┆Moderator", value: `${interaction.user}`, inline: true }, { name: "📄┆Reason", value: reason.trim(), inline: false }], type: "editreply" }, interaction);
};
