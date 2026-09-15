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
  const data = await Schema.findOne({ User: user.id }).exec();

  if (!data) {
    return client.errNormal({ error: "This user does not have a global economy account yet.", type: "editreply" }, interaction);
  }

  const removed = Math.min(data.Money, money);
  data.Money -= removed;
  await data.save();

  return client.succNormal({
    text: `Removed **$${removed.toLocaleString()}** from the user's global wallet.`,
    fields: [
      { name: "👤┆User", value: `${user}`, inline: true },
      { name: "💰┆New Wallet", value: `$${data.Money.toLocaleString()}`, inline: true },
    ],
    type: "editreply",
  }, interaction);
};
