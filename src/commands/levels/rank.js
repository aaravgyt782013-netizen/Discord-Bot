const Discord = require("discord.js");
const Canvacord = require("canvacord");

const Functions = require("../../database/models/functions");
const leveling = require("../../database/models/leveling");
const levelingService = require("../../handlers/games/levelingService");

module.exports = async (client, interaction, args) => {
  const data = await Functions.findOne({ Guild: interaction.guild.id });
  if (!(data && data.Levels == true)) {
    return client.errNormal({ error: "Levels are disabled in this guild!", type: "editreply" }, interaction);
  }

  await levelingService.ensureLegacyMigration();
  const target = interaction.options.getUser("user") || interaction.user;
  const record = await leveling.findOne({ Guild: interaction.guild.id, User: target.id }).exec();
  if (!record || record.XP <= 0) {
    return client.errNormal({ error: "This user has no levels!", type: "editreply" }, interaction);
  }

  const config = await levelingService.getConfig(interaction.guild.id);
  const position = await leveling.countDocuments({ Guild: interaction.guild.id, XP: { $gt: record.XP } }) + 1;
  const xpRequired = levelingService.xpFor(record.Level + 1, config.XPMultiplier);
  const rankCard = new Canvacord.Rank()
    .setAvatar(target.displayAvatarURL({ dynamic: false, extension: "png" }))
    .setRequiredXP(xpRequired)
    .setCurrentXP(record.XP)
    .setLevel(record.Level)
    .setProgressBar(client.config.colors.normal, "COLOR")
    .setUsername(target.username)
    .setDiscriminator(target.discriminator)
    .setStatus("dnd")
    .setRank(position);

  const image = await rankCard.build();
  interaction.editReply({ files: [new Discord.AttachmentBuilder(image, { name: "RankCard.png" })] });
};
