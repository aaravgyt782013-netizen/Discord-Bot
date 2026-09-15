const Discord = require("discord.js");
const chalk = require("chalk");

module.exports = async (client) => {
  const startLogs = new Discord.WebhookClient({
    id: client.webhooks.startLogs.id,
    token: client.webhooks.startLogs.token,
  });

  console.log(`\u001b[0m`);
  console.log(
    chalk.blue(chalk.bold(`System`)),
    chalk.white(`>>`),
    chalk.red(`Shard #${client.shard.ids[0] + 1}`),
    chalk.green(`is ready!`),
  );
  console.log(
    chalk.blue(chalk.bold(`Bot`)),
    chalk.white(`>>`),
    chalk.green(`Started on`),
    chalk.red(`${client.guilds.cache.size}`),
    chalk.green(`servers!`),
  );

  const embed = new Discord.EmbedBuilder()
    .setTitle(`🆙・Finishing shard`)
    .setDescription(`A shard just finished`)
    .addFields(
      {
        name: "🆔┆ID",
        value: `${client.shard.ids[0] + 1}/${client.options.shardCount}`,
        inline: true,
      },
      { name: "📃┆State", value: `Ready`, inline: true },
    )
    .setColor(client.config.colors.normal);

  try {
    await startLogs.send({
      username: "Bot Logs",
      embeds: [embed],
    });
  } catch (error) {
    console.error("Startup webhook failed:", error);
  }

  setInterval(async () => {
    try {
      const results = await client.shard.fetchClientValues("guilds.cache.size");
      const totalGuilds = results.reduce((acc, guildCount) => acc + guildCount, 0);
      const statusText = process.env.DISCORD_STATUS
        ? process.env.DISCORD_STATUS.split(", ")
        : [
            `・❓┆/help`,
            `・💻┆${totalGuilds} servers`,
            `・📨┆discord.gg/Ehmqr5drSz`,
            `・🎉┆300+ commands`,
            `・🏷️┆Version ${require(`${process.cwd()}/package.json`).version}`,
          ];
      const randomText = statusText[Math.floor(Math.random() * statusText.length)];
      client.user.setPresence({
        activities: [{ name: randomText, type: Discord.ActivityType.Playing }],
        status: "online",
      });
    } catch (error) {
      console.error("Presence update failed:", error);
    }
  }, 50000);
};
