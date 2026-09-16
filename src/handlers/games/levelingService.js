const { EmbedBuilder } = require("discord.js");
const leveling = require("../../database/models/leveling");
const levelingConfig = require("../../database/models/levelingConfig");
const levelRewards = require("../../database/models/levelRewards");
const economy = require("../../database/models/economy");

const xpCooldown = new Map();
const COOLDOWN_MS = 2500;

function xpFor(level, multiplier = 1) {
  const base = 5 * level * level + 50 * level + 100;
  return Math.max(0, Math.floor(base * multiplier));
}

function levelFor(xp, multiplier = 1) {
  let level = 0;
  while (xp >= xpFor(level + 1, multiplier)) level += 1;
  return level;
}

function progressFor(record, config) {
  const current = xpFor(record.Level, config.XPMultiplier);
  const next = xpFor(record.Level + 1, config.XPMultiplier);
  const span = Math.max(1, next - current);
  const progress = Math.max(0, Math.min(1, (record.XP - current) / span));
  return { current, next, progress, percent: Math.floor(progress * 100) };
}

function progressBar(percent, size = 10) {
  const filled = Math.round((percent / 100) * size);
  return `${"█".repeat(filled)}${"░".repeat(size - filled)}`;
}

async function getConfig(guildId) {
  return levelingConfig.findOneAndUpdate(
    { Guild: guildId },
    { $setOnInsert: { Guild: guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();
}

async function ensureRecord(guildId, userId) {
  return leveling.findOneAndUpdate(
    { Guild: guildId, User: userId },
    { $setOnInsert: { Guild: guildId, User: userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();
}

async function applyMilestoneRoles(guild, userId, newLevel) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  const rewards = await levelRewards.find({ Guild: guild.id, Level: { $lte: newLevel } }).sort({ Level: 1 }).lean().exec();
  const roleIds = rewards.map((reward) => reward.Role).filter(Boolean);
  if (!roleIds.length) return;

  await member.roles.add([...new Set(roleIds)], `Level milestone reward: level ${newLevel}`).catch(() => {});
}

async function awardLevelCoins(userId, amount) {
  if (!amount || amount <= 0) return;
  await economy.findOneAndUpdate(
    { User: userId },
    { $inc: { Money: amount } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();
}

async function announceLevelUp(guild, userId, level, record, config, reward) {
  if (!config.Announcements) return;
  const channel = config.LevelUpChannel
    ? guild.channels.cache.get(config.LevelUpChannel) || await guild.channels.fetch(config.LevelUpChannel).catch(() => null)
    : null;
  const target = channel || guild.systemChannel;
  if (!target || !target.isTextBased()) return;

  const progress = progressFor(record, config);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("✨ Level Up!")
    .setDescription(`<@${userId}> reached **Level ${level}**!`)
    .addFields(
      { name: "XP", value: `**${record.XP.toLocaleString()} XP**`, inline: true },
      { name: "Progress", value: `${progressBar(progress.percent)} ${progress.percent}%`, inline: true },
    )
    .setFooter({ text: reward > 0 ? `+${reward.toLocaleString()} coins • Keep going!` : "Keep going!" })
    .setTimestamp();

  await target.send({ content: `<@${userId}>`, embeds: [embed] }).catch(() => {});
}

async function addMessage(guild, userId) {
  const config = await getConfig(guild.id);
  if (!config.Enabled) return { granted: false, leveledUp: false, record: null, config };

  const key = `${guild.id}:${userId}`;
  const now = Date.now();
  if (now - (xpCooldown.get(key) || 0) < COOLDOWN_MS) {
    return { granted: false, leveledUp: false, record: await ensureRecord(guild.id, userId), config };
  }
  xpCooldown.set(key, now);

  const record = await ensureRecord(guild.id, userId);
  record.MessageCount += 1;
  record.LastUpdated = new Date();

  if (record.MessageCount < config.MessageThreshold) {
    await record.save();
    return { granted: false, leveledUp: false, record, config };
  }

  record.MessageCount = 0;
  const rawXP = Math.floor(Math.random() * (config.MaxXP - config.MinXP + 1)) + config.MinXP;
  const grantedXP = Math.max(1, Math.round(rawXP * config.XPMultiplier));
  const oldLevel = record.Level;
  record.XP += grantedXP;
  record.Level = levelFor(record.XP, config.XPMultiplier);
  record.LastXPAt = new Date();
  await record.save();

  const leveledUp = record.Level > oldLevel;
  if (leveledUp) {
    const reward = config.LevelCoinReward * (record.Level - oldLevel);
    await awardLevelCoins(userId, reward);
    await applyMilestoneRoles(guild, userId, record.Level);
    await announceLevelUp(guild, userId, record.Level, record, config, reward);
  }

  return { granted: true, grantedXP, leveledUp, oldLevel, record, config };
}

async function getRank(guildId, userId) {
  const config = await getConfig(guildId);
  const record = await ensureRecord(guildId, userId);
  const position = await leveling.countDocuments({ Guild: guildId, XP: { $gt: record.XP } }) + 1;
  return { record, config, position, progress: progressFor(record, config) };
}

async function getLeaderboard(guildId, limit = 10) {
  const config = await getConfig(guildId);
  const records = await leveling.find({ Guild: guildId }).sort({ XP: -1, Level: -1 }).limit(limit).lean().exec();
  return { config, records };
}

function clearCooldowns() {
  const cutoff = Date.now() - COOLDOWN_MS * 4;
  for (const [key, time] of xpCooldown) if (time < cutoff) xpCooldown.delete(key);
}
setInterval(clearCooldowns, 60_000).unref?.();

const service = {
  xpFor,
  levelFor,
  progressFor,
  progressBar,
  getConfig,
  ensureRecord,
  addMessage,
  getRank,
  getLeaderboard,
};

// bot.js loads every file in src/handlers/<folder> as a client initializer.
// Keep the service API available while also satisfying that handler contract.
async function levelingServiceHandler(client) {
  client.levelingService = service;
}

Object.assign(levelingServiceHandler, service);
module.exports = levelingServiceHandler;
