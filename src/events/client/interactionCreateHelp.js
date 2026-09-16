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

const ADMIN_COMMANDS = new Set([
  "addmoney", "removemoney", "setmoney", "clear", "additem", "deleteitem", "config", "reward", "rewards",
  "createreward", "deletereward", "setxp", "setlevel", "xpboost", "levelmessage",
]);

function cleanName(name) {
  return String(name || "").toLowerCase().replace(/^[-_.]+/, "");
}

function categoryForName(name, parent = "") {
  const value = cleanName(name);
  const context = `${cleanName(parent)} ${value}`;

  if (
    ADMIN_COMMANDS.has(value) ||
    /^(levels?)\s+(config|reward|rewards|deletereward|setxp|setlevel|createreward)$/.test(context)
  ) return "admin";

  if (/level|xp|rank|leaderboard/.test(context)) return "leveling";
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
  const options = Array.isArray(data.options) ? data.options : [];

  if (!options.some((option) => option.type === 1 || option.type === 2)) {
    result.push({ name: root, description: data.description || "No description declared in the command file.", parent: "" });
    return result;
  }

  for (const sub of options.filter((option) => option.type === 1 || option.type === 2)) {
    if (sub.type === 2 && Array.isArray(sub.options)) {
      const nested = sub.options.filter((option) => option.type === 1);
      if (nested.length) {
        for (const child of nested) {
          result.push({ name: `${root} ${cleanName(sub.name)} ${cleanName(child.name)}`, description: child.description || "No description declared in the command file.", parent: root });
        }
      } else {
        result.push({ name: `${root} ${cleanName(sub.name)}`, description: sub.description || "No description declared in the command file.", parent: root });
      }
    } else {
      result.push({ name: `${root} ${cleanName(sub.name)}`, description: sub.description || "No description declared in the command file.", parent: root });
    }
  }

  return result;
}

function loadedCommands(client, mode) {
  const seen = new Set();
  const result = [];

  for (const command of client.commands?.values?.() || []) {
    if (mode === "slash" && command?.prefixOnly) continue;
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
  return loadedCommands(client, mode)
    .filter((entry) => categoryForName(entry.name, entry.parent) === category)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
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

  const fields = chunks.slice(0, 24).map((value, index) => ({ name: chunks.length > 1 ? `Commands ${index + 1}` : "Commands", value, inline: false }));
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
        description: mode === "prefix" ? `View ${LABELS[category][0].toLowerCase()} prefix commands` : `View ${LABELS[category][0].toLowerCase()} slash commands`,
        emoji: LABELS[category][1],
        value: category,
      })));
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
