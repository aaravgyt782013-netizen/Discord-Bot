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

function getUserBoost(config, userId) {
  const boost = Number(config.UserXPBoosts?.get?.(userId) ?? 0);
  return Number.isFinite(boost) && boost >= 0.1 ? boost : 0;
}

function effectiveBoost(config, userId) {
  return getUserBoost(config, userId) || Number(config.XPBoost) || 1;
}

async function setXPBoost(guildId, userId, multiplier) {
  const config = await getConfig(guildId);
  const boost = Number(multiplier);
  if (!Number.isFinite(boost) || boost < 0.1 || boost > 10) throw new RangeError("XP boost must be between 0.1x and 10x.");

  if (userId) config.UserXPBoosts.set(userId, boost);
  else config.XPBoost = boost;
  await config.save();
  return config;
}

async function clearXPBoost(guildId, userId) {
  const config = await getConfig(guildId);
  if (userId) config.UserXPBoosts.delete(userId);
  else config.XPBoost = 1;
  await config.save();
  return config;
}

async function applyMilestoneRoles(guild, userId, newLevel) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return [];

  const rewards = await levelRewards.find({ Guild: guild.id, Level: { $lte: newLevel } }).sort({ Level: 1 }).lean().exec();
  const roleIds = [...new Set(rewards.map((reward) => reward.Role).filter(Boolean))];
  if (!roleIds.length) return [];

  await member.roles.add(roleIds, `Level milestone reward: level ${newLevel}`).catch(() => {});
  return roleIds;
}

async function awardLevelCoins(userId, amount) {
  if (!amount || amount <= 0) return;
  await economy.findOneAndUpdate(
    { User: userId },
    { $inc: { Money: amount } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();
}

function renderLevelUpMessage(template, user, guild, record, config, reward) {
  const progress = progressFor(record, config);
  const values = {
    "{user.mention}": `<@${user.id}>`,
    "{user.username}": user.username,
    "{user.name}": user.globalName || user.username,
    "{user.id}": user.id,
    "{user.level}": String(record.Level),
    "{user.xp}": String(Math.max(0, record.XP - progress.current)),
    "{user.total_xp}": String(record.XP),
    "{server}": guild.name,
    "{reward}": reward > 0 ? `+${reward.toLocaleString()} coins` : "",
  };

  return Object.entries(values).reduce((text, [tag, value]) => text.split(tag).join(value), template || "{user.mention} reached **Level {user.level}**! GG!");
}

async function announceLevelUp(guild, userId, level, record, config, reward) {
  if (!config.Announcements) return;
  const channel = config.LevelUpChannel
    ? guild.channels.cache.get(config.LevelUpChannel) || await guild.channels.fetch(config.LevelUpChannel).catch(() => null)
    : null;
  const target = channel || guild.systemChannel;
  if (!target || !target.isTextBased()) return;

  const user = await guild.client.users.fetch(userId).catch(() => guild.client.users.cache.get(userId));
  if (!user) return;

  const content = renderLevelUpMessage(config.LevelUpMessage, user, guild, record, config, reward);
  const progress = progressFor(record, config);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("✨ Level Up!")
    .setDescription(content)
    .addFields(
      { name: "Level", value: `**${level}**`, inline: true },
      { name: "XP", value: `**${record.XP.toLocaleString()} XP**`, inline: true },
      { name: "Progress", value: `${progressBar(progress.percent)} ${progress.percent}%`, inline: false },
    )
    .setTimestamp();

  await target.send({ embeds: [embed] }).catch(() => {});
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
  const grantedXP = Math.max(1, Math.round(rawXP * config.XPMultiplier * effectiveBoost(config, userId)));
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

async function getGlobalLeaderboard(limit = 10) {
  const records = await leveling.aggregate([
    { $group: { _id: "$User", XP: { $sum: "$XP" }, Level: { $max: "$Level" }, Servers: { $sum: 1 } } },
    { $sort: { XP: -1, Level: -1 } },
    { $limit: limit },
  ]).exec();
  return { records };
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
  getGlobalLeaderboard,
  getUserBoost,
  setXPBoost,
  clearXPBoost,
};

async function levelingServiceHandler(client) {
  client.levelingService = service;
}

Object.assign(levelingServiceHandler, service);
module.exports = levelingServiceHandler;
