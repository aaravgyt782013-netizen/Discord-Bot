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

/**
 *
 * @param {Discord.Client} client
 * @param {Discord.Message} message
 * @returns
 */
module.exports = async (client, message) => {
  const dmlog = new Discord.WebhookClient({
    id: client.webhooks.dmLogs.id,
    token: client.webhooks.dmLogs.token,
  });

  if (message.author.bot) return;

  if (message.channel.type === Discord.ChannelType.DM) {
    const embedLogs = new Discord.EmbedBuilder()
      .setTitle(`💬・New DM message!`)
      .setDescription(`Bot has received a new DM message!`)
      .addFields(
        {
          name: "👤┆Send By",
          value: `${message.author} (${message.author.tag})`,
          inline: true,
        },
        {
          name: `💬┆Message`,
          value: `${message.content || "None"}`,
          inline: true,
        },
      )
      .setColor(client.config.colors.normal)
      .setTimestamp();

    if (message.attachments.size > 0) {
      embedLogs.addFields({
        name: `📃┆Attachments`,
        value: `${message.attachments.first()?.url}`,
        inline: false,
      });
    }

    return dmlog.send({
      username: "Bot DM",
      embeds: [embedLogs],
    }).catch(() => {});
  }

  if (!message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  let guildSettings;
  try {
    guildSettings = await Functions.findOneAndUpdate(
      { Guild: guildId },
      { $setOnInsert: { Prefix: client.config.discord.prefix } },
      { new: true, upsert: true },
    )
      .lean()
      .exec();
  } catch (error) {
    console.error("Failed to load guild settings:", error);
    return;
  }

  if (guildSettings && !guildSettings.Prefix) {
    Functions.updateOne(
      { Guild: guildId },
      { $set: { Prefix: client.config.discord.prefix } },
    ).catch(() => {});
  }

  const prefix = guildSettings?.Prefix || client.config.discord.prefix;

  // Levels
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
          levelMessage = levelMessage.replace(`{user:username}`, message.author.username);
          levelMessage = levelMessage.replace(`{user:discriminator}`, message.author.discriminator);
          levelMessage = levelMessage.replace(`{user:tag}`, message.author.tag);
          levelMessage = levelMessage.replace(`{user:mention}`, message.author);
          levelMessage = levelMessage.replace(`{user:level}`, user.level);
          levelMessage = levelMessage.replace(`{user:xp}`, user.xp);

          try {
            const targetChannel = levelData
              ? client.channels.cache.get(levelData.Channel)
              : message.channel;

            if (targetChannel) {
              await targetChannel.send({ content: levelMessage });
            } else {
              await message.channel.send({ content: levelMessage });
            }
          } catch {
            await message.channel.send({ content: levelMessage }).catch(() => {});
          }
        } else {
          const levelContent = `**GG** <@!${userId}>, you are now level **${user.level}**`;
          const targetChannel = levelData
            ? client.channels.cache.get(levelData.Channel)
            : message.channel;

          if (targetChannel) {
            await targetChannel.send({ content: levelContent }).catch(() => {});
          } else {
            await message.channel.send({ content: levelContent }).catch(() => {});
          }
        }

        levelRewards
          .findOne({ Guild: guildId, Level: user.level })
          .lean()
          .cache("60 seconds")
          .exec()
          .then(async (data) => {
            if (!data) return;
            const member = message.guild.members.cache.get(userId);
            if (member) await member.roles.add(data.Role).catch(() => {});
          })
          .catch(() => {});
      }
    } catch (error) {
      console.error("Level system error:", error);
    }
  }

  // Message tracker system
  try {
    const messageCounter = await messagesSchema
      .findOne({ Guild: guildId, User: userId })
      .exec();

    const updatedMessageCounter = messageCounter
      ? await messagesSchema.findOneAndUpdate(
          { Guild: guildId, User: userId },
          { $inc: { Messages: 1 } },
          { new: true },
        ).exec()
      : await messagesSchema.create({ Guild: guildId, User: userId, Messages: 1 });

    if (updatedMessageCounter) {
      messageRewards
        .findOne({ Guild: guildId, Messages: updatedMessageCounter.Messages })
        .lean()
        .cache("60 seconds")
        .exec()
        .then(async (reward) => {
          if (!reward) return;
          const member = message.guild.members.cache.get(userId);
          if (member) await member.roles.add(reward.Role).catch(() => {});
        })
        .catch(() => {});
    }
  } catch (error) {
    console.error("Message tracker error:", error);
  }

  // AFK system
  afk.findOneAndDelete({ Guild: guildId, User: userId }).then(async (data) => {
    if (!data) return;

    client.simpleEmbed(
      { desc: `${message.author} is no longer afk!` },
      message.channel,
    ).then((m) => {
      if (!m) return;
      setTimeout(() => m.delete().catch(() => {}), 5000);
    }).catch(() => {});

    if (message.member?.displayName?.startsWith(`[AFK] `)) {
      const name = message.member.displayName.replace(`[AFK] `, ``);
      message.member.setNickname(name).catch(() => {});
    }
  }).catch(() => {});

  if (
    !message.content.includes("@here") &&
    !message.content.includes("@everyone") &&
    message.mentions.users.size > 0
  ) {
    const mentionedUserIds = [...message.mentions.users.keys()];

    afk.find({ Guild: guildId, User: { $in: mentionedUserIds } })
      .lean()
      .exec()
      .then((afkUsers) => {
        if (!afkUsers?.length) return;

        for (const afkUser of afkUsers) {
          const user = message.mentions.users.get(afkUser.User);
          if (!user) continue;

          client.simpleEmbed(
            { desc: `${user} is currently afk! **Reason:** ${afkUser.Message}` },
            message.channel,
          ).catch(() => {});
        }
      })
      .catch(() => {});
  }

  // Chat bot
  chatBotSchema
    .findOne({ Guild: guildId })
    .lean()
    .cache("60 seconds")
    .exec()
    .then(async (data) => {
      if (!data || message.channel.id !== data.Channel || !process.env.OPENAI) return;

      try {
        const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + process.env.OPENAI.trim(),
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: message.content }],
          }),
        });

        if (!response.ok) {
          console.error(`OpenAI request failed: ${response.status} ${response.statusText}`);
          return;
        }

        const json = await response.json();
        const reply = json?.choices?.[0]?.message?.content;
        if (json?.error || !reply) return;

        await message.reply({ content: reply }).catch(() => {});
      } catch (error) {
        console.error("Chat bot error:", error);
      }
    })
    .catch(() => {});

  // Sticky messages
  try {
    const data = await Schema.findOne({
      Guild: guildId,
      Channel: message.channel.id,
    });

    if (data) {
      const lastStickyMessage = await message.channel.messages.fetch(data.LastMessage).catch(() => null);
      if (lastStickyMessage) {
        setTimeout(() => {
          lastStickyMessage.delete().catch(() => {});
        }, 1000);
      }

      const newMessage = await client.simpleEmbed(
        { desc: `${data.Content}` },
        message.channel,
      );

      if (newMessage) {
        data.LastMessage = newMessage.id;
        await data.save();
      }
    }
  } catch (error) {
    console.error("Sticky message error:", error);
  }

  // Prefix
  const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefixRegex = new RegExp(
    `^(<@!?${client.user.id}>|${escapeRegex(prefix)})\\s*`,
    "i",
  );

  const prefixMatch = message.content.match(prefixRegex);
  if (!prefixMatch) return;

  const matchedPrefix = prefixMatch[0];
  const args = message.content.slice(matchedPrefix.length).trim().split(/ +/g);
  const command = (args.shift() || "").toLowerCase();

  if (
    message.mentions.users.first() &&
    message.mentions.users.first().id === client.user.id &&
    command.length === 0
  ) {
    const row = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder()
        .setLabel("Invite")
        .setURL(client.config.discord.botInvite)
        .setStyle(Discord.ButtonStyle.Link),
      new Discord.ButtonBuilder()
        .setLabel("Support server")
        .setURL(client.config.discord.serverInvite)
        .setStyle(Discord.ButtonStyle.Link),
    );

    client.embed(
      {
        title: "Hi, i'm Bot",
        desc: `Use with commands via Discord ${client.emotes.normal.slash} commands`,
        fields: [
          {
            name: "📨┆Invite me",
            value: `Invite Bot in your own server! [Click here](${client.config.discord.botInvite})`,
          },
          {
            name: "❓┇I don't see any slash commands",
            value: "The bot may not have permissions for this. Open the invite link again and select your server. The bot then gets the correct permissions",
          },
          {
            name: "❓┆Need support?",
            value: `For questions you can join our [support server](${client.config.discord.serverInvite})!`,
          },
          {
            name: "🐞┆Found a bug?",
            value: `Report all bugs via: \`/report bug\`!`,
          },
        ],
        components: [row],
      },
      message.channel,
    ).catch(() => {});
  }

  const cmd = await Commands.findOne({ Guild: guildId, Name: command })
    .lean()
    .cache("60 seconds")
    .exec();

  if (cmd) {
    return message.channel.send({ content: cmd.Responce }).catch(() => {});
  }

  const cmdx = await CommandsSchema.findOne({ Guild: guildId, Name: command })
    .lean()
    .cache("60 seconds")
    .exec();

  if (cmdx) {
    if (cmdx.Action === "Normal") {
      return message.channel.send({ content: cmdx.Responce }).catch(() => {});
    }

    if (cmdx.Action === "Embed") {
      return client.simpleEmbed({ desc: `${cmdx.Responce}` }, message.channel);
    }

    if (cmdx.Action === "DM") {
      return message.author.send({ content: cmdx.Responce }).catch(() => {
        client.errNormal(
          { error: "I can't DM you, maybe you have DM turned off!" },
          message.channel,
        );
      });
    }
  }
};
