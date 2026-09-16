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
  const level = Math.max(0, interaction.options.getNumber("level"));
  await levelingService.ensureLegacyMigration();
  const user = await leveling.findOneAndUpdate(
    { Guild: interaction.guild.id, User: target.id },
    { $set: { Level: level, LastUpdated: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  client.succNormal(
    { text: "Level has been modified successfully", fields: [
      { name: "🆕┆New Level", value: `${user.Level}`, inline: true },
      { name: "👤┆User", value: `${target} (${target.tag})`, inline: true },
    ], type: "editreply" },
    interaction,
  );
};
