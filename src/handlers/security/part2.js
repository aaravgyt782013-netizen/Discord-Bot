const Discord = require("discord.js");
const fetch = require("node-fetch");
const Functions = require("../../database/models/functions");
const Verify = require("../../database/models/verify");
const Honeypot = require("../../database/models/honeypot");
const Notifier = require("../../database/models/notifier");
const ModLogs = require("../../database/models/modlogs");
const Blacklist = require("../../database/models/blacklist");

const spam = new Map();
const INVITE = /(?:discord\.gg|discord(?:app)?\.com\/invite|discord\.me|discord\.li)\/[A-Za-z0-9-]+/i;
const URL = /https?:\/\/\S+/i;
const MOD_COMMANDS = new Set(["ban", "kick", "mute", "timeout", "warn", "unmute", "unban"]);
const isAdmin = (m) => !!m?.permissions?.has(Discord.PermissionFlagsBits.Administrator);
const isMod = (m) => !!m?.permissions?.has(Discord.PermissionFlagsBits.ManageMessages);
const card = (title, text, color = 0x5865f2) => ({ embeds: [new Discord.EmbedBuilder().setTitle(title).setDescription(text).setColor(color).setTimestamp()] });

async function config(guildId, update = {}) {
  return Functions.findOneAndUpdate({ Guild: guildId }, { $set: update, $setOnInsert: { Guild: guildId, Prefix: "." } }, { upsert: true, new: true, setDefaultsOnInsert: true }).exec();
}
async function modLog(guild, title, fields = [], color = 0xed4245) {
  const data = await ModLogs.findOne({ Guild: guild.id }).lean().exec().catch(() => null);
  if (!data?.Enabled || !data.Channel) return;
  const ch = guild.channels.cache.get(data.Channel) || await guild.channels.fetch(data.Channel).catch(() => null);
  if (!ch?.isTextBased?.()) return;
  const e = new Discord.EmbedBuilder().setTitle(`🛡️・${title}`).setColor(color).setTimestamp();
  for (const [name, value, inline] of fields) e.addFields({ name, value: String(value ?? "None").slice(0, 1024), inline: !!inline });
  await ch.send({ embeds: [e] }).catch(() => {});
}
function channel(guild, value) {
  const raw = String(value || "").trim();
  const id = raw.match(/^<#(\d+)>$/)?.[1] || raw.match(/^\d{17,20}$/)?.[0];
  return id ? guild.channels.cache.get(id) : guild.channels.cache.find((c) => c.name?.toLowerCase() === raw.toLowerCase());
}
async function ytChannel(value) {
  const raw = String(value || "").trim();
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(raw)) return raw;
  const direct = raw.match(/\/channel\/(UC[A-Za-z0-9_-]{20,})/);
  if (direct) return direct[1];
  if (!/^https?:\/\//i.test(raw)) throw new Error("Use a valid YouTube channel URL.");
  const r = await fetch(raw, { headers: { "user-agent": "LightCore notifier" } });
  if (!r.ok) throw new Error(`YouTube returned HTTP ${r.status}.`);
  return (await r.text()).match(/"channelId":"(UC[A-Za-z0-9_-]{20,})"/)?.[1] || null;
}
async function latest(channelId) {
  const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, { headers: { "user-agent": "LightCore notifier" } });
  if (!r.ok) throw new Error(`YouTube RSS returned HTTP ${r.status}.`);
  const x = await r.text();
  const entry = x.match(/<entry>([\s\S]*?)<\/entry>/)?.[1];
  if (!entry) return null;
  const clean = (v) => String(v || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
  return { id: entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] || null, title: clean(entry.match(/<media:title>([\s\S]*?)<\/media:title>/)?.[1]) || "New video", author: clean(entry.match(/<name>([^<]+)<\/name>/)?.[1]) || "YouTube" };
}
async function setupHoney(guild, action = "ban") {
  if (!["ban", "kick"].includes(action)) throw new Error("Action must be `ban` or `kick`.");
  let d = await Honeypot.findOne({ Guild: guild.id }).exec();
  let ch = d?.Channel ? guild.channels.cache.get(d.Channel) : null;
  if (!ch) ch = await guild.channels.create({ name: "honeypot", type: Discord.ChannelType.GuildText, reason: "LightCore honeypot setup", permissionOverwrites: [
    { id: guild.roles.everyone.id, deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages] },
    { id: guild.client.user.id, allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages, Discord.PermissionFlagsBits.ReadMessageHistory] },
  ] });
  await ch.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false, SendMessages: false }).catch(() => {});
  if (!d) d = new Honeypot({ Guild: guild.id });
  d.Channel = ch.id; d.Action = action; d.Enabled = true; await d.save();
  return ch;
}
async function setupVerify(guild) {
  let d = await Verify.findOne({ Guild: guild.id }).exec();
  let role = d?.UnverifiedRole ? guild.roles.cache.get(d.UnverifiedRole) : null;
  if (!role) role = await guild.roles.create({ name: "Unverified", color: 0x747f8d, reason: "LightCore verification setup" });
  let ch = d?.Channel ? guild.channels.cache.get(d.Channel) : null;
  if (!ch) ch = await guild.channels.create({ name: "verify", type: Discord.ChannelType.GuildText, reason: "LightCore verification setup", permissionOverwrites: [
    { id: guild.roles.everyone.id, deny: [Discord.PermissionFlagsBits.ViewChannel] },
    { id: role.id, allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages, Discord.PermissionFlagsBits.ReadMessageHistory] },
    { id: guild.client.user.id, allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages, Discord.PermissionFlagsBits.ReadMessageHistory] },
  ] });
  await ch.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => {});
  await ch.permissionOverwrites.edit(role, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
  for (const c of guild.channels.cache.values()) if (c.id !== ch.id && c.permissionOverwrites?.edit) await c.permissionOverwrites.edit(role, { ViewChannel: false, SendMessages: false }).catch(() => {});
  if (!d) d = new Verify({ Guild: guild.id });
  d.Channel = ch.id; d.UnverifiedRole = role.id; d.AutoSetup = true; d.Enabled = true; await d.save();
  const row = new Discord.ActionRowBuilder().addComponents(new Discord.ButtonBuilder().setCustomId("lc_verify").setLabel("Verify").setEmoji("✅").setStyle(Discord.ButtonStyle.Success));
  const recent = await ch.messages.fetch({ limit: 20 }).catch(() => null);
  if (!recent?.some((m) => m.author.id === guild.client.user.id && m.components?.some((r) => r.components?.some((b) => b.customId === "lc_verify")))) await ch.send({ embeds: [new Discord.EmbedBuilder().setTitle("🛡️ Server Verification").setDescription("Click **Verify** to unlock the server channels.").setColor(0x5865f2)], components: [row] }).catch(() => {});
  return { role, channel: ch };
}
async function verify(interaction) {
  const d = await Verify.findOne({ Guild: interaction.guild.id, Enabled: true }).lean().exec();
  if (!d?.UnverifiedRole) return interaction.reply({ content: "❌ Verification is not configured.", flags: Discord.MessageFlags.Ephemeral });
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return interaction.reply({ content: "❌ Member record unavailable.", flags: Discord.MessageFlags.Ephemeral });
  if (member.roles.cache.has(d.UnverifiedRole)) await member.roles.remove(d.UnverifiedRole, "LightCore verification").catch(() => {});
  const ok = !member.roles.cache.has(d.UnverifiedRole);
  await interaction.reply({ content: ok ? "✅ You are verified. Server access unlocked." : "❌ I couldn't remove the Unverified role.", flags: Discord.MessageFlags.Ephemeral });
  if (ok) await modLog(interaction.guild, "Member verified", [["User", `${interaction.user} (${interaction.user.tag})`]], 0x57f287);
}
async function automod(message) {
  if (!message.guild || message.author.bot || !message.member || isMod(message.member)) return;
  const c = await config(message.guild.id).catch(() => null); if (!c) return;
  const text = message.content || "";
  const letters = text.match(/[A-Za-z]/g) || [], upper = text.match(/[A-Z]/g) || [];
  const caps = letters.length ? upper.length / letters.length * 100 : 0;
  const mentions = message.mentions.users.size + message.mentions.roles.size;
  const b = await Blacklist.findOne({ Guild: message.guild.id }).lean().exec().catch(() => null);
  const bannedWord = b?.Words?.some((w) => w && text.toLowerCase().includes(String(w).toLowerCase()));
  const key = `${message.guild.id}:${message.author.id}`, now = Date.now(), window = Number(c.SpamWindow || 10000);
  const times = (spam.get(key) || []).filter((t) => now - t <= window); times.push(now); if (times.length > 1) spam.set(key, times); else spam.delete(key);
  let reason = null;
  if (c.AntiInvite && INVITE.test(text)) reason = "Discord invite link";
  else if (c.AntiLinks && URL.test(text) && !INVITE.test(text)) reason = "Link filtering";
  else if (bannedWord) reason = "Banned word";
  else if (mentions >= Number(c.MassMentionLimit || 5)) reason = `Mass mentions (${mentions})`;
  else if (c.AntiCaps && letters.length >= 8 && caps >= Number(c.CapsPercentage || 70)) reason = `Excessive caps (${Math.round(caps)}%)`;
  else if (c.AntiSpam && times.length >= Number(c.SpamLimit || 5)) reason = `Spam (${times.length} messages)`;
  if (!reason) return;
  await message.delete().catch(() => {});
  await message.channel.send(card("⚠️・AutoMod", `${message.author}, your message was removed.\n**Reason:** ${reason}`, 0xed4245)).then((m) => setTimeout(() => m.delete().catch(() => {}), 6000)).catch(() => {});
  await modLog(message.guild, "AutoMod action", [["User", `${message.author} (${message.author.tag})`], ["Channel", `${message.channel}`], ["Reason", reason], ["Message", text || "None"]]);
}
async function notifierCheck(client) {
  const rows = await Notifier.find({ Enabled: true }).lean().exec().catch(() => []);
  for (const row of rows) try {
    const video = await latest(row.YouTubeChannelId);
    if (!video?.id || video.id === row.LastVideoId) continue;
    const guild = client.guilds.cache.get(row.Guild), ch = guild?.channels.cache.get(row.Channel);
    await Notifier.updateOne({ _id: row._id }, { $set: { LastVideoId: video.id, LastCheckedAt: new Date() } }).exec();
    if (ch?.isTextBased?.()) await ch.send({ embeds: [new Discord.EmbedBuilder().setTitle("📺・New YouTube video").setDescription(`**${video.title}**\nhttps://youtu.be/${video.id}`).setColor(0xff0000).setFooter({ text: video.author }).setTimestamp()] }).catch(() => {});
  } catch (e) { await Notifier.updateOne({ _id: row._id }, { $set: { LastCheckedAt: new Date() } }).exec().catch(() => {}); console.error(`LightCore notifier error: ${e.message}`); }
}
async function prefix(client, message) {
  const p = client.runtime?.prefixByGuild?.get(message.guild.id) || ".";
  if (!message.content.startsWith(p)) return false;
  const a = message.content.slice(p.length).trim().split(/\s+/); if (!a[0]) return false;
  const root = a.shift().toLowerCase(), sub = a.shift()?.toLowerCase();
  if (root === "honeypot") {
    if (!isAdmin(message.member)) { await message.channel.send(card("❌・Permission denied", "Administrator permission is required.", 0xed4245)); return true; }
    try {
      if (sub === "setup") { const ch = await setupHoney(message.guild, a[0]?.toLowerCase() || "ban"); await message.channel.send(card("🍯・Honeypot enabled", `Hidden channel: ${ch}\nAction: **${a[0]?.toLowerCase() || "ban"}**`, 0x57f287)); return true; }
      if (["ban", "kick"].includes(sub)) { await Honeypot.findOneAndUpdate({ Guild: message.guild.id }, { $set: { Action: sub, Enabled: true } }, { upsert: true }); await message.channel.send(card("🍯・Honeypot action updated", `Action: **${sub}**`, 0x57f287)); return true; }
      if (sub === "off") { await Honeypot.findOneAndUpdate({ Guild: message.guild.id }, { $set: { Enabled: false } }, { upsert: true }); await message.channel.send(card("🍯・Honeypot disabled", "Enforcement disabled.", 0x57f287)); return true; }
    } catch (e) { await message.channel.send(card("❌・Honeypot error", e.message, 0xed4245)); return true; }
  }
  if (root === "verify" && sub === "setup") {
    if (!isAdmin(message.member)) { await message.channel.send(card("❌・Permission denied", "Administrator permission is required.", 0xed4245)); return true; }
    try { const x = await setupVerify(message.guild); await message.channel.send(card("🛡️・Verification ready", `Unverified role: ${x.role}\nVerification channel: ${x.channel}`, 0x57f287)); } catch (e) { await message.channel.send(card("❌・Verification setup failed", e.message, 0xed4245)); }
    return true;
  }
  if (root === "modlogs") {
    if (!isAdmin(message.member)) { await message.channel.send(card("❌・Permission denied", "Administrator permission is required.", 0xed4245)); return true; }
    if (sub === "set") { const ch = channel(message.guild, a[0]); if (!ch?.isTextBased?.()) { await message.channel.send(card("❌・Invalid channel", "Use `.modlogs set #channel`.", 0xed4245)); return true; } await ModLogs.findOneAndUpdate({ Guild: message.guild.id }, { $set: { Channel: ch.id, Enabled: true } }, { upsert: true }); await message.channel.send(card("📝・Mod logs enabled", `Logs will be sent to ${ch}.`, 0x57f287)); return true; }
    if (sub === "off") { await ModLogs.findOneAndUpdate({ Guild: message.guild.id }, { $set: { Enabled: false } }, { upsert: true }); await message.channel.send(card("📝・Mod logs disabled", "Moderation logs are disabled.", 0x57f287)); return true; }
  }
  if (root === "notifier") {
    if (!isAdmin(message.member)) { await message.channel.send(card("❌・Permission denied", "Administrator permission is required.", 0xed4245)); return true; }
    try {
      if (sub === "add") { const ch = channel(message.guild, a[1]); if (!a[0] || !ch?.isTextBased?.()) { await message.channel.send(card("❌・Invalid notifier", "Use `.notifier add <youtube_url> <#channel>`.", 0xed4245)); return true; } const id = await ytChannel(a[0]), video = await latest(id); await Notifier.findOneAndUpdate({ Guild: message.guild.id, YouTubeChannelId: id }, { $set: { YouTubeUrl: a[0], Channel: ch.id, Enabled: true, LastVideoId: video?.id || null, LastCheckedAt: new Date() } }, { upsert: true }); await message.channel.send(card("📺・Notifier added", `New uploads will be announced in ${ch}.`, 0x57f287)); return true; }
      if (sub === "remove") { const id = await ytChannel(a[0]); const r = await Notifier.deleteOne({ Guild: message.guild.id, YouTubeChannelId: id }); await message.channel.send(card("📺・Notifier removed", r.deletedCount ? "Notifier removed." : "No matching notifier was found.", 0x57f287)); return true; }
      if (sub === "list") { const rows = await Notifier.find({ Guild: message.guild.id, Enabled: true }).lean().exec(); await message.channel.send(card("📺・Active YouTube notifiers", rows.length ? rows.map((x, i) => `**${i + 1}.** ${x.YouTubeUrl} → <#${x.Channel}>`).join("\n") : "No active YouTube notifiers.")); return true; }
    } catch (e) { await message.channel.send(card("❌・Notifier error", e.message, 0xed4245)); return true; }
  }
  if (root === "automod" && sub === "config") {
    if (!isMod(message.member)) { await message.channel.send(card("❌・Permission denied", "Manage Messages permission is required.", 0xed4245)); return true; }
    const type = a[0]?.toLowerCase(), value = Number(a[1]), seconds = Number(a[2]);
    let update = null;
    if (type === "spam" && Number.isInteger(value) && value >= 2 && value <= 20 && Number.isInteger(seconds) && seconds >= 2 && seconds <= 60) update = { AntiSpam: true, SpamLimit: value, SpamWindow: seconds * 1000 };
    else if (type === "spam-off") update = { AntiSpam: false };
    else if (type === "caps" && value >= 50 && value <= 100) update = { AntiCaps: true, CapsPercentage: value };
    else if (type === "caps-off") update = { AntiCaps: false };
    else if (type === "mentions" && Number.isInteger(value) && value >= 2 && value <= 20) update = { MassMentionLimit: value };
    else if (type === "invite" && ["on", "off"].includes(a[1]?.toLowerCase())) update = { AntiInvite: a[1].toLowerCase() === "on" };
    else if (type === "links" && ["on", "off"].includes(a[1]?.toLowerCase())) update = { AntiLinks: a[1].toLowerCase() === "on" };
    else { await message.channel.send(card("❌・Invalid setting", "Use spam <messages> <seconds>, spam-off, caps <percent>, caps-off, mentions <limit>, invite on|off, or links on|off.", 0xed4245)); return true; }
    await config(message.guild.id, update); await message.channel.send(card("🛡️・AutoMod updated", `Updated **${type}** successfully.`, 0x57f287)); return true;
  }
  return false;
}

module.exports = async (client) => {
  client.runtime = client.runtime || {};
  client.runtime.prefixByGuild = client.runtime.prefixByGuild || new Map();
  client.on(Discord.Events.GuildMemberAdd, async (member) => { try { const d = await Verify.findOne({ Guild: member.guild.id, Enabled: true }).lean().exec(); if (d?.UnverifiedRole) await member.roles.add(d.UnverifiedRole, "LightCore verification").catch(() => {}); } catch (e) { console.error("LightCore verification join:", e); } });
  client.on(Discord.Events.InteractionCreate, async (i) => { try { if (i.isButton?.() && i.customId === "lc_verify") return verify(i); if (i.isChatInputCommand?.() && MOD_COMMANDS.has(i.commandName)) { const u = i.options.getUser?.("user") || i.options.getUser?.("member") || i.options.getUser?.("target"); setTimeout(() => i.guild && modLog(i.guild, `${i.commandName} command`, [["Moderator", `${i.user} (${i.user.tag})`], ["Target", u ? `${u} (${u.tag})` : "Not available"]]), 300); } } catch (e) { console.error("LightCore security interaction:", e); } });
  client.on(Discord.Events.MessageCreate, async (m) => { try { if (!m.guild || m.author.bot) return; const c = await config(m.guild.id).catch(() => null); if (c?.Prefix) client.runtime.prefixByGuild.set(m.guild.id, c.Prefix); if (await prefix(client, m)) return; const h = await Honeypot.findOne({ Guild: m.guild.id, Enabled: true }).lean().exec().catch(() => null); if (h?.Channel === m.channel.id) { if (h.Action === "kick") await m.member?.kick("LightCore honeypot triggered").catch(() => {}); else await m.member?.ban({ reason: "LightCore honeypot triggered", deleteMessageSeconds: 86400 }).catch(() => {}); await modLog(m.guild, "Honeypot triggered", [["User", `${m.author} (${m.author.tag})`], ["Action", h.Action], ["Channel", `${m.channel}`]]); return; } await automod(m); } catch (e) { console.error("LightCore Part2 message:", e); } });
  client.on(Discord.Events.MessageUpdate, async (oldM, newM) => { try { if (newM.guild && !newM.author?.bot && oldM.content !== newM.content) { await automod(newM); await modLog(newM.guild, "Message edited", [["User", `${newM.author}`], ["Channel", `${newM.channel}`], ["Before", oldM.content || "Unavailable"], ["After", newM.content || "Unavailable"]], 0xfee75c); } } catch (e) { console.error("LightCore edit logger:", e); } });
  client.on(Discord.Events.MessageDelete, async (m) => { try { if (m.guild && !m.author?.bot) await modLog(m.guild, "Message deleted", [["User", m.author ? `${m.author}` : "Unknown"], ["Channel", `${m.channel}`], ["Content", m.content || "Unavailable"]]); } catch (e) { console.error("LightCore delete logger:", e); } });
  client.on(Discord.Events.GuildBanAdd, async (b) => { try { const a = await b.guild.fetchAuditLogs({ type: Discord.AuditLogEvent.MemberBanAdd, limit: 5 }).catch(() => null); const x = a?.entries?.find((e) => e.target?.id === b.user.id); await modLog(b.guild, "Member banned", [["User", `${b.user} (${b.user.tag})`], ["Moderator", x?.executor || "Unknown"], ["Reason", x?.reason || "Not provided"]]); } catch (e) { console.error("LightCore ban logger:", e); } });
  client.on(Discord.Events.GuildMemberRemove, async (m) => { try { const a = await m.guild.fetchAuditLogs({ type: Discord.AuditLogEvent.MemberKick, limit: 5 }).catch(() => null); const x = a?.entries?.find((e) => e.target?.id === m.id && Date.now() - e.createdTimestamp < 10000); if (x) await modLog(m.guild, "Member kicked", [["User", `${m.user} (${m.user.tag})`], ["Moderator", x.executor || "Unknown"], ["Reason", x.reason || "Not provided"]]); } catch (e) { console.error("LightCore kick logger:", e); } });
  client.on(Discord.Events.GuildMemberUpdate, async (oldM, newM) => { try { if (oldM.communicationDisabledUntilTimestamp !== newM.communicationDisabledUntilTimestamp) await modLog(newM.guild, newM.communicationDisabledUntilTimestamp > Date.now() ? "Member timed out" : "Member timeout removed", [["User", `${newM.user}`], ["Until", newM.communicationDisabledUntilTimestamp ? `<t:${Math.floor(newM.communicationDisabledUntilTimestamp / 1000)}:R>` : "Cleared"]]); } catch (e) { console.error("LightCore timeout logger:", e); } });
  const timer = setInterval(() => notifierCheck(client).catch((e) => console.error("LightCore notifier loop:", e)), 120000); timer.unref?.();
  client.once(Discord.Events.ClientReady, () => notifierCheck(client).catch(() => {}));
};
