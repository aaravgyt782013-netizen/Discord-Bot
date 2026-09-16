const Discord = require("discord.js");

const CATEGORY_ORDER = [
  "economy",
  "leveling",
  "music",
  "moderation",
  "tickets",
  "fun",
  "utility",
  "automation",
  "admin",
  "other",
];

const LABELS = {
  economy: ["Economy", "💰"],
  leveling: ["Leveling", "🆙"],
  music: ["Music", "🎵"],
  moderation: ["Moderation", "🛡️"],
  tickets: ["Tickets", "🎫"],
  fun: ["Fun & Games", "🎮"],
  utility: ["Utility", "🔧"],
  automation: ["Automation", "🤖"],
  admin: ["Admin", "🛠️"],
  other: ["Other", "📦"],
};

// Gambling/casino commands are intentionally not rendered in the help menu.
const RESTRICTED_GAMBLING = new Set(["slots", "coinflip", "blackjack", "crash", "roulette"]);

const ADMIN_COMMANDS = new Set([
  "addmoney", "removemoney", "clear", "additem", "deleteitem", "config", "reward", "rewards",
  "createreward", "deletereward", "setxp", "setlevel",
]);

function cleanName(name) {
  return String(name || "").toLowerCase().replace(/^[-_.]+/, "");
}

function isRestricted(name) {
  const value = cleanName(name);
  return RESTRICTED_GAMBLING.has(value) || value === "casino";
}

function categoryForName(name, parent = "") {
  const value = cleanName(name);
  const context = `${cleanName(parent)} ${value}`;

  if (isRestricted(value) || isRestricted(parent)) return null;
  if (ADMIN_COMMANDS.has(value) || /^(levels?)\s+(config|reward|rewards|deletereward|setxp|setlevel|createreward)$/.test(context)) return "admin";
  if (/^leaderboard$/.test(value) && !parent) return "economy";
  if (/level|xp|rank|leaderboard|reward/.test(context)) return "leveling";
  if (/economy|balance|daily|hourly|weekly|monthly|yearly|work|beg|deposit|withdraw|pay|shop|buy|hunt|battle|fish|pet|quest|boss|present|profile|rob|crime/.test(context)) return "economy";
  if (/play|music|song|queue|skip|pause|resume|stop|volume|shuffle|loop|lyrics|radio|bassboost|playing|seek|previous/.test(context)) return "music";
  if (/ticket|transcript/.test(context)) return "tickets";
  if (/ban|kick|warn|timeout|unban|clearuser|lockdown|lock|unlock|softban|nuke|demote|automod|moderation/.test(context)) return "moderation";
  if (/game|games|trivia|rps|guess|word|8ball|fasttype|snake|wouldyou|press|fun|meme|joke|fact|rate|roast|hug|rickroll|ascii/.test(context)) return "fun";
  if (/auto|logging|logs|reaction|custom|reminder|starboard|giveaway|suggestion|message|sticky|announcement/.test(context)) return "automation";
  if (/help|invite|avatar|userinfo|serverinfo|roleinfo|channelinfo|ping|uptime|botinfo|embed|say|translate|weather|afk|birthdays|notepad|images|search|tools|voice|prefix|dcredits/.test(context)) return "utility";
  return "other";
}

function normalizeCommandData(command) {
  const data = typeof command?.data?.toJSON === "function" ? command.data.toJSON() : command?.data;
  return data?.name ? data : null;
}

function flattenSlashCommand(data) {
  const result = [];
  const root = cleanName(data.name);
  if (isRestricted(root)) return result;

  const options = Array.isArray(data.options) ? data.options : [];
  const subcommands = options.filter((option) => option.type === 1 || option.type === 2);

  if (!subcommands.length) {
    result.push({ name: root, description: data.description || "No description declared in the command file.", parent: "" });
    return result;
  }

  for (const sub of subcommands) {
    if (sub.type === 2 && Array.isArray(sub.options)) {
      const nested = sub.options.filter((option) => option.type === 1);
      if (nested.length) {
        for (const child of nested) {
          if (!isRestricted(child.name)) {
            result.push({
              name: `${root} ${cleanName(sub.name)} ${cleanName(child.name)}`,
              description: child.description || "No description declared in the command file.",
              parent: root,
            });
          }
        }
      } else if (!isRestricted(sub.name)) {
        result.push({ name: `${root} ${cleanName(sub.name)}`, description: sub.description || "No description declared in the command file.", parent: root });
      }
    } else if (!isRestricted(sub.name)) {
      result.push({ name: `${root} ${cleanName(sub.name)}`, description: sub.description || "No description declared in the command file.", parent: root });
    }
  }

  return result;
}

function loadedCommands(client) {
  const seen = new Set();
  const result = [];

  for (const command of client.commands?.values?.() || []) {
    const data = normalizeCommandData(command);
    if (!data) continue;
    for (const entry of flattenSlashCommand(data)) {
      if (seen.has(entry.name)) continue;
      seen.add(entry.name);
      result.push(entry);
    }
  }
  return result;
}

function buildCommandLines(client, category, mode, prefix) {
  const entries = loadedCommands(client)
    .filter((entry) => categoryForName(entry.name, entry.parent) === category)
    .sort((a, b) => a.name.localeCompare(b.name));

  return entries.map((entry) => {
    const trigger = mode === "prefix" ? `${prefix}${entry.name}` : `/${entry.name}`;
    return `\`${trigger}\` — ${entry.description}`;
  });
}

function buildEmbed(client, mode, category) {
  const prefix = client.config.discord.prefix || ".";
  const lines = buildCommandLines(client, category, mode, prefix);
  const title = LABELS[category][0];
  const syntax = mode === "prefix" ? `**Prefix:** ${prefix}` : "**Slash:** /";
  const description = mode === "prefix"
    ? "Every command below is currently loaded for prefix use."
    : "Every command below is currently registered for slash use.";

  const chunks = [];
  let chunk = "";
  for (const line of lines) {
    const next = chunk ? `${chunk}\n${line}` : line;
    if (next.length > 1000) {
      if (chunk) chunks.push(chunk);
      chunk = line;
    } else chunk = next;
  }
  if (chunk) chunks.push(chunk);

  const fields = chunks.slice(0, 24).map((value, index) => ({
    name: chunks.length > 1 ? `Commands ${index + 1}` : "Commands",
    value,
    inline: false,
  }));
  if (!fields.length) fields.push({ name: "Commands", value: "No commands are currently loaded in this category.", inline: false });

  return new Discord.EmbedBuilder()
    .setTitle(`❓・LightCore ${title}`)
    .setDescription(`${syntax}\n\n${description}`)
    .addFields(fields)
    .setColor(client.config.colors.normal)
    .setFooter({ text: `LightCore • ${lines.length} command${lines.length === 1 ? "" : "s"}` });
}

function buildMenu(mode, owner) {
  return new Discord.ActionRowBuilder().addComponents(
    new Discord.StringSelectMenuBuilder()
      .setCustomId(mode === "prefix" ? `lc_phelp:${owner}` : `lc_help:${mode}:${owner}`)
      .setPlaceholder(mode === "prefix" ? "Choose a prefix help category" : "Choose a LightCore help category")
      .addOptions(CATEGORY_ORDER.map((category) => ({
        label: LABELS[category][0],
        description: mode === "prefix"
          ? `View ${LABELS[category][0].toLowerCase()} prefix commands`
          : `View ${LABELS[category][0].toLowerCase()} slash commands`,
        emoji: LABELS[category][1],
        value: category,
      }))),
  );
}

module.exports = async (client, interaction) => {
  if (!interaction.isStringSelectMenu?.()) return;
  if (!interaction.customId.startsWith("lc_phelp:") && !interaction.customId.startsWith("lc_help:")) return;

  const parts = interaction.customId.split(":");
  const mode = parts[0] === "lc_phelp" ? "prefix" : parts[1];
  const owner = parts[0] === "lc_phelp" ? parts[1] : parts[2];
  if (!owner || interaction.user.id !== owner) {
    return interaction.reply({ content: "This help menu belongs to another user.", flags: Discord.MessageFlags.Ephemeral });
  }
  if (mode !== "prefix" && mode !== "slash") return;

  const category = interaction.values?.[0];
  if (!CATEGORY_ORDER.includes(category)) return;

  return interaction.update({
    embeds: [buildEmbed(client, mode, category)],
    components: [buildMenu(mode, owner)],
  });
};
