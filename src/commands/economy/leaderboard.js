const Schema = require("../../database/models/economy");

module.exports = async (client, interaction, args) => {
  const type = interaction.options.getString("type");

  if (type == "money") {
    const rawLeaderboard = await Schema.find({}).sort([["Money", "descending"]]).lean().exec();
    if (!rawLeaderboard.length)
      return client.errNormal({ error: "No data found!", type: "editreply" }, interaction);

    const lb = rawLeaderboard.map((e, index) =>
      `**${index + 1}** | <@!${e.User}> - ${client.emotes.economy.coins} \`$${e.Money}\``,
    );
    await client.createLeaderboard("🪙・Global Money Leaderboard", lb, interaction);
  } else if (type == "bank") {
    const rawLeaderboard = await Schema.find({}).sort([["Bank", "descending"]]).lean().exec();
    if (!rawLeaderboard.length)
      return client.errNormal({ error: "No data found!", type: "editreply" }, interaction);

    const lb = rawLeaderboard.map((e, index) =>
      `**${index + 1}** | <@!${e.User}> - ${client.emotes.economy.bank} \`$${e.Bank}\``,
    );
    await client.createLeaderboard("🏦・Global Bank Leaderboard", lb, interaction);
  }
};
