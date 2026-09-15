const { CommandInteraction, Client } = require("discord.js");
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setDescription("Play the LightCore global economy")
    .addSubcommand((s) => s.setName("help").setDescription("Show economy commands"))
    .addSubcommand((s) => s.setName("profile").setDescription("Show your global LightCore profile"))
    .addSubcommand((s) => s.setName("balance").setDescription("See your balance").addUserOption((o) => o.setName("user").setDescription("Select a user")))
    .addSubcommand((s) => s.setName("daily").setDescription("Claim your daily money"))
    .addSubcommand((s) => s.setName("hourly").setDescription("Claim your hourly money"))
    .addSubcommand((s) => s.setName("weekly").setDescription("Claim your weekly money"))
    .addSubcommand((s) => s.setName("monthly").setDescription("Claim your monthly money"))
    .addSubcommand((s) => s.setName("yearly").setDescription("Claim your yearly money"))
    .addSubcommand((s) => s.setName("beg").setDescription("Ask for a random reward"))
    .addSubcommand((s) => s.setName("work").setDescription("Go to work"))
    .addSubcommand((s) => s.setName("fish").setDescription("Go fishing"))
    .addSubcommand((s) => s.setName("hunt").setDescription("Go exploring for rewards"))
    .addSubcommand((s) => s.setName("crime").setDescription("Run the existing risk-based economy activity"))
    .addSubcommand((s) => s.setName("deposit").setDescription("Deposit money to the bank").addNumberOption((o) => o.setName("amount").setDescription("Amount").setRequired(true)))
    .addSubcommand((s) => s.setName("withdraw").setDescription("Withdraw money from the bank").addNumberOption((o) => o.setName("amount").setDescription("Amount").setRequired(true)))
    .addSubcommand((s) => s.setName("pay").setDescription("Pay another user").addUserOption((o) => o.setName("user").setDescription("User").setRequired(true)).addNumberOption((o) => o.setName("amount").setDescription("Amount").setRequired(true)))
    .addSubcommand((s) => s.setName("store").setDescription("Show the economy store"))
    .addSubcommand((s) => s.setName("buy").setDescription("Buy an item from the store"))
    .addSubcommand((s) => s.setName("leaderboard").setDescription("See the economy leaderboard").addStringOption((o) => o.setName("type").setDescription("Leaderboard type").setRequired(true).addChoices({ name: "Money", value: "money" }, { name: "Bank", value: "bank" })))
    .addSubcommand((s) => s.setName("boss").setDescription("Fight a PvE boss for a reward"))
    .addSubcommand((s) => s.setName("quest").setDescription("View today's quest").addStringOption((o) => o.setName("action").setDescription("Quest action").addChoices({ name: "View", value: "view" }, { name: "Claim", value: "claim" })))
    .addSubcommand((s) => s.setName("pet").setDescription("View, adopt, or feed your pet").addStringOption((o) => o.setName("action").setDescription("Pet action").addChoices({ name: "View", value: "view" }, { name: "Adopt", value: "adopt" }, { name: "Feed", value: "feed" })).addStringOption((o) => o.setName("type").setDescription("Pet type").addChoices({ name: "Fox", value: "fox" }, { name: "Cat", value: "cat" }, { name: "Dog", value: "dog" }, { name: "Dragon", value: "dragon" })))
    .addSubcommand((s) => s.setName("present").setDescription("Get your weekly present"))
    .addSubcommand((s) => s.setName("additem").setDescription("Add a role item to the store").addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true)).addNumberOption((o) => o.setName("amount").setDescription("Price").setRequired(true)))
    .addSubcommand((s) => s.setName("deleteitem").setDescription("Delete a role item").addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true)))
    .addSubcommand((s) => s.setName("addmoney").setDescription("Add money to a user").addUserOption((o) => o.setName("user").setDescription("User").setRequired(true)).addNumberOption((o) => o.setName("amount").setDescription("Amount").setRequired(true)))
    .addSubcommand((s) => s.setName("removemoney").setDescription("Remove money from a user").addUserOption((o) => o.setName("user").setDescription("User").setRequired(true)).addNumberOption((o) => o.setName("amount").setDescription("Amount").setRequired(true)))
    .addSubcommand((s) => s.setName("clear").setDescription("Clear the economy")),

  /** @param {Client} client @param {CommandInteraction} interaction @param {String[]} args */
  run: async (client, interaction, args) => {
    await interaction.deferReply({ withResponse: true });
    client.loadSubcommands(client, interaction, args);
  },
};
