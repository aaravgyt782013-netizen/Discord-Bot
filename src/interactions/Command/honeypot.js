const Discord = require("discord.js");
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("honeypot")
    .setDescription("Configure the hidden anti-raid honeypot")
    .addSubcommand(s => s.setName("setup").setDescription("Create or enable the honeypot").addStringOption(o => o.setName("action").setDescription("Action when triggered").setRequired(true).addChoices({ name: "Ban", value: "ban" }, { name: "Kick", value: "kick" })))
    .addSubcommand(s => s.setName("off").setDescription("Disable the honeypot")),
  run: async () => {},
};
