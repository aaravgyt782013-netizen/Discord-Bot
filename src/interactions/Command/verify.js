const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Configure server verification")
    .addSubcommand(s => s.setName("setup").setDescription("Create the Unverified role, locked channels and verification panel")),
  run: async () => {},
};
