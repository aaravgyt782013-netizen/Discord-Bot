const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("owner")
    .setDescription("LightCore bot-owner controls")
    .addSubcommandGroup((group) =>
      group
        .setName("economy")
        .setDescription("Manage the global LightCore economy")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Add global wallet money to a user")
            .addUserOption((option) =>
              option.setName("user").setDescription("Target user").setRequired(true),
            )
            .addNumberOption((option) =>
              option.setName("amount").setDescription("Amount to add").setRequired(true).setMinValue(1),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("set")
            .setDescription("Set a user's global wallet balance")
            .addUserOption((option) =>
              option.setName("user").setDescription("Target user").setRequired(true),
            )
            .addNumberOption((option) =>
              option.setName("amount").setDescription("New balance").setRequired(true).setMinValue(0),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remove")
            .setDescription("Remove global wallet money from a user")
            .addUserOption((option) =>
              option.setName("user").setDescription("Target user").setRequired(true),
            )
            .addNumberOption((option) =>
              option.setName("amount").setDescription("Amount to remove").setRequired(true).setMinValue(1),
            ),
        ),
    ),

  run: async (client, interaction, args) => {
    await interaction.deferReply({ withResponse: true });
    client.loadSubcommands(client, interaction, args);
  },
};
