const leveling = require("../../database/models/leveling");
const service = require("./levelingService");

module.exports = async (client) => {
  client.xpFor = (targetLevel, multiplier = 1) => service.xpFor(targetLevel, multiplier);

  client.setXP = async function (userId, guildId, xp) {
    const config = await service.getConfig(guildId);
    const amount = Math.max(0, Number(xp) || 0);
    const user = await service.ensureRecord(guildId, userId);
    user.XP = amount;
    user.Level = service.levelFor(amount, config.XPMultiplier);
    user.MessageCount = 0;
    user.LastUpdated = new Date();
    await user.save();
    return user;
  };

  client.setLevel = async function (userId, guildId, level) {
    const config = await service.getConfig(guildId);
    const target = Math.max(0, Math.floor(Number(level) || 0));
    const user = await service.ensureRecord(guildId, userId);
    user.Level = target;
    user.XP = service.xpFor(target, config.XPMultiplier);
    user.MessageCount = 0;
    user.LastUpdated = new Date();
    await user.save();
    return user;
  };

  // messageCreate calls this once per message. The service itself enforces
  // the per-server message threshold and short anti-spam cooldown.
  client.addXP = async function (userId, guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return false;
    await service.addMessage(guild, userId);
    // Level-up announcements, global coin rewards and milestone roles are
    // handled inside the dedicated leveling service so the legacy message
    // handler does not double-announce or double-reward.
    return false;
  };

  client.addLevel = async function (userId, guildId, amount) {
    const user = await service.ensureRecord(guildId, userId);
    const config = await service.getConfig(guildId);
    user.Level = Math.max(0, user.Level + Math.floor(Number(amount) || 0));
    user.XP = service.xpFor(user.Level, config.XPMultiplier);
    user.LastUpdated = new Date();
    await user.save();
    return user;
  };

  client.fetchLevels = async function (userId, guildId, fetchPosition = true) {
    const result = await service.getRank(guildId, userId);
    if (!result) return false;

    const user = result.record;
    user.position = fetchPosition ? result.position : undefined;
    user.cleanXp = Math.max(0, user.XP - result.progress.current);
    user.cleanNextLevelXp = Math.max(1, result.progress.next - result.progress.current);
    // Backwards-compatible lowercase properties for older level consumers.
    user.xp = user.XP;
    user.level = user.Level;
    return user;
  };

  client.getLevelLeaderboard = async function (guildId, limit = 10) {
    return service.getLeaderboard(guildId, limit);
  };

  // Keep the model loaded here for compatibility with older integrations that
  // inspect the handler's model reference.
  client.levelingModel = leveling;
};
