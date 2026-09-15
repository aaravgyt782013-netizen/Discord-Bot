const Schema = require("../../../database/models/economy");

const OWNER_ID = "1244215702345482301";

module.exports = async (client, interaction) => {
  if (interaction.user.id !== OWNER_ID) {
    return client.errNormal({ error: "This command is restricted to the LightCore bot owner.", type: "editreply" }, interaction);
  }

  const user = interaction.options.getUser("user");
  const amount = Number(interaction.options.getNumber("amount"));

  if (!user || user.bot || !Number.isFinite(amount) || amount <= 0) {
    return client.errNormal({ error: "Provide a real user and a positive amount.", type: "editreply" }, interaction);
  }

  const money = Math.floor(amount);
  const data = await Schema.findOneAndUpdate(
    { User: user.id },
    { $inc: { Money: money }, $setOnInsert: { Bank: 0 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).exec();

  return client.succNormal({
    text: `Added **$${money.toLocaleString()}** to the user's global wallet.`,
    fields: [
      { name: "👤┆User", value: `${user}`, inline: true },
      { name: "💰┆New Wallet", value: `$${data.Money.toLocaleString()}`, inline: true },
    ],
    type: "editreply",
  }, interaction);
};
