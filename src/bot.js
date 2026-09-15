const Discord = require("discord.js");
const fs = require("fs");

const { Connectors } = require("shoukaku");
const { Kazagumo } = require("kazagumo");
const Spotify = require('kazagumo-spotify');

const client = new Discord.Client({
    allowedMentions: {
        parse: ["users", "roles"],
        repliedUser: true,
    },
    autoReconnect: true,
    disabledEvents: ["TYPING_START"],
    partials: [
        Discord.Partials.Channel,
        Discord.Partials.GuildMember,
        Discord.Partials.Message,
        Discord.Partials.Reaction,
        Discord.Partials.User,
        Discord.Partials.GuildScheduledEvent,
    ],
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.GuildBans,
        Discord.GatewayIntentBits.GuildEmojisAndStickers,
        Discord.GatewayIntentBits.GuildIntegrations,
        Discord.GatewayIntentBits.GuildWebhooks,
        Discord.GatewayIntentBits.GuildInvites,
        Discord.GatewayIntentBits.GuildVoiceStates,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.GuildMessageReactions,
        Discord.GatewayIntentBits.GuildMessageTyping,
        Discord.GatewayIntentBits.DirectMessages,
        Discord.GatewayIntentBits.DirectMessageReactions,
        Discord.GatewayIntentBits.DirectMessageTyping,
        Discord.GatewayIntentBits.GuildScheduledEvents,
        Discord.GatewayIntentBits.MessageContent,
    ],
    restTimeOffset: 0,
});

client.player = new Kazagumo(
    {
        defaultSearchEngine: "youtube",
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        },
        plugins: process.env.SPOTIFY_CLIENT_ID ? [new Spotify({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET
        })] : []
    },
    new Connectors.DiscordJS(client),
    [
        {
            name: "Lavalink 1",
            url: (process.env.LAVALINK_HOST ?? "lavalinkv4.serenetia.com") + ":" + (process.env.LAVALINK_PORT ?? 80),
            auth: process.env.LAVALINK_PASSWORD ?? "https://seretia.link/discord",
            secure: process.env.LAVALINK_SECURE === "true" ? true : false,
        },
    ],
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
client.config.discord.prefix = ".";
client.changelogs = require("./config/changelogs");
client.emotes = require("./config/emojis.json");
client.webhooks = require("./config/webhooks.json");

const webHooksArray = ["startLogs", "shardLogs", "errorLogs", "dmLogs", "voiceLogs", "serverLogs", "serverLogs2", "commandLogs", "consoleLogs", "warnLogs", "voiceErrorLogs", "creditLogs", "evalLogs", "interactionLogs"];
if (process.env.WEBHOOK_ID && process.env.WEBHOOK_TOKEN) {
    for (const webhookName of webHooksArray) {
        client.webhooks[webhookName].id = process.env.WEBHOOK_ID;
        client.webhooks[webhookName].token = process.env.WEBHOOK_TOKEN;
    }
}

client.commands = new Discord.Collection();
client.playerManager = new Map();
client.queue = new Map();

const consoleLogs = new Discord.WebhookClient({ id: client.webhooks.consoleLogs.id, token: client.webhooks.consoleLogs.token });
const warnLogs = new Discord.WebhookClient({ id: client.webhooks.warnLogs.id, token: client.webhooks.warnLogs.token });

fs.readdirSync("./src/handlers").forEach((dir) => {
    fs.readdirSync(`./src/handlers/${dir}`).forEach((handler) => require(`./handlers/${dir}/${handler}`)(client));
});

client.login(process.env.DISCORD_TOKEN);

process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);
    if (!error) return;
    let errorText = error.stack || String(error);
    if (errorText.length > 950) errorText = errorText.slice(0, 950) + "... view console for details";
    const embed = new Discord.EmbedBuilder()
        .setTitle(`🚨・Unhandled promise rejection`)
        .addFields([
            { name: "Error", value: Discord.codeBlock(String(error).slice(0, 950)) },
            { name: "Stack error", value: Discord.codeBlock(errorText) },
        ])
        .setColor(client.config.colors.normal);
    consoleLogs.send({ username: "Bot Logs", embeds: [embed] }).catch(() => {});
});

process.on("warning", (warn) => {
    console.warn("Warning:", warn);
    const embed = new Discord.EmbedBuilder()
        .setTitle(`🚨・New warning found`)
        .addFields([{ name: `Warn`, value: `\`\`\`${String(warn).slice(0, 950)}\`\`\`` }])
        .setColor(client.config.colors.normal);
    warnLogs.send({ username: "Bot Logs", embeds: [embed] }).catch(() => {});
});

client.on(Discord.ShardEvents.Error, (error) => {
    console.log(error);
    if (!error?.stack) return;
    const embed = new Discord.EmbedBuilder()
        .setTitle(`🚨・A websocket connection encountered an error`)
        .addFields([
            { name: `Error`, value: `\`\`\`${String(error).slice(0, 950)}\`\`\`` },
            { name: `Stack error`, value: `\`\`\`${String(error.stack).slice(0, 950)}\`\`\`` },
        ])
        .setColor(client.config.colors.normal);
    consoleLogs.send({ username: "Bot Logs", embeds: [embed] }).catch(() => {});
});