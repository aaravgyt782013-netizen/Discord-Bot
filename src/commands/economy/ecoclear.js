const Discord = require("discord.js");

const Schema = require("../../database/models/economy");
const Schema2 = require("../../database/models/economyTimeout");
const store = require("../../database/models/economyStore");

const OWNER_ID = "1244215702345482301";

/**
 * @type {import("../../typings.d").Command}
 */
module.exports = async (client, interaction, args) => {
  if (interaction.user.id !== OWNER_ID) {
    return client.errNormal(
      { error: `Only the LightCore bot owner can reset the global economy.`, type: "editreply" },
      interaction,
    );
  }

  const row = new Discord.ActionRowBuilder().addComponents(
    new Discord.ButtonBuilder()
      .setCustomId(`lc_global_eco_reset:${interaction.user.id}:yes`)
      .setEmoji("✅")
      .setStyle(Discord.ButtonStyle.Success),
    new Discord.ButtonBuilder()
      .setCustomId(`lc_global_eco_reset:${interaction.user.id}:no`)
      .setEmoji("❌")
      .setStyle(Discord.ButtonStyle.Danger),
  );

  await client.embed(
    {
      title: `⏰・Reset global economy`,
      desc: `This resets **all users' global wallet and bank balances**. Continue?`,
      components: [row],
      type: "editreply",
    },
    interaction,
  );

  try {
    const i = await interaction.channel.awaitMessageComponent({
      filter: (component) => component.user.id === OWNER_ID,
      componentType: Discord.ComponentType.Button,
      time: 60000,
    });

    await i.deferUpdate().catch(() => {});

    if (i.customId.endsWith(":no")) {
      return client.errNormal(
        { error: `The global economy reset was cancelled.`, components: [], type: "editreply" },
        interaction,
      );
    }

    await Promise.all([
      Schema.deleteMany({}),
      Schema2.deleteMany({ Guild: interaction.guild.id }),
      store.deleteMany({ Guild: interaction.guild.id }),
    ]);

    return client.succNormal(
      { text: `The global economy wallet balances have been reset.`, components: [], type: "editreply" },
      interaction,
    );
  } catch (_) {
    return client.errNormal(
      { error: `Time's up! The global economy reset was cancelled.`, components: [], type: "editreply" },
      interaction,
    );
  }
};

module.exports.description = "Owner-only: resets the global economy wallets.";
