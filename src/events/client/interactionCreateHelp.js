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
  const commands = [...client.commands.values()]
    .filter((command) => command?.data?.name)
    .filter((command) => categoryForName(command.data.name) === category)
    .sort((a, b) => a.data.name.localeCompare(b.data.name));

  const lines = [];
  for (const command of commands) {
    const options = command.data.options || [];
    const subcommands = options.filter((option) => option.type === 1 || option.type === 2);
    if (subcommands.length) {
      for (const sub of subcommands) {
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
    } else {
      lines.push(`\`/${command.data.name}\` — ${command.data.description || "No description"}`);
    }
  }
  return lines;
}

function prefixCommandLines(client, category, prefix) {
  return [...(client.prefixCommands?.keys() || [])]
    .filter((name) => categoryForName(name) === category)
    .sort()
    .map((name) => `\`${prefix}${name}\``);
}

function buildEmbed(client, interaction, mode, category) {
  const prefix = client.config.discord.prefix || ".";
  const isPrefix = mode === "prefix";
  const lines = isPrefix
    ? prefixCommandLines(client, category, prefix)
    : slashCommandLines(client, category);

  const title = category.charAt(0).toUpperCase() + category.slice(1);
  const syntax = isPrefix ? `**Prefix:** ${prefix}` : "**Slash:** /";
  const chunks = [];

  // Discord embeds have a 1024-character field limit. Keep every loaded command
  // visible by splitting the category into multiple fields when necessary.
  let chunk = "";
  for (const line of lines) {
    const next = chunk ? `${chunk}\n${line}` : line;
    if (next.length > 1000) {
      if (chunk) chunks.push(chunk);
      chunk = line;
    } else {
      chunk = next;
    }
  }
  if (chunk) chunks.push(chunk);

  const fields = chunks.slice(0, 5).map((value, index) => ({
    name: chunks.length > 1 ? `${index === 0 ? "Commands" : `Commands ${index + 1}`}` : "Commands",
    value,
    inline: false,
  }));

  if (!fields.length) fields.push({ name: "Commands", value: "No commands are currently loaded in this category.", inline: false });
  if (chunks.length > 5) fields[4].value += `\n…and ${lines.length - chunks.slice(0, 5).join("\n").split("\n").length} more commands are loaded.`;

  return new Discord.EmbedBuilder()
    .setTitle(`❓・LightCore ${title}`)
    .setDescription(`${syntax}\n\n${isPrefix ? `Every command below is usable with **${prefix}**.` : "Every command below is a Discord slash command."}`)
    .addFields(fields)
    .setColor(client.config.colors.normal)
    .setFooter({ text: `LightCore • ${lines.length} command${lines.length === 1 ? "" : "s"}` });
}

function buildMenu(mode, owner) {
  const labels = {
    moderation: ["Moderation", "🛡️"],
    tickets: ["Tickets", "🎫"],
    setup: ["Setup", "⚙️"],
    fun: ["Fun & Games", "🎮"],
    music: ["Music", "🎵"],
    economy: ["Economy", "💰"],
    utility: ["Utility", "🔧"],
    automation: ["Automation", "🤖"],
    other: ["Other", "📦"],
  };

  return new Discord.ActionRowBuilder().addComponents(
    new Discord.StringSelectMenuBuilder()
      .setCustomId(`lc_help:${mode}:${owner}`)
      .setPlaceholder("Choose a LightCore help category")
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
  if (!interaction.customId.startsWith("lc_help:")) return;

  const [, mode, owner] = interaction.customId.split(":");
  if (!owner || interaction.user.id !== owner) {
    return interaction.reply({ content: "This help menu belongs to another user.", flags: Discord.MessageFlags.Ephemeral });
  }

  if (mode !== "prefix" && mode !== "slash") return;
  const category = interaction.values?.[0];
  if (!CATEGORY_ORDER.includes(category)) return;

  const embed = buildEmbed(client, interaction, mode, category);
  return interaction.update({ embeds: [embed], components: [buildMenu(mode, owner)] });
};
