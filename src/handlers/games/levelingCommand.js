const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const service = require("./levelingService");
const levelingConfig = require("../../database/models/levelingConfig");
const levelRewards = require("../../database/models/levelRewards");

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

function reply(interaction, payload) {
  return interaction.reply?.(payload);
}

async function rank(interaction, user = interaction.user) {
  const data = await service.getRank(interaction.guild.id, user.id);
  const { record, progress, config, position } = data;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🏆 ${user.username}'s Rank`)
    .setThumbnail(user.displayAvatarURL?.({ size: 128 }) || null)
    .addFields(
      { name: "Level", value: `**${record.Level}**`, inline: true },
      { name: "XP", value: `**${record.XP.toLocaleString()}**`, inline: true },
      { name: "Server Rank", value: `**#${position}**`, inline: true },
      { name: "Progress", value: `${service.progressBar(progress.percent)} ${progress.percent}%\n${progress.current.toLocaleString()} / ${progress.next.toLocaleString()} XP`, inline: false },
    )
    .setFooter({ text: `Next XP grant after ${Math.max(0, config.MessageThreshold - record.MessageCount)} message(s)` })
    .setTimestamp();
  return reply(interaction, { embeds: [embed] });
}

async function leaderboard(interaction) {
  const { records } = await service.getLeaderboard(interaction.guild.id, 10);
  const lines = records.length
    ? records.map((record, index) => `**${index + 1}.** <@${record.User}> — Level **${record.Level}** • ${record.XP.toLocaleString()} XP`)
    : ["No leveling data yet. Start chatting to appear here!"];
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🏆 ${interaction.guild.name} Level Leaderboard`)
    .setDescription(lines.join("\n"))
    .setTimestamp();
  return reply(interaction, { embeds: [embed] });
}

async function configure(interaction) {
  if (!isAdmin(interaction)) return reply(interaction, { content: "❌ You need **Manage Server** to change leveling settings.", ephemeral: true });

  const options = interaction.options;
  const updates = { Enabled: true };
  const threshold = options.getInteger?.("threshold");
  const minXP = options.getInteger?.("min_xp");
  const maxXP = options.getInteger?.("max_xp");
  const multiplier = options.getNumber?.("multiplier");
  const channel = options.getChannel?.("channel");
  const announcements = options.getBoolean?.("announcements");
  const coinReward = options.getInteger?.("coin_reward");

  if (threshold != null) updates.MessageThreshold = threshold;
  if (minXP != null) updates.MinXP = minXP;
  if (maxXP != null) updates.MaxXP = maxXP;
  if (multiplier != null) updates.XPMultiplier = multiplier;
  if (channel) updates.LevelUpChannel = channel.id;
  if (announcements != null) updates.Announcements = announcements;
  if (coinReward != null) updates.LevelCoinReward = coinReward;

  const config = await levelingConfig.findOneAndUpdate(
    { Guild: interaction.guild.id },
    { $set: updates },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  const channelText = config.LevelUpChannel ? `<#${config.LevelUpChannel}>` : "system channel";
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("⚙️ Leveling configured")
    .setDescription("Per-server leveling is now enabled.")
    .addFields(
      { name: "Messages / XP", value: `${config.MessageThreshold}`, inline: true },
      { name: "XP Range", value: `${config.MinXP}–${config.MaxXP}`, inline: true },
      { name: "Multiplier", value: `${config.XPMultiplier}×`, inline: true },
      { name: "Announcements", value: config.Announcements ? "Enabled" : "Disabled", inline: true },
      { name: "Channel", value: channelText, inline: true },
      { name: "Coin reward", value: `${config.LevelCoinReward.toLocaleString()} global coins / level`, inline: true },
    );
  return reply(interaction, { embeds: [embed] });
}

async function addReward(interaction) {
  if (!isAdmin(interaction)) return reply(interaction, { content: "❌ You need **Manage Server** to configure level roles.", ephemeral: true });
  const level = interaction.options.getInteger("level");
  const role = interaction.options.getRole("role");
  await levelRewards.findOneAndUpdate(
    { Guild: interaction.guild.id, Level: level },
    { $set: { Role: role.id } },
    { upsert: true, new: true },
  ).exec();
  return reply(interaction, { content: `✅ Reaching level **${level}** now grants ${role}. Milestone roles **stack**.` });
}

async function deleteReward(interaction) {
  if (!isAdmin(interaction)) return reply(interaction, { content: "❌ You need **Manage Server** to configure level roles.", ephemeral: true });
  const level = interaction.options.getInteger("level");
  const result = await levelRewards.deleteOne({ Guild: interaction.guild.id, Level: level }).exec();
  return reply(interaction, { content: result.deletedCount ? `✅ Removed the level **${level}** milestone role.` : `ℹ️ No milestone role was configured for level **${level}**.` });
}

async function rewards(interaction) {
  const entries = await levelRewards.find({ Guild: interaction.guild.id }).sort({ Level: 1 }).lean().exec();
  const description = entries.length ? entries.map((entry) => `**Level ${entry.Level}** → <@&${entry.Role}>`).join("\n") : "No milestone roles configured.";
  return reply(interaction, { embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("🎖️ Level Rewards").setDescription(description)] });
}

async function setXP(interaction) {
  if (!isAdmin(interaction)) return reply(interaction, { content: "❌ You need **Manage Server**.", ephemeral: true });
  const user = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");
  await interaction.client.setXP(user.id, interaction.guild.id, amount);
  return reply(interaction, { content: `✅ Set ${user}'s server XP to **${amount.toLocaleString()}**.` });
}

async function setLevel(interaction) {
  if (!isAdmin(interaction)) return reply(interaction, { content: "❌ You need **Manage Server**.", ephemeral: true });
  const user = interaction.options.getUser("user");
  const level = interaction.options.getInteger("level");
  await interaction.client.setLevel(user.id, interaction.guild.id, level);
  return reply(interaction, { content: `✅ Set ${user}'s server level to **${level}**.` });
}

async function help(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📈 Leveling")
    .setDescription("Per-server XP, ranks, leaderboards, milestone roles and global coin rewards.")
    .addFields(
      { name: ".rank / /levels rank", value: "View a member's server rank and progress." },
      { name: ".level / /level", value: "View your current level and XP progress." },
      { name: ".leaderboard / /leaderboard", value: "View the server's top XP users." },
      { name: ".levels config", value: "Admins configure XP range, message threshold, multiplier, channel, announcements and coin reward." },
      { name: ".levels reward", value: "Admins assign a role to a milestone level. Rewards stack." },
    );
  return reply(interaction, { embeds: [embed] });
}

module.exports = { rank, leaderboard, configure, addReward, deleteReward, rewards, setXP, setLevel, help };
