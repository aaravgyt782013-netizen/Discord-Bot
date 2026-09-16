const { CommandInteraction, Client, SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Set your AFK")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("help")
        .setDescription("Get information about the AFK commands"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Put yourself AFK")
        .addStringOption((option) => option.setName("reason").setDescription("The reason for your AFK")),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("Show all AFK users"),
    ),
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   * @param {String[]} args
   */
  run: async (client, interaction, args) => {
    await interaction.deferReply({ withResponse: true });
    return client.loadSubcommands(client, interaction, args);
  },
};
