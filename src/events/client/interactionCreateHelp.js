const Discord = require("discord.js");

const CATEGORY_ORDER = ["economy", "leveling", "music", "moderation", "tickets", "fun", "utility", "automation", "admin", "other"];
const LABELS = {
  economy: ["Economy", "💰"], leveling: ["Leveling", "🆙"], music: ["Music", "🎵"], moderation: ["Moderation", "🛡️"], tickets: ["Tickets", "🎫"],
  fun: ["Fun & Games", "🎮"], utility: ["Utility", "🔧"], automation: ["Automation", "🤖"], admin: ["Admin", "🛠️"], other: ["Other", "📦"],
};

const ADMIN_COMMANDS = new Set(["addmoney", "removemoney", "setmoney", "ecoclear", "additem", "deleteitem", "config", "reward", "rewards", "createreward", "deletereward", "setxp", "setlevel", "xpboost", "levelmessage"]);

const COMMAND_CATEGORIES = new Map([
  ["activities", "fun"], ["afk", "utility"], ["announcement", "automation"], ["automod", "moderation"],
  ["autosetup", "automation"], ["birthdays", "utility"], ["boss", "fun"], ["bot", "utility"], ["casino", "fun"],
  ["commands", "utility"], ["config", "admin"], ["developers", "admin"], ["embed", "utility"], ["family", "fun"],
  ["fun", "fun"], ["games", "fun"], ["giveaway", "automation"], ["guild", "utility"], ["help", "utility"],
  ["honeypot", "moderation"], ["images", "utility"], ["invite", "utility"], ["invites", "utility"], ["leaderboard", "leveling"],
  ["level", "leveling"], ["levelmessage", "admin"], ["levels", "leveling"], ["message", "automation"], ["messages", "automation"],
  ["moderation", "moderation"], ["modlogs", "moderation"], ["notepad", "utility"], ["notifier", "automation"], ["owner", "admin"],
  ["pet", "fun"], ["prefix", "admin"], ["profile", "utility"], ["quest", "fun"], ["radio", "music"], ["rank", "leveling"],
  ["reactionroles", "automation"], ["report", "moderation"], ["search", "utility"], ["serverstats", "utility"], ["setup", "admin"],
  ["soundboard", "music"], ["stickymessages", "automation"], ["suggestions", "automation"], ["thanks", "utility"], ["tickets", "tickets"],
  ["tools", "utility"], ["verify", "moderation"], ["voice", "utility"], ["xpboost", "admin"],
]);

function cleanName(name) { return String(name || "").toLowerCase().replace(/^[-_.]+/, ""); }

function categoryForName(name, parent = "") {
  const value = cleanName(name);
  const root = cleanName(parent) || value.split(" ")[0];
  if (ADMIN_COMMANDS.has(value)) return "admin";
  if (COMMAND_CATEGORIES.has(root)) return COMMAND_CATEGORIES.get(root);
  if (/^(levels?)\s+/.test(value)) return "leveling";
  return "other";
}

function normalizeCommandData(command) {
  const data = typeof command?.data?.toJSON === "function" ? command.data.toJSON() : command?.data;
  return data?.name ? data : null;
}

function flattenSlashCommand(data) {
  const result = [], root = cleanName(data.name), options = Array.isArray(data.options) ? data.options : [];
  if (!options.some(o => o.type === 1 || o.type === 2)) {
    result.push({ name: root, description: data.description || "No description declared in the command file.", parent: "" });
    return result;
  }
  for (const sub of options.filter(o => o.type === 1 || o.type === 2)) {
    if (sub.type === 2 && Array.isArray(sub.options)) {
      const nested = sub.options.filter(o => o.type === 1);
      if (nested.length) for (const child of nested) result.push({ name: `${root} ${cleanName(sub.name)} ${cleanName(child.name)}`, description: child.description || "No description declared in the command file.", parent: root });
      else result.push({ name: `${root} ${cleanName(sub.name)}`, description: sub.description || "No description declared in the command file.", parent: root });
    } else result.push({ name: `${root} ${cleanName(sub.name)}`, description: sub.description || "No description declared in the command file.", parent: root });
  }
  return result;
}

function loadedCommands(client) {
  const seen = new Set(), result = [];
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
  return loadedCommands(client)
    .filter(e => categoryForName(e.name, e.parent) === category)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(e => {
      const trigger = mode === "prefix" ? `${prefix}${e.name}` : `/${e.name}`;
      return `\`${trigger}\` — ${e.description}`;
    });
}

function buildEmbed(client, mode, category) {
  const prefix = client.config.discord.prefix || ".";
  const lines = buildCommandLines(client, category, mode, prefix);
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
    .setTitle(`❓・LightCore ${LABELS[category][0]}`)
    .setDescription(`${mode === "prefix" ? `**Prefix:** ${prefix}` : "**Slash:** /"}\n\n${mode === "prefix" ? "Every command below is currently available through prefix handling." : "Every command below is currently registered for slash use."}`)
    .addFields(fields)
    .setColor(client.config.colors.normal)
    .setFooter({ text: `LightCore • ${lines.length} command${lines.length === 1 ? "" : "s"}` });
}

function buildMenu(mode, owner) {
  return new Discord.ActionRowBuilder().addComponents(
    new Discord.StringSelectMenuBuilder()
      .setCustomId(mode === "prefix" ? `lc_phelp:${owner}` : `lc_help:${mode}:${owner}`)
      .setPlaceholder(mode === "prefix" ? "Choose a prefix help category" : "Choose a LightCore help category")
      .addOptions(CATEGORY_ORDER.map(c => ({ label: LABELS[c][0], description: `View ${LABELS[c][0].toLowerCase()} ${mode} commands`, emoji: LABELS[c][1], value: c })))
  );
}

module.exports = async (client, interaction) => {
  if (!interaction.isStringSelectMenu?.()) return;
  if (!interaction.customId.startsWith("lc_phelp:") && !interaction.customId.startsWith("lc_help:")) return;
  const p = interaction.customId.split(":"), mode = p[0] === "lc_phelp" ? "prefix" : p[1], owner = p[0] === "lc_phelp" ? p[1] : p[2];
  if (!owner || interaction.user.id !== owner) return interaction.reply({ content: "This help menu belongs to another user.", flags: Discord.MessageFlags.Ephemeral });
  const category = interaction.values?.[0];
  if (!CATEGORY_ORDER.includes(category)) return;
  return interaction.update({ embeds: [buildEmbed(client, mode, category)], components: [buildMenu(mode, owner)] });
};
