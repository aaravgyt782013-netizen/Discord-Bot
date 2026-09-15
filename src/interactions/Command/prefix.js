const { SlashCommandBuilder } = require("discord.js");
const Functions = require("../../database/models/functions");

const DEFAULT_PREFIX = ".";
const MAX_PREFIX_LENGTH = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("prefix")
    .setDescription("Set or reset LightCore's prefix for this server")
    .addStringOption((option) =>
      option
        .setName("value")
        .setDescription("New prefix, or 'reset' to return to .")
        .setRequired(false),
    ),

  run: async (client, interaction) => {
    const isAdministrator = interaction.member?.permissions?.has?.("Administrator");
    if (!isAdministrator) {
      return client.errNormal(
        { error: "You need Administrator permission to change the server prefix.", type: "editreply" },
        interaction,
      );
    }

    const value = interaction.options.getString("value");

    if (!value) {
      const current = await Functions.findOne({ Guild: interaction.guild.id }).lean().exec();
      return client.simpleEmbed(
        { desc: `⚙️┆This server's prefix is **${current?.Prefix || DEFAULT_PREFIX}**.`, type: "editreply" },
        interaction,
      );
    }

    if (value.toLowerCase() === "reset") {
      await Functions.findOneAndUpdate(
        { Guild: interaction.guild.id },
        { $set: { Prefix: DEFAULT_PREFIX } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).exec();
      return client.succNormal(
        { text: `The server prefix has been reset to **${DEFAULT_PREFIX}**.`, type: "editreply" },
        interaction,
      );
    }

    const prefix = value.trim();
    if (!prefix || prefix.length > MAX_PREFIX_LENGTH || /\s/.test(prefix) || prefix.startsWith("<@")) {
      return client.errNormal(
        { error: `Choose a prefix from 1-${MAX_PREFIX_LENGTH} characters with no spaces.`, type: "editreply" },
        interaction,
      );
    }

    await Functions.findOneAndUpdate(
      { Guild: interaction.guild.id },
      { $set: { Prefix: prefix } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();

    return client.succNormal(
      { text: `This server's prefix is now **${prefix}**.`, type: "editreply" },
      interaction,
    );
  },
};
