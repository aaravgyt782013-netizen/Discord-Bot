const levelingService = require("../../handlers/games/levelingService");

module.exports = async (client, interaction, args) => {
  const { records } = await levelingService.getLeaderboard(interaction.guild.id, 10);
  if (!records.length) {
    return client.errNormal({ error: "No data found!", type: "editreply" }, interaction);
  }

  const lb = records.map((record, index) =>
    `**${index + 1}** | <@!${record.User}> - Level: \`${record.Level.toLocaleString()}\` (${record.XP.toLocaleString()} xp)`,
  );

  await client.createLeaderboard(`🆙・Levels - ${interaction.guild.name}`, lb, interaction);
};
