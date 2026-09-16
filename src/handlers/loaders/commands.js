const Discord = require("discord.js");
const { REST, Routes } = require("discord.js");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");

const PREFIX_ONLY_DIRS = new Set(["economy", "music"]);

const PREFIX_ONLY_OPTIONS = {
    economy: {
        balance: [{ name: "user", type: 6 }],
        leaderboard: [{ name: "type", type: 3 }],
        additem: [{ name: "role", type: 8 }, { name: "amount", type: 10 }],
        addmoney: [{ name: "user", type: 6 }, { name: "amount", type: 10 }],
        removemoney: [{ name: "user", type: 6 }, { name: "amount", type: 10 }],
        clear: [],
        deleteitem: [{ name: "role", type: 8 }],
        deposit: [{ name: "amount", type: 10 }],
        withdraw: [{ name: "amount", type: 10 }],
        pay: [{ name: "user", type: 6 }, { name: "amount", type: 10 }],
        rob: [{ name: "user", type: 6 }],
        profile: [],
        daily: [],
        hourly: [],
        weekly: [],
        monthly: [],
        yearly: [],
        beg: [],
        work: [],
        fish: [],
        hunt: [],
        crime: [],
        store: [],
        buy: [],
        present: [],
        pet: [],
        quest: [],
        boss: [],
    },
    music: {
        bassboost: [{ name: "level", type: 3 }],
        clear: [],
        loop: [],
        lyrics: [{ name: "song", type: 3 }],
        pause: [],
        play: [{ name: "song", type: 3 }],
        playing: [],
        previous: [],
        queue: [],
        remove: [{ name: "number", type: 10 }],
        resume: [],
        seek: [{ name: "time", type: 10 }],
        shuffle: [],
        skip: [],
        skipto: [{ name: "number", type: 10 }],
        stop: [],
        volume: [{ name: "amount", type: 10 }],
    },
};

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
                if (typeof handler !== "function" && typeof handler?.execute !== "function") continue;
                const fileName = entry.name.replace(/\.js$/, "").toLowerCase();
                const key = [...parts, fileName].join(" ").toLowerCase();
                client.prefixCommands.set(key, handler);

                const category = parts[0]?.toLowerCase();
                if (PREFIX_ONLY_DIRS.has(category)) {
                    client.prefixCommands.set(fileName, handler);
                }
                loaded++;
            } catch (error) {
                console.error(`Failed to load prefix feature ${full}:`, error);
            }
        }
    }

    walk(root);

    const aliases = {
        economy: {
            balance: ["bal", "money"],
            leaderboard: ["lb", "rich"],
            profile: ["prof"],
            daily: ["day"],
            hourly: ["hour"],
            weekly: ["week"],
            monthly: ["month"],
            yearly: ["year"],
            withdraw: ["with"],
            deposit: ["dep"],
            addmoney: ["givemoney"],
        },
        music: {
            playing: ["nowplaying", "np", "now"],
            queue: ["q"],
            pause: ["pa"],
            resume: ["unpause"],
            previous: ["prev"],
            skip: ["next"],
            skipto: ["st"],
            volume: ["vol"],
            bassboost: ["bb"],
            lyrics: ["lyric"],
            shuffle: ["shuff"],
        },
    };

    for (const entries of Object.values(aliases)) {
        for (const [command, names] of Object.entries(entries)) {
            const handler = client.prefixCommands.get(command);
            if (!handler) continue;
            for (const alias of names) {
                if (!client.prefixCommands.has(alias)) client.prefixCommands.set(alias, handler);
            }
        }
    }

    return loaded;
}

function addPrefixAliases(client) {
    const aliases = new Map([
        ["ticket", "tickets"],
        ["cmd", "commands"],
    ]);

    for (const [alias, target] of aliases) {
        if (client.commands.has(target) && !client.commands.has(alias)) {
            client.commands.set(alias, client.commands.get(target));
        }
    }
}

module.exports = (client) => {
    const interactionLogs = new Discord.WebhookClient({
        id: client.webhooks.interactionLogs.id,
        token: client.webhooks.interactionLogs.token,
    });

    const commands = [];
    const prefixCount = loadPrefixCommands(client);

    if (client.shard.ids[0] === 0) {
        console.log(chalk.blue(chalk.bold("LightCore")), chalk.white(">>"), chalk.green("Loading commands"), chalk.white("..."));
        console.log(chalk.blue(chalk.bold("LightCore")), chalk.white(">>"), chalk.red(`${prefixCount}`), chalk.green("prefix feature commands loaded"));
    }

    fs.readdirSync("./src/interactions").forEach((dirs) => {
        const commandFiles = fs.readdirSync(`./src/interactions/${dirs}`).filter((file) => file.endsWith(".js"));
        if (client.shard.ids[0] === 0) {
            console.log(chalk.blue(chalk.bold("LightCore")), chalk.white(">>"), chalk.red(`${commandFiles.length}`), chalk.green("commands of"), chalk.red(`${dirs}`), chalk.green("loaded"));
        }

        for (const file of commandFiles) {
            if (["economy.js", "music.js"].includes(file.toLowerCase())) continue;
            const command = require(`${process.cwd()}/src/interactions/${dirs}/${file}`);
            client.commands.set(command.data.name, command);
            commands.push(command.data);
        }
    });

    // Economy and music are prefix-only. Their legacy handlers already contain
    // the command logic, so expose a prefix-only adapter in the command collection
    // without adding anything to the Discord application-command registration body.
    for (const category of PREFIX_ONLY_DIRS) {
        const definitions = PREFIX_ONLY_OPTIONS[category] || {};
        for (const [name, options] of Object.entries(definitions)) {
            const handler = client.prefixCommands.get(name);
            if (!handler) continue;
            client.commands.set(name, {
                data: { name, options },
                run: async (bot, interaction, args) => handler(bot, interaction, args),
            });
        }
    }

    addPrefixAliases(client);

    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

    (async () => {
        try {
            await interactionLogs.send({
                username: "LightCore Logs",
                embeds: [new Discord.EmbedBuilder().setDescription("Started refreshing LightCore application commands.").setColor(client.config.colors.normal)],
            }).catch(() => {});

            await rest.put(Routes.applicationCommands(client.config.discord.id), { body: commands });

            await interactionLogs.send({
                username: "LightCore Logs",
                embeds: [new Discord.EmbedBuilder().setDescription(`Successfully reloaded ${commands.length} application commands and ${prefixCount} prefix feature commands.`).setColor(client.config.colors.normal)],
            }).catch(() => {});
        } catch (error) {
            console.log(error);
        }
    })();
};