const Schema = require("../../database/models/economy");

const OWNER_ID = "1244215702345482301";

/**
 * @type {import("../../typings.d").Command}
 */
module.exports = async (client, interaction) => {
  if (interaction.user.id !== OWNER_ID) {
    return client.errNormal({ error: `Only the LightCore bot owner can modify global money.`, type: "editreply" }, interaction);
  }

  const user = interaction.options.getUser("user");
  const amount = Number(interaction.options.getNumber("amount"));

  if (!user || user.bot || !Number.isFinite(amount) || amount <= 0) {
    return client.errNormal({ error: `Provide a real user and a positive amount.`, type: "editreply" }, interaction);
  }

  const money = Math.floor(amount);
  const data = await Schema.findOneAndUpdate(
    { User: user.id, Money: { $gte: money } },
    { $inc: { Money: -money } },
    { new: true },
  ).exec();

  if (!data) {
    return client.errNormal({ error: `The user does not have enough global wallet balance for that removal.`, type: "editreply" }, interaction);
  }

  return client.succNormal({
    text: `Removed **$${money.toLocaleString()}** from the user's global wallet.`,
    fields: [
      { name: `👤┆User`, value: `${user}`, inline: true },
      { name: `💰┆New Wallet`, value: `$${data.Money.toLocaleString()}`, inline: true },
    ],
    type: "editreply",
  }, interaction);
};
