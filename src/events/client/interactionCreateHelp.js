const Discord = require("discord.js");

const CATEGORY_ORDER = [
  "moderation",
  "tickets",
  "setup",
  "fun",
  "music",
  "economy",
  "utility",
  "automation",
  "other",
];

function categoryForName(name) {
  const value = String(name || "").toLowerCase();
  if (/ticket|transcript/.test(value)) return "tickets";
  if (/setup|config|prefix|autorole|welcome|reaction.?role|verify|captcha/.test(value)) return "setup";
  if (/ban|kick|mute|warn|timeout|unban|unmute|purge|clear|lock|unlock|slowmode|mod|moderation|antinuke|automod/.test(value)) return "moderation";
  if (/play|music|song|queue|skip|pause|resume|stop|volume|shuffle|loop|lyrics|radio|247|disconnect/.test(value)) return "music";
  if (/economy|balance|daily|work|crime|rob|deposit|withdraw|pay|shop|buy|sell|coin|cash|bank/.test(value)) return "economy";
  if (/game|games|trivia|tictactoe|hangman|rps|blackjack|slots|guess|word|8ball|meme|joke|fun|truth|dare|quiz/.test(value)) return "fun";
  if (/auto|logging|logs|reaction|custom|command|reminder|starboard|level|xp|giveaway|poll|suggestion/.test(value)) return "automation";
  if (/help|invite|avatar|userinfo|serverinfo|roleinfo|channelinfo|ping|uptime|botinfo|embed|say|translate|weather|fact|quote|afk/.test(value)) return "utility";
  return "other";
}

function slashCommandLines(client, category) {
  return [...client.commands.values()]
    .filter((command) => command?.data?.name)
    .filter((command) => categoryForName(command.data.name) === category)
    .sort((a, b) => a.data.name.localeCompare(b.data.name))
    .flatMap((command) => {
      const options = command.data.options || [];
      const subs = options.filter((option) => option.type === 1 || option.type === 2);
      if (!subs.length) return [`\`/${command.data.name}\` — ${command.data.description || "No description"}`];
      const lines = [];
      for (const sub of subs) {
        if (sub.type === 2 && Array.isArray(sub.options)) {
          const nested = sub.options.filter((option) => option.type === 1);
          if (nested.length) {
            for (const child of nested) lines.push(`\`/${command.data.name} ${sub.name} ${child.name}\` — ${child.description || "No description"}`);
          } else {
            lines.push(`\`/${command.data.name} ${sub.name}\` — ${sub.description || "No description"}`);
          }
        } else {
          lines.push(`\`/${command.data.name} ${sub.name}\` — ${sub.description || "No description"}`);
        }
      }
      return lines;
    });
}

function prefixCommandLines(client, category, prefix) {
  return [...(client.prefixCommands?.keys() || [])]
    .filter((name) => categoryForName(name) === category)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `\`${prefix}${name}\``);
}

function buildEmbed(client, mode, category) {
  const prefix = client.config.discord.prefix || ".";
  const isPrefix = mode === "prefix";
  const lines = isPrefix ? prefixCommandLines(client, category, prefix) : slashCommandLines(client, category);
  const title = category === "fun" ? "Fun & Games" : category.charAt(0).toUpperCase() + category.slice(1);
  const syntax = isPrefix ? `**Prefix:** ${prefix}` : "**Slash:** /";
  const description = isPrefix
    ? `Every command below is a **prefix command**. Use **${prefix}** before the command.`
    : "Every command below is a **slash command**. Use **/** before the command.";

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

  const fields = chunks.slice(0, 10).map((value, index) => ({
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
  const labels = {
    moderation: ["Moderation", "🛡️"], tickets: ["Tickets", "🎫"], setup: ["Setup", "⚙️"],
    fun: ["Fun & Games", "🎮"], music: ["Music", "🎵"], economy: ["Economy", "💰"],
    utility: ["Utility", "🔧"], automation: ["Automation", "🤖"], other: ["Other", "📦"],
  };
  return new Discord.ActionRowBuilder().addComponents(
    new Discord.StringSelectMenuBuilder()
      .setCustomId(mode === "prefix" ? `lc_phelp:${owner}` : `lc_help:${mode}:${owner}`)
      .setPlaceholder(mode === "prefix" ? "Choose a prefix help category" : "Choose a LightCore help category")
      .addOptions(CATEGORY_ORDER.map((category) => ({
        label: labels[category][0],
        description: mode === "prefix" ? `View ${labels[category][0].toLowerCase()} prefix commands` : `View ${labels[category][0].toLowerCase()} slash commands`,
        emoji: labels[category][1],
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
