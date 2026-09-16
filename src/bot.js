const Discord = require("discord.js");
const fs = require("fs");

const { Connectors } = require("shoukaku");
const { Kazagumo } = require("kazagumo");
const Spotify = require("kazagumo-spotify");

const client = new Discord.Client({
    allowedMentions: { parse: ["users", "roles"], repliedUser: true },
    autoReconnect: true,
    disabledEvents: ["TYPING_START"],
    partials: [Discord.Partials.Channel, Discord.Partials.GuildMember, Discord.Partials.Message, Discord.Partials.Reaction, Discord.Partials.User, Discord.Partials.GuildScheduledEvent],
    intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMembers, Discord.GatewayIntentBits.GuildBans, Discord.GatewayIntentBits.GuildEmojisAndStickers, Discord.GatewayIntentBits.GuildIntegrations, Discord.GatewayIntentBits.GuildWebhooks, Discord.GatewayIntentBits.GuildInvites, Discord.GatewayIntentBits.GuildVoiceStates, Discord.GatewayIntentBits.GuildMessages, Discord.GatewayIntentBits.GuildMessageReactions, Discord.GatewayIntentBits.GuildMessageTyping, Discord.GatewayIntentBits.DirectMessages, Discord.GatewayIntentBits.DirectMessageReactions, Discord.GatewayIntentBits.DirectMessageTyping, Discord.GatewayIntentBits.GuildScheduledEvents, Discord.GatewayIntentBits.MessageContent],
    restTimeOffset: 0,
});

client.player = new Kazagumo(
    {
        defaultSearchEngine: "youtube",
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        },
        plugins: process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
            ? [new Spotify({ clientId: process.env.SPOTIFY_CLIENT_ID, clientSecret: process.env.SPOTIFY_CLIENT_SECRET })]
            : [],
    },
    new Connectors.DiscordJS(client),
    [{
        name: "Lavalink 1",
        url: `${process.env.LAVALINK_HOST ?? "lavalinkv4.serenetia.com"}:${process.env.LAVALINK_PORT ?? 80}`,
        auth: process.env.LAVALINK_PASSWORD ?? "https://seretia.link/discord",
        secure: process.env.LAVALINK_SECURE === "true",
    }],
    { resume: true, resumeTimeout: 30, reconnectTries: 5 },
);

const musicEvents = {
    playerStart: require("./music/trackStart"),
    playerEmpty: require("./music/queueEnd"),
    playerMoved: require("./music/playerMove"),
    playerClosed: require("./music/playerDisconnect"),
};
for (const [name, event] of Object.entries(musicEvents)) client.player.on(name, event.bind(null, client));
client.player.shoukaku.on("ready", require("./music/ready").bind(null, client));
client.player.shoukaku.on("error", require("./music/error").bind(null, client));

require("./database/connect")();

client.config = require("./config/bot");
client.changelogs = require("./config/changelogs");
client.emotes = require("./config/emojis.json");
client.webhooks = require("./config/webhooks.json");

const webHooksArray = ["startLogs", "shardLogs", "errorLogs", "dmLogs", "voiceLogs", "serverLogs", "serverLogs2", "commandLogs", "consoleLogs", "warnLogs", "voiceErrorLogs", "creditLogs", "evalLogs", "interactionLogs"];
if (process.env.WEBHOOK_ID && process.env.WEBHOOK_TOKEN) {
    for (const webhookName of webHooksArray) {
        if (!client.webhooks[webhookName]) client.webhooks[webhookName] = {};
        client.webhooks[webhookName].id = process.env.WEBHOOK_ID;
        client.webhooks[webhookName].token = process.env.WEBHOOK_TOKEN;
    }
}

client.commands = new Discord.Collection();
client.prefixCommands = new Discord.Collection();
client.playerManager = new Map();
client.queue = new Map();
client.runtime = { startedAt: Date.now(), version: "12.1.0" };

const makeWebhook = (name) => {
    const entry = client.webhooks[name];
    if (!entry?.id || !entry?.token) return null;
    try { return new Discord.WebhookClient({ id: entry.id, token: entry.token }); }
    catch (error) { console.warn(`LightCore: disabled invalid ${name} webhook:`, error.message); return null; }
};
const consoleLogs = makeWebhook("consoleLogs");
const warnLogs = makeWebhook("warnLogs");
const safeLog = (hook, payload) => hook?.send(payload).catch(() => {});
const errorDescription = (error) => String(error?.stack || error).slice(0, 1900);

const requiredEnvironment = ["DISCORD_TOKEN", "MONGO_TOKEN", "DISCORD_ID"];
const missingEnvironment = requiredEnvironment.filter((key) => !process.env[key]);
if (missingEnvironment.length) {
    console.error(`LightCore cannot start: missing required environment variables: ${missingEnvironment.join(", ")}`);
    process.exitCode = 1;
}

fs.readdirSync("./src/handlers").forEach((dir) => {
    const handlerPath = `./handlers/${dir}`;
    const fullPath = `./src/handlers/${dir}`;
    if (!fs.statSync(fullPath).isDirectory()) return;
    fs.readdirSync(fullPath).filter((handler) => handler.endsWith(".js")).forEach((handler) => {
        const source = `${handlerPath}/${handler}`;
        try {
            const initializer = require(source);
            if (typeof initializer !== "function") {
                throw new TypeError(`Handler must export a function, got ${typeof initializer}`);
            }
            initializer(client);
        } catch (error) {
            console.error(`LightCore failed to initialize handler ${source}:`, error);
            process.exitCode = 1;
        }
    });
});

client.once(Discord.Events.ClientReady, (readyClient) => {
    console.log(`LightCore is online as ${readyClient.user.tag} in ${readyClient.guilds.cache.size} server(s).`);
    console.log(`Default prefix: ${client.config.discord.prefix}`);
    console.log(`Application ID: ${readyClient.user.id}`);
});

if (!missingEnvironment.length) {
    client.login(process.env.DISCORD_TOKEN).catch((error) => {
        console.error("LightCore failed to login to Discord:", error);
        safeLog(consoleLogs, {
            username: "LightCore Logs",
            embeds: [new Discord.EmbedBuilder().setTitle("🚨・Discord login failed").setDescription(errorDescription(error)).setColor(client.config.colors.error).setTimestamp()],
        });
        process.exitCode = 1;
    });
}

process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);
    safeLog(consoleLogs, {
        username: "LightCore Logs",
        embeds: [new Discord.EmbedBuilder().setTitle("🚨・Unhandled promise rejection").setDescription(errorDescription(error)).setColor(client.config.colors.error).setTimestamp()],
    });
});

process.on("uncaughtException", async (error) => {
    console.error("Uncaught exception:", error);
    await Promise.resolve(safeLog(consoleLogs, {
        username: "LightCore Logs",
        embeds: [new Discord.EmbedBuilder().setTitle("💥・Uncaught exception").setDescription(errorDescription(error)).setColor(client.config.colors.error).setTimestamp()],
    }));
    await shutdown("uncaughtException");
});

process.on("warning", (warn) => {
    console.warn("Warning:", warn);
    safeLog(warnLogs, {
        username: "LightCore Logs",
        embeds: [new Discord.EmbedBuilder().setTitle("⚠️・Node.js warning").setDescription(String(warn).slice(0, 1900)).setColor(client.config.colors.warning || client.config.colors.normal).setTimestamp()],
    });
});

client.on(Discord.ShardEvents.Error, (error) => {
    console.error("Discord shard error:", error);
    safeLog(consoleLogs, {
        username: "LightCore Logs",
        embeds: [new Discord.EmbedBuilder().setTitle("🌐・Discord websocket error").setDescription(errorDescription(error)).setColor(client.config.colors.error).setTimestamp()],
    });
});

const shutdown = async (signal) => {
    console.log(`LightCore received ${signal}; shutting down gracefully.`);
    try { client.destroy(); } finally { process.exit(0); }
};
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

module.exports = client;