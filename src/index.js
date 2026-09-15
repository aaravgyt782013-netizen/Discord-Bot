const Discord = require("discord.js");
const { Chalk } = require("chalk");
const chalk = new Chalk();
const http = require("http");

require("dotenv").config();
const Topgg = require("@top-gg/sdk");
const { version } = require("../package.json");

const PORT = Number(process.env.PORT) || 3000;
const healthServer = http.createServer((req, res) => {
    const url = (req.url || "/").split("?")[0];
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method !== "GET") {
        res.writeHead(405, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Method Not Allowed" }));
    }
    if (url === "/" || url === "/health" || url === "/healthz") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, service: "LightCore", status: "online", version, uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() }));
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "Not Found" }));
});
healthServer.on("error", (error) => console.error("Health server error:", error));
healthServer.listen(PORT, "0.0.0.0", () => console.log(chalk.blue(chalk.bold("Web")), chalk.white(">>"), chalk.green(`LightCore health server listening on port ${PORT}`)));

const webhook = require("./config/webhooks.json");
const config = require("./config/bot.js");
const webHooksArray = ["startLogs", "shardLogs", "errorLogs", "dmLogs", "voiceLogs", "serverLogs", "serverLogs2", "commandLogs", "consoleLogs", "warnLogs", "voiceErrorLogs", "creditLogs", "evalLogs", "interactionLogs"];
if (process.env.WEBHOOK_ID && process.env.WEBHOOK_TOKEN) {
    for (const webhookName of webHooksArray) {
        webhook[webhookName] = webhook[webhookName] || {};
        webhook[webhookName].id = process.env.WEBHOOK_ID;
        webhook[webhookName].token = process.env.WEBHOOK_TOKEN;
    }
}
const makeWebhook = (name) => {
    const entry = webhook[name] || {};
    if (!entry.id || !entry.token) return null;
    try { return new Discord.WebhookClient({ id: entry.id, token: entry.token }); }
    catch (error) { console.warn(`Invalid ${name} webhook configuration:`, error.message); return null; }
};
const startLogs = makeWebhook("startLogs");
const shardLogs = makeWebhook("shardLogs");
const consoleLogs = makeWebhook("consoleLogs");
const warnLogs = makeWebhook("warnLogs");
const safeWebhookSend = (hook, payload) => hook?.send(payload).catch(() => {});

const required = ["DISCORD_TOKEN", "DISCORD_ID", "MONGO_TOKEN"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
    console.error(`LightCore cannot start: missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
}

const manager = new Discord.ShardingManager("./src/bot.js", {
    totalShards: "auto",
    token: process.env.DISCORD_TOKEN,
    respawn: true,
    execArgv: ["--trace-warnings"],
});

if (process.env.TOPGG_TOKEN) {
    const topgg = new Topgg.Api(process.env.TOPGG_TOKEN);
    const postMetrics = async () => {
        try {
            const counts = await manager.broadcastEval((client) => client.guilds.cache.size);
            await topgg.postMetrics({ serverCount: counts.reduce((a, b) => a + b, 0) || 0, shardCount: manager.totalShards || 0 });
        } catch (error) { console.error("Top.gg metrics error:", error); }
    };
    setInterval(postMetrics, 30 * 60 * 1000).unref?.();
    setTimeout(async () => {
        try {
            const commands = await manager.broadcastEval(async (client) => (await client.application.commands.fetch()).map((command) => command.toJSON()), { shard: 0 });
            await topgg.postCommands(commands);
            await postMetrics();
        } catch (error) { console.error("Top.gg startup sync error:", error); }
    }, 15000).unref?.();
}

console.clear();
console.log(chalk.blue(chalk.bold("LightCore")), chalk.white(">>"), chalk.green("Starting up..."));
console.log(chalk.cyan(`Version ${version}`));
console.log(chalk.gray(`Support: ${config.discord.serverInvite}`));

manager.on("shardCreate", (shard) => {
    const shardLabel = `${shard.id + 1}/${manager.totalShards || "?"}`;
    safeWebhookSend(startLogs, { username: "LightCore Logs", embeds: [new Discord.EmbedBuilder().setTitle("🆙・Launching shard").setDescription(`Shard **${shardLabel}** is starting.`).setColor(config.colors.normal).setTimestamp()] });
    console.log(chalk.blue("LightCore"), chalk.white(">>"), chalk.green(`Starting shard #${shard.id + 1}...`));
    shard.on("death", (process) => safeWebhookSend(shardLogs, { username: "LightCore Logs", embeds: [new Discord.EmbedBuilder().setTitle("🚨・Shard exited").setDescription(`Shard **${shardLabel}** exited unexpectedly.`).addFields({ name: "PID", value: `\`${process.pid}\``, inline: true }, { name: "Exit code", value: `\`${process.exitCode ?? "unknown"}\``, inline: true }).setColor(config.colors.error).setTimestamp()] }));
    shard.on("shardDisconnect", (event) => safeWebhookSend(shardLogs, { username: "LightCore Logs", embeds: [new Discord.EmbedBuilder().setTitle("🚨・Shard disconnected").setDescription(`Shard **${shardLabel}** disconnected.`).addFields({ name: "Close event", value: `\`${String(event?.code ?? "unknown")}\`` }).setColor(config.colors.error).setTimestamp()] }));
    shard.on("shardReconnecting", () => safeWebhookSend(shardLogs, { username: "LightCore Logs", embeds: [new Discord.EmbedBuilder().setTitle("🔄・Shard reconnecting").setDescription(`Shard **${shardLabel}** is reconnecting.`).setColor(config.colors.normal).setTimestamp()] }));
});

manager.spawn().catch((error) => {
    console.error("Failed to spawn Discord shards:", error);
    safeWebhookSend(consoleLogs, { username: "LightCore Logs", embeds: [new Discord.EmbedBuilder().setTitle("🚨・Shard manager failed").setDescription(`\`\`\`${String(error).slice(0, 3800)}\`\`\``).setColor(config.colors.error)] });
});

process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);
    safeWebhookSend(consoleLogs, { username: "LightCore Logs", embeds: [new Discord.EmbedBuilder().setTitle("🚨・Unhandled promise rejection").setDescription(`\`\`\`${String(error?.stack || error).slice(0, 1900)}\`\`\``).setColor(config.colors.error).setTimestamp()] });
});
process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    safeWebhookSend(consoleLogs, { username: "LightCore Logs", embeds: [new Discord.EmbedBuilder().setTitle("🚨・Uncaught exception").setDescription(`\`\`\`${String(error?.stack || error).slice(0, 1900)}\`\`\``).setColor(config.colors.error).setTimestamp()] });
});
process.on("warning", (warn) => {
    console.warn("Warning:", warn);
    safeWebhookSend(warnLogs, { username: "LightCore Logs", embeds: [new Discord.EmbedBuilder().setTitle("⚠️・Node.js warning").setDescription(`\`\`\`${String(warn).slice(0, 3800)}\`\`\``).setColor(config.colors.warning || config.colors.normal).setTimestamp()] });
});
