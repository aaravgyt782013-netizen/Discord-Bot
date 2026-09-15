const Discord = require("discord.js");
const { REST, Routes, Chalk } = require("discord.js");
const chalk = new Chalk();
const fs = require("fs");
const path = require("path");

function loadPrefixCommands(client) {
    client.prefixCommands = new Discord.Collection();
    const root = path.join(process.cwd(), "src", "commands");
    let loaded = 0;

    function walk(current, parts = []) {
        if (!fs.existsSync(current)) return;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full, [...parts, entry.name]);
                continue;
            }
            if (!entry.isFile() || !entry.name.endsWith(".js")) continue;

            try {
                const handler = require(full);
                if (typeof handler !== "function") continue;
                const key = [...parts, entry.name.replace(/\.js$/, "")].join(" ").toLowerCase();
                client.prefixCommands.set(key, handler);
                loaded++;
            } catch (error) {
                console.error(`Failed to load prefix command ${full}:`, error);
            }
        }
    }

    walk(root);
    return loaded;
}

module.exports = (client) => {
    const interactionLogs = new Discord.WebhookClient({
        id: client.webhooks.interactionLogs.id,
        token: client.webhooks.interactionLogs.token,
    });

    const commands = [];
    const prefixCount = loadPrefixCommands(client);

    if (client.shard.ids[0] === 0) {
        console.log(chalk.blue(chalk.bold("System")), chalk.white(">>"), chalk.green("Loading commands"), chalk.white("..."));
        console.log(chalk.blue(chalk.bold("System")), chalk.white(">>"), chalk.red(`${prefixCount}`), chalk.green("prefix feature commands loaded"));
    }

    fs.readdirSync("./src/interactions").forEach((dirs) => {
        const commandFiles = fs.readdirSync(`./src/interactions/${dirs}`).filter((file) => file.endsWith(".js"));
        if (client.shard.ids[0] === 0) {
            console.log(chalk.blue(chalk.bold("System")), chalk.white(">>"), chalk.red(`${commandFiles.length}`), chalk.green("commands of"), chalk.red(`${dirs}`), chalk.green("loaded"));
        }

        for (const file of commandFiles) {
            const command = require(`${process.cwd()}/src/interactions/${dirs}/${file}`);
            client.commands.set(command.data.name, command);
            commands.push(command.data);
        }
    });

    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

    (async () => {
        try {
            await interactionLogs.send({
                username: "Bot Logs",
                embeds: [new Discord.EmbedBuilder().setDescription("Started refreshing application (/) commands.").setColor(client.config.colors.normal)],
            }).catch(() => {});

            await rest.put(Routes.applicationCommands(client.config.discord.id), { body: commands });

            await interactionLogs.send({
                username: "Bot Logs",
                embeds: [new Discord.EmbedBuilder().setDescription(`Successfully reloaded ${commands.length} application (/) commands and ${prefixCount} prefix feature commands.`).setColor(client.config.colors.normal)],
            }).catch(() => {});
        } catch (error) {
            console.log(error);
        }
    })();
};