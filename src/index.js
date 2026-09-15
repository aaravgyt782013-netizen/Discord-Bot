const Discord = require("discord.js");
const { Chalk } = require("chalk");
const chalk = new Chalk();
const http = require("http");

require("dotenv").config();
const axios = require("axios");
const Topgg = require("@top-gg/sdk");
const { version } = require(".././package.json");

// Render/Web-Service health server. Render terminates HTTPS in front of this port.
// Do not hard-code an HTTPS listener here: the PORT environment variable is
// assigned by Render and the public service is exposed as HTTPS automatically.
const PORT = Number(process.env.PORT) || 3000;
const healthServer = http.createServer((req, res) => {
    const url = (req.url || "/").split("?")[0];

    if (req.method !== "GET") {
        res.writeHead(405, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Method Not Allowed" }));
    }

    if (url === "/" || url === "/health" || url === "/healthz") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
            ok: true,
            service: "Discord Bot",
            status: "online",
            uptime: Math.floor(process.uptime()),
        }));
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "Not Found" }));
});

healthServer.on("error", (error) => {
    console.error("Health server error:", error);
});

healthServer.listen(PORT, "0.0.0.0", () => {
    console.log(chalk.blue(chalk.bold("Web")), chalk.white(">>"), chalk.green(`Health server listening on port ${PORT}`));
});

axios
    .get("https://api.github.com/repos/CorwinDev/Discord-Bot/releases/latest")
    .then((res) => {
        if (res.data.tag_name !== version) {
            const currentVersion = version
                .replace(/^v/, "")
                .split(".")
                .map(Number);
            const latestVersion = res.data.tag_name
                .replace(/^v/, "")
                .split(".")
                .map(Number);
            let isNewer = false;

            for (
                let i = 0;
                i < Math.max(currentVersion.length, latestVersion.length);
                i++
            ) {
                const current = currentVersion[i] || 0;
                const latest = latestVersion[i] || 0;

                if (latest > current) {
                    isNewer = true;
                    break;
                }

                if (latest < current) {
                    break;
                }
            }

            if (isNewer) {
                console.log(
                    chalk.red.bgYellow(
                        `Your bot is not up to date! Please update to the latest version!`,
                        version + " -> " + res.data.tag_name,
                    ),
                );
            }
        }
    })
    .catch(() => {
        console.log(
            chalk.red.bgYellow(`Failed to check if bot is up to date!`),
        );
    });

const webhook = require("./config/webhooks.json");
const config = require("./config/bot.js");
const webHooksArray = [
    "startLogs",
    "shardLogs",
    "errorLogs",
    "dmLogs",
    "voiceLogs",
    "serverLogs",
    "serverLogs2",
    "commandLogs",
    "consoleLogs",
    "warnLogs",
    "voiceErrorLogs",
    "creditLogs",
    "evalLogs",
    "interactionLogs",
];

if (process.env.WEBHOOK_ID && process.env.WEBHOOK_TOKEN) {
    for (const webhookName of webHooksArray) {
        webhook[webhookName].id = process.env.WEBHOOK_ID;
        webhook[webhookName].token = process.env.WEBHOOK_TOKEN;
    }
}

const startLogs = new Discord.WebhookClient({
    id: webhook.startLogs.id,
    token: webhook.startLogs.token,
});

const shardLogs = new Discord.WebhookClient({
    id: webhook.shardLogs.id,
    token: webhook.shardLogs.token,
});

const manager = new Discord.ShardingManager("./src/bot.js", {
    totalShards: "auto",
    token: process.env.DISCORD_TOKEN,
    respawn: true,
    execArgv: ["--trace-warnings"],
});

if (process.env.TOPGG_TOKEN) {
    const client = new Topgg.Api(process.env.TOPGG_TOKEN);
    setInterval(
        async () => {
            try {
                await client.postMetrics({
                    serverCount:
                        (
                            await manager.broadcastEval(
                                (client) => client.guilds.cache.size,
                            )
                        ).reduce((a, b) => a + b, 0) || 0,
                    shardCount: manager.totalShards || 0,
                });
            } catch (error) {
                console.error("Top.gg metrics error:", error);
            }
        },
        30 * 60 * 1000,
    );

    setTimeout(async () => {
        try {
            const commands = await manager.broadcastEval(
                async (client) => {
                    return (await client.application.commands.fetch()).map(
                        (command) => command.toJSON(),
                    );
                },
                { shard: 0 },
            );

            await client.postCommands(commands);
            await client.postMetrics({
                serverCount:
                    (
                        await manager.broadcastEval(
                            (client) => client.guilds.cache.size,
                        )
                    ).reduce((a, b) => a + b, 0) || 0,
                shardCount: manager.totalShards || 0,
            });
        } catch (error) {
            console.error("Top.gg startup sync error:", error);
        }
    }, 10000);
}

console.clear();
console.log(
    chalk.blue(chalk.bold(`System`)),
    chalk.white(`>>`),
    chalk.green(`Starting up`),
    chalk.white(`...`),
);
console.log(`\u001b[0m`);
console.log(chalk.red(`© CorwinDev | 2021 - ${new Date().getFullYear()}`));
console.log(chalk.red(`All rights reserved`));
console.log(`\u001b[0m`);
console.log(`\u001b[0m`);
console.log(
    chalk.blue(chalk.bold(`System`)),
    chalk.white(`>>`),
    chalk.red(`Version ${require(`${process.cwd()}/package.json`).version}`),
    chalk.green(`loaded`),
);
console.log(`\u001b[0m`);

manager.on("shardCreate", (shard) => {
    const embed = new Discord.EmbedBuilder()
        .setTitle(`🆙・Launching shard`)
        .setDescription(`A shard has just been launched`)
        .setFields([
            {
                name: "🆔┆ID",
                value: `${shard.id + 1}/${manager.totalShards}`,
                inline: true,
            },
            {
                name: `📃┆State`,
                value: `Starting up...`,
                inline: true,
            },
        ])
        .setColor(config.colors.normal);

    startLogs.send({
        username: "Bot Logs",
        embeds: [embed],
    }).catch(() => {});

    console.log(
        chalk.blue(chalk.bold(`System`)),
        chalk.white(`>>`),
        chalk.green(`Starting`),
        chalk.red(`Shard #${shard.id + 1}`),
        chalk.white(`...`),
    );
    console.log(`\u001b[0m`);

    shard.on("death", (process) => {
        const embed = new Discord.EmbedBuilder()
            .setTitle(
                `🚨・Closing shard ${shard.id + 1}/${manager.totalShards} unexpectedly`,
            )
            .setFields([
                {
                    name: "🆔┆ID",
                    value: `${shard.id + 1}/${manager.totalShards}`,
                },
            ])
            .setColor(config.colors.normal);
        shardLogs.send({
            username: "Bot Logs",
            embeds: [embed],
        }).catch(() => {});

        if (process.exitCode === null) {
            const errorEmbed = new Discord.EmbedBuilder()
                .setTitle(
                    `🚨・Shard ${shard.id + 1}/${manager.totalShards} exited with NULL error code!`,
                )
                .setFields([
                    {
                        name: "PID",
                        value: `\`${process.pid}\``,
                    },
                    {
                        name: "Exit code",
                        value: `\`${process.exitCode}\``,
                    },
                ])
                .setColor(config.colors.normal);
            shardLogs.send({
                username: "Bot Logs",
                embeds: [errorEmbed],
            }).catch(() => {});
        }
    });

    shard.on("shardDisconnect", () => {
        const embed = new Discord.EmbedBuilder()
            .setTitle(
                `🚨・Shard ${shard.id + 1}/${manager.totalShards} disconnected`,
            )
            .setDescription("Dumping socket close event...")
            .setColor(config.colors.normal);
        shardLogs.send({
            username: "Bot Logs",
            embeds: [embed],
        }).catch(() => {});
    });

    shard.on("shardReconnecting", () => {
        const embed = new Discord.EmbedBuilder()
            .setTitle(
                `🚨・Reconnecting shard ${shard.id + 1}/${manager.totalShards}`,
            )
            .setColor(config.colors.normal);
        shardLogs.send({
            username: "Bot Logs",
            embeds: [embed],
        }).catch(() => {});
    });
});

manager.spawn().catch((error) => {
    console.error("Failed to spawn Discord shards:", error);
});

const consoleLogs = new Discord.WebhookClient({
    id: webhook.consoleLogs.id,
    token: webhook.consoleLogs.token,
});

const warnLogs = new Discord.WebhookClient({
    id: webhook.warnLogs.id,
    token: webhook.warnLogs.token,
});

process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);

    if (!error) return;

    let errorText = error.stack || String(error);
    if (errorText.length > 950) {
        errorText = errorText.slice(0, 950) + "... view console for details";
    }

    const embed = new Discord.EmbedBuilder()
        .setTitle(`🚨・Unhandled promise rejection`)
        .addFields([
            {
                name: "Error",
                value: Discord.codeBlock(String(error).slice(0, 950)),
            },
            {
                name: "Stack error",
                value: Discord.codeBlock(errorText),
            },
        ]);

    consoleLogs
        .send({
            username: "Bot Logs",
            embeds: [embed],
        })
        .catch(() => {
            console.log("Error sending unhandled promise rejection to webhook");
        });
});

process.on("warning", (warn) => {
    console.warn("Warning:", warn);
    const warnText = String(warn).slice(0, 950);
    const embed = new Discord.EmbedBuilder()
        .setTitle(`🚨・New warning found`)
        .addFields([
            {
                name: `Warn`,
                value: `\`\`\`${warnText}\`\`\``,
            },
        ]);
    warnLogs
        .send({
            username: "Bot Logs",
            embeds: [embed],
        })
        .catch(() => {
            console.log("Error sending warning to webhook");
        });
});
