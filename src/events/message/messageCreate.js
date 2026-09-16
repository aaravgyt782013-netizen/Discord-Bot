const Discord = require("discord.js");

const Functions = require("../../database/models/functions");
const afk = require("../../database/models/afk");
const chatBotSchema = require("../../database/models/chatbot-channel");
const messagesSchema = require("../../database/models/messages");
const messageSchema = require("../../database/models/levelMessages");
const messageRewards = require("../../database/models/messageRewards");
const Schema = require("../../database/models/stickymessages");
const levelRewards = require("../../database/models/levelRewards");
const levelLogs = require("../../database/models/levelChannels");
const Commands = require("../../database/models/customCommand");
const CommandsSchema = require("../../database/models/customCommandAdvanced");
const fetch = require("node-fetch");

function tokenize(input) {
  const result = [];
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|\S+/g;
  let match;
  while ((match = re.exec(input))) result.push(match[1] ?? match[2] ?? match[0]);
  return result;
}

function resolveUser(guild, value) {
  if (!value) return null;
  const id = String(value).match(/^<@!?(\d+)>$/)?.[1] || String(value).match(/^\d{17,20}$/)?.[0];
  if (id) return guild.members.cache.get(id)?.user || guild.client.users.cache.get(id) || null;
  const lower = String(value).toLowerCase();
  return guild.members.cache.find((m) => m.user.username.toLowerCase() === lower || m.displayName.toLowerCase() === lower)?.user || null;
}

function resolveMember(guild, value) {
  if (!value) return null;
  const id = String(value).match(/^<@!?(\d+)>$/)?.[1] || String(value).match(/^\d{17,20}$/)?.[0];
  if (id) return guild.members.cache.get(id) || null;
  const lower = String(value).toLowerCase();
  return guild.members.cache.find((m) => m.user.username.toLowerCase() === lower || m.displayName.toLowerCase() === lower) || null;
}

function resolveChannel(guild, value) {
  if (!value) return null;
  const id = String(value).match(/^<#(\d+)>$/)?.[1] || String(value).match(/^\d{17,20}$/)?.[0];
  if (id) return guild.channels.cache.get(id) || null;
  const lower = String(value).toLowerCase();
  return guild.channels.cache.find((c) => c.name?.toLowerCase() === lower) || null;
}

function resolveRole(guild, value) {
  if (!value) return null;
  const id = String(value).match(/^<@&(\d+)>$/)?.[1] || String(value).match(/^\d{17,20}$/)?.[0];
  if (id) return guild.roles.cache.get(id) || null;
  const lower = String(value).toLowerCase();
  return guild.roles.cache.find((r) => r.name.toLowerCase() === lower) || null;
}

function makePrefixInteraction(client, message, commandName, subcommand, optionValues) {
  let responseMessage = null;
  const option = (name) => optionValues[name];
  const options = {
    _subcommand: subcommand || null,
    _hoistedOptions: Object.entries(optionValues).map(([name, value]) => ({ name, value })),
    getSubcommand: () => subcommand,
    getSubcommandGroup: () => null,
    getString: (name) => option(name) ?? null,
    getInteger: (name) => option(name) == null ? null : Number.parseInt(option(name), 10),
    getNumber: (name) => option(name) == null ? null : Number(option(name)),
    getBoolean: (name) => {
      const value = option(name);
      if (value == null) return null;
      return ["true", "yes", "y", "on", "1"].includes(String(value).toLowerCase());
    },
    getUser: (name) => resolveUser(message.guild, option(name)),
    getMember: (name) => resolveMember(message.guild, option(name)),
    getChannel: (name) => resolveChannel(message.guild, option(name)),
    getRole: (name) => resolveRole(message.guild, option(name)),
    getMentionable: (name) => resolveUser(message.guild, option(name)) || resolveRole(message.guild, option(name)),
    getAttachment: () => null,
  };

  const interaction = {
    id: message.id,
    applicationId: client.application?.id,
    commandName,
    guild: message.guild,
    guildId: message.guild.id,
    channel: message.channel,
    channelId: message.channel.id,
    user: message.author,
    member: message.member,
    message,
    client,
    options,
    replied: false,
    deferred: false,
    isCommand: () => true,
    isChatInputCommand: () => true,
    isUserContextMenuCommand: () => false,
    isButton: () => false,
    isStringSelectMenu: () => false,
    deferReply: async () => { interaction.deferred = true; return interaction; },
    reply: async (payload) => {
      responseMessage = await message.channel.send(payload);
      interaction.replied = true;
      return responseMessage;
    },
    editReply: async (payload) => {
      if (responseMessage?.edit) return responseMessage.edit(payload);
      responseMessage = await message.channel.send(payload);
      interaction.replied = true;
      return responseMessage;
    },
    followUp: async (payload) => message.channel.send(payload),
    deleteReply: async () => responseMessage?.delete?.().catch?.(() => {}),
    fetchReply: async () => responseMessage,
  };

  return interaction;
}

function afkTimestamp(data) {
  return data?.CreatedAt || data?.createdAt || data?._id?.getTimestamp?.() || new Date();
}

function afkEmbed(user, data) {
  return new Discord.EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: `${user.username} is AFK`, iconURL: user.displayAvatarURL?.({ size: 128 }) || undefined })
    .setDescription(`${user} is currently away.`)
    .addFields(
      { name: "💬 Reason", value: String(data?.Message || "Not specified").slice(0, 1000), inline: false },
      { name: "🕒 AFK since", value: `<t:${Math.floor(new Date(afkTimestamp(data)).getTime() / 1000)}:R>`, inline: true },
    )
    .setTimestamp();
}

async function executePrefixCommand(client, message, commandName, args) {
  // AFK supports a simple prefix form: `.afk <reason>` while keeping `/afk set` intact.
  if (commandName === "afk" && !["set", "help", "list"].includes(args[0]?.toLowerCase())) {
    const handler = client.prefixCommands?.get("afk set");
    if (handler) {
      const interaction = makePrefixInteraction(client, message, "afk", "set", { reason: args.join(" ") || "Not specified" });
      try {
        await handler(client, interaction, interaction.options._hoistedOptions);
      } catch (error) {
        console.error("Prefix command afk failed:", error);
        await message.channel.send({ content: "❌ I couldn't set your AFK status. Please try again." }).catch(() => {});
      }
      return true;
    }
  }

  const command = client.commands.get(commandName);
  if (!command) return false;

  const data = typeof command.data?.toJSON === "function" ? command.data.toJSON() : command.data;
  const definitions = Array.isArray(data?.options) ? data.options : [];
  let subcommand = null;
  let optionDefinitions = definitions;
  let remaining = [...args];

  if (definitions.some((o) => o.type === 1 || o.type === 2)) {
    const requested = remaining[0]?.toLowerCase();
    const group = definitions.find((o) => o.type === 2 && o.name === requested);
    if (group) {
      subcommand = remaining.shift();
      const subs = group.options || [];
      const requestedSub = remaining[0]?.toLowerCase();
      const selected = subs.find((o) => o.type === 1 && o.name === requestedSub);
      if (selected) {
        subcommand = remaining.shift();
        optionDefinitions = selected.options || [];
      } else {
        optionDefinitions = [];
      }
    } else {
      const selected = definitions.find((o) => o.type === 1 && o.name === requested);
      if (selected) {
        subcommand = remaining.shift();
        optionDefinitions = selected.options || [];
      } else {
        const help = definitions.find((o) => o.type === 1 && o.name === "help");
        if (help) {
          subcommand = "help";
          optionDefinitions = [];
        }
      }
    }
  }

  const values = {};
  let cursor = 0;
  for (let i = 0; i < optionDefinitions.length; i++) {
    const def = optionDefinitions[i];
    const isLast = i === optionDefinitions.length - 1;
    if (cursor >= remaining.length) {
      values[def.name] = undefined;
      continue;
    }
    if (def.type === 3 && isLast) values[def.name] = remaining.slice(cursor).join(" ");
    else values[def.name] = remaining[cursor++];
  }

  const interaction = makePrefixInteraction(client, message, commandName, subcommand, values);
  try {
    await command.run(client, interaction, interaction.options._hoistedOptions);
    return true;
  } catch (error) {
    console.error(`Prefix command ${commandName}${subcommand ? ` ${subcommand}` : ""} failed:`, error);
    await message.channel.send({ content: "❌ Something went wrong while running that command." }).catch(() => {});
    return true;
  }
}

/**
 * @param {Discord.Client} client
 * @param {Discord.Message} message
 * @returns
 */
module.exports = async (client, message) => {
  const dmlog = new Discord.WebhookClient({ id: client.webhooks.dmLogs.id, token: client.webhooks.dmLogs.token });
  if (message.author.bot) return;

  if (message.channel.type === Discord.ChannelType.DM) {
    const embedLogs = new Discord.EmbedBuilder()
      .setTitle(`💬・New DM message!`)
      .setDescription(`Bot has received a new DM message!`)
      .addFields(
        { name: "👤┆Send By", value: `${message.author} (${message.author.tag})`, inline: true },
        { name: `💬┆Message`, value: `${message.content || "None"}`, inline: true },
      ).setColor(client.config.colors.normal).setTimestamp();
    if (message.attachments.size > 0) embedLogs.addFields({ name: `📃┆Attachments`, value: `${message.attachments.first()?.url}`, inline: false });
    return dmlog.send({ username: "Bot DM", embeds: [embedLogs] }).catch(() => {});
  }
  if (!message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  let guildSettings;
  try {
    guildSettings = await Functions.findOneAndUpdate(
      { Guild: guildId },
      { $setOnInsert: { Prefix: "." } },
      { new: true, upsert: true },
    ).lean().exec();
  } catch (error) {
    console.error("Failed to load guild settings:", error);
    return;
  }
  if (guildSettings && (!guildSettings.Prefix || guildSettings.Prefix === "!")) {
    guildSettings.Prefix = ".";
    Functions.updateOne({ Guild: guildId }, { $set: { Prefix: "." } }).catch(() => {});
  }
  const prefix = guildSettings?.Prefix || ".";

  if (guildSettings?.Levels === true) {
    const randomXP = Math.floor(Math.random() * 9) + 1;
    try {
      const hasLeveledUp = await client.addXP(userId, guildId, randomXP);
      if (hasLeveledUp) {
        const user = await client.fetchLevels(userId, guildId);
        const [levelData, messageData] = await Promise.all([
          levelLogs.findOne({ Guild: guildId }).lean().cache("60 seconds").exec(),
          messageSchema.findOne({ Guild: guildId }).lean().exec(),
        ]);
        if (messageData) {
          let levelMessage = messageData.Message;
          levelMessage = levelMessage.replace(`{user:username}`, message.author.username).replace(`{user:discriminator}`, message.author.discriminator).replace(`{user:tag}`, message.author.tag).replace(`{user:mention}`, message.author).replace(`{user:level}`, user.level).replace(`{user:xp}`, user.xp);
          const targetChannel = levelData ? client.channels.cache.get(levelData.Channel) : message.channel;
          await (targetChannel || message.channel).send({ content: levelMessage }).catch(() => {});
        } else {
          const levelContent = `**GG** <@!${userId}>, you are now level **${user.level}**`;
          const targetChannel = levelData ? client.channels.cache.get(levelData.Channel) : message.channel;
          await (targetChannel || message.channel).send({ content: levelContent }).catch(() => {});
        }
        levelRewards.findOne({ Guild: guildId, Level: user.level }).lean().cache("60 seconds").exec().then(async (data) => {
          if (!data) return;
          const member = message.guild.members.cache.get(userId);
          if (member) await member.roles.add(data.Role).catch(() => {});
        }).catch(() => {});
      }
    } catch (error) { console.error("Level system error:", error); }
  }

  try {
    const messageCounter = await messagesSchema.findOne({ Guild: guildId, User: userId }).exec();
    const updatedMessageCounter = messageCounter
      ? await messagesSchema.findOneAndUpdate({ Guild: guildId, User: userId }, { $inc: { Messages: 1 } }, { new: true }).exec()
      : await messagesSchema.create({ Guild: guildId, User: userId, Messages: 1 });
    if (updatedMessageCounter) messageRewards.findOne({ Guild: guildId, Messages: updatedMessageCounter.Messages }).lean().cache("60 seconds").exec().then(async (reward) => {
      if (!reward) return;
      const member = message.guild.members.cache.get(userId);
      if (member) await member.roles.add(reward.Role).catch(() => {});
    }).catch(() => {});
  } catch (error) { console.error("Message tracker error:", error); }

  const afkData = await afk.findOneAndDelete({ Guild: guildId, User: userId }).exec().catch(() => null);
  if (afkData) {
    const since = afkTimestamp(afkData);
    const welcome = new Discord.EmbedBuilder()
      .setColor(0x57f287)
      .setAuthor({ name: "Welcome back!", iconURL: message.author.displayAvatarURL?.({ size: 128 }) || undefined })
      .setDescription(`${message.author}, your AFK status has been removed.`)
      .addFields(
        { name: "💬 Previous reason", value: String(afkData.Message || "Not specified").slice(0, 1000), inline: false },
        { name: "🕒 You were AFK", value: `<t:${Math.floor(new Date(since).getTime() / 1000)}:R>`, inline: true },
      )
      .setTimestamp();
    await message.channel.send({ embeds: [welcome] }).then((m) => setTimeout(() => m.delete().catch(() => {}), 7000)).catch(() => {});
    if (message.member?.displayName?.startsWith(`[AFK] `)) await message.member.setNickname(message.member.displayName.replace(`[AFK] `, ``)).catch(() => {});
  }

  if (!message.content.includes("@here") && !message.content.includes("@everyone") && message.mentions.users.size > 0) {
    const mentionedIds = [...message.mentions.users.keys()];
    const afkUsers = await afk.find({ Guild: guildId, User: { $in: mentionedIds } }).lean().exec().catch(() => []);
    for (const afkUser of afkUsers || []) {
      const user = message.mentions.users.get(afkUser.User);
      if (user) await message.channel.send({ embeds: [afkEmbed(user, afkUser)] }).catch(() => {});
    }
  }

  chatBotSchema.findOne({ Guild: guildId }).lean().cache("60 seconds").exec().then(async (data) => {
    if (!data || message.channel.id !== data.Channel || !process.env.OPENAI) return;
    try {
      const response = await fetch(`https://api.openai.com/v1/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.OPENAI.trim() }, body: JSON.stringify({ model: "gpt-3.5-turbo", messages: [{ role: "user", content: message.content }] }) });
      if (!response.ok) return;
      const json = await response.json();
      const reply = json?.choices?.[0]?.message?.content;
      if (!json?.error && reply) await message.reply({ content: reply }).catch(() => {});
    } catch (error) { console.error("Chat bot error:", error); }
  }).catch(() => {});

  try {
    const data = await Schema.findOne({ Guild: guildId, Channel: message.channel.id });
    if (data) {
      const lastStickyMessage = await message.channel.messages.fetch(data.LastMessage).catch(() => null);
      if (lastStickyMessage) setTimeout(() => lastStickyMessage.delete().catch(() => {}), 1000);
      const newMessage = await client.simpleEmbed({ desc: `${data.Content}` }, message.channel);
      if (newMessage) { data.LastMessage = newMessage.id; await data.save(); }
    }
  } catch (error) { console.error("Sticky message error:", error); }

  const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefixRegex = new RegExp(`^(<@!?${client.user.id}>|${escapeRegex(prefix)})\\s*`, "i");
  const prefixMatch = message.content.match(prefixRegex);
  if (!prefixMatch) return;

  const matchedPrefix = prefixMatch[0];
  const content = message.content.slice(matchedPrefix.length).trim();
  const tokens = tokenize(content);
  const command = (tokens.shift() || "").toLowerCase();
  const args = tokens;

  if (message.mentions.users.first()?.id === client.user.id && command.length === 0) {
    const row = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder().setLabel("Invite").setURL(client.config.discord.botInvite).setStyle(Discord.ButtonStyle.Link),
      new Discord.ButtonBuilder().setLabel("Support server").setURL(client.config.discord.serverInvite).setStyle(Discord.ButtonStyle.Link),
    );
    return client.embed({ title: "Hi, I'm LightCore", desc: `Use **${prefix}** followed by a command, or use Discord slash commands.`, components: [row] }, message.channel).catch(() => {});
  }

  if (await executePrefixCommand(client, message, command, args)) return;

  const cmd = await Commands.findOne({ Guild: guildId, Name: command }).lean().cache("60 seconds").exec();
  if (cmd) return message.channel.send({ content: cmd.Responce }).catch(() => {});
  const cmdx = await CommandsSchema.findOne({ Guild: guildId, Name: command }).lean().cache("60 seconds").exec();
  if (cmdx) {
    if (cmdx.Action === "Normal") return message.channel.send({ content: cmdx.Responce }).catch(() => {});
    if (cmdx.Action === "Embed") return client.simpleEmbed({ desc: `${cmdx.Responce}` }, message.channel);
    if (cmdx.Action === "DM") return message.author.send({ content: cmdx.Responce }).catch(() => client.errNormal({ error: "I can't DM you, maybe you have DM turned off!" }, message.channel));
  }
};
