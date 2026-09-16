const Discord = require("discord.js");
const leveling = require("../../database/models/leveling");
const levelingService = require("../../handlers/games/levelingService");

module.exports = async (client, interaction, args) => {
  const perms = await client.checkUserPerms(
    { flags: [Discord.PermissionsBitField.Flags.ManageMessages], perms: [Discord.PermissionsBitField.Flags.ManageMessages] },
    interaction,
  );
  if (perms == false) return;

  const target = interaction.options.getUser("user");
  const xp = interaction.options.getNumber("amount");
  await levelingService.ensureLegacyMigration();
  const config = await levelingService.getConfig(interaction.guild.id);
  const user = await leveling.findOneAndUpdate(
    { Guild: interaction.guild.id, User: target.id },
    { $set: { XP: Math.max(0, xp), Level: levelingService.levelFor(Math.max(0, xp), config.XPMultiplier), LastUpdated: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  client.succNormal(
    { text: "XP has been modified successfully", fields: [
      { name: "🆕┆New XP", value: `${user.XP}`, inline: true },
      { name: "👤┆User", value: `${target} (${target.tag})`, inline: true },
    ], type: "editreply" },
    interaction,
  );
};
