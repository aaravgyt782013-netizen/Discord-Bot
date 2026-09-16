const Discord = require("discord.js");
const Functions = require("../../database/models/functions");
const Verify = require("../../database/models/verify");
const Honeypot = require("../../database/models/honeypot");
const Notifier = require("../../database/models/notifier");
const ModLogs = require("../../database/models/modlogs");
const Blacklist = require("../../database/models/blacklist");
const fetch = require("node-fetch");

const spam = new Map();
const admin = m => !!m?.permissions?.has(Discord.PermissionsBitField.Flags.Administrator);
const staff = m => !!m?.permissions?.has(Discord.PermissionsBitField.Flags.ManageMessages);
const msg = (title, text, color = 0x5865f2) => ({ embeds: [new Discord.EmbedBuilder().setTitle(title).setDescription(text).setColor(color).setTimestamp()] });

async function cfg(id, update = {}) {
  return Functions.findOneAndUpdate({ Guild: id }, { $set: update, $setOnInsert: { Guild: id, Prefix: "." } }, { upsert: true, new: true }).exec();
}
async function log(guild, title, fields, color = 0xed4245) {
  const c = await ModLogs.findOne({ Guild: guild.id }).lean().exec().catch(() => null);
  const ch = c?.Enabled && c.Channel ? guild.channels.cache.get(c.Channel) : null;
  if (!ch?.isTextBased?.()) return;
  await ch.send({ embeds: [new Discord.EmbedBuilder().setTitle(`🛡️・${title}`).setColor(color).setTimestamp().addFields(fields.map(x => ({ name: x[0], value: String(x[1] || "None").slice(0, 1024), inline: !!x[2] })))] }).catch(() => {});
}
async function channelId(url) {
  const s = String(url || "").trim();
  const direct = s.match(/\/channel\/(UC[a-zA-Z0-9_-]{20,})/);
  if (direct) return direct[1];
  if (/^UC[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  const r = await fetch(s, { headers: { "user-agent": "LightCore notifier" } });
  if (!r.ok) throw new Error(`YouTube HTTP ${r.status}`);
  return (await r.text()).match(/"channelId":"(UC[a-zA-Z0-9_-]{20,})"/)?.[1] || null;
}
async function latest(id) {
  const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`, { headers: { "user-agent": "LightCore notifier" } });
  if (!r.ok) throw new Error(`YouTube RSS HTTP ${r.status}`);
  const x = (await r.text()).match(/<entry>([\s\S]*?)<\/entry>/)?.[1];
  if (!x) return null;
  return { id: x.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1], title: x.match(/<media:title>([\s\S]*?)<\/media:title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "New video", author: x.match(/<name>([^<]+)<\/name>/)?.[1] || "YouTube" };
}
async function setupHoney(guild, action) {
  if (!['ban','kick'].includes(action)) throw new Error("Action must be ban or kick.");
  let d = await Honeypot.findOne({ Guild: guild.id }).exec();
  let ch = d?.Channel && guild.channels.cache.get(d.Channel);
  if (!ch) ch = await guild.channels.create({ name: "honeypot", type: Discord.ChannelType.GuildText, reason: "LightCore honeypot setup", permissionOverwrites: [
    { id: guild.roles.everyone.id, deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages] },
    { id: guild.client.user.id, allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages, Discord.PermissionFlagsBits.ReadMessageHistory] },
  ] });
  d ||= new Honeypot({ Guild: guild.id }); d.Channel = ch.id; d.Action = action; d.Enabled = true; await d.save(); return ch;
}
async function setupVerify(guild) {
  let d = await Verify.findOne({ Guild: guild.id }).exec();
  let role = d?.UnverifiedRole && guild.roles.cache.get(d.UnverifiedRole);
  if (!role) role = await guild.roles.create({ name: "Unverified", color: 0x747f8d, reason: "LightCore verification setup" });
  let ch = d?.Channel && guild.channels.cache.get(d.Channel);
  if (!ch) ch = await guild.channels.create({ name: "verify", type: Discord.ChannelType.GuildText, reason: "LightCore verification setup", permissionOverwrites: [
    { id: guild.roles.everyone.id, deny: [Discord.PermissionFlagsBits.ViewChannel] },
    { id: role.id, allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages, Discord.PermissionFlagsBits.ReadMessageHistory] },
    { id: guild.client.user.id, allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages, Discord.PermissionFlagsBits.ReadMessageHistory] },
  ] });
  else { await ch.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => {}); await ch.permissionOverwrites.edit(role, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {}); }
  for (const c of guild.channels.cache.values()) if (c.id !== ch.id && c.permissionOverwrites?.edit) await c.permissionOverwrites.edit(role, { ViewChannel: false, SendMessages: false }).catch(() => {});
  d ||= new Verify({ Guild: guild.id }); d.Channel = ch.id; d.UnverifiedRole = role.id; d.AutoSetup = true; d.Enabled = true; await d.save();
  const row = new Discord.ActionRowBuilder().addComponents(new Discord.ButtonBuilder().setCustomId("lc_verify").setLabel("Verify").setEmoji("✅").setStyle(Discord.ButtonStyle.Success));
  const messages = await ch.messages.fetch({ limit: 20 }).catch(() => null);
  if (!messages?.some(m => m.author.id === guild.client.user.id && m.components.some(r => r.components.some(x => x.customId === "lc_verify")))) await ch.send({ embeds: [new Discord.EmbedBuilder().setTitle("🛡️ Server Verification").setDescription("Click **Verify** to access the server.").setColor(0x5865f2)], components: [row] }).catch(() => {});
  return [role, ch];
}
async function automod(message) {
  if (!message.guild || message.author.bot || !message.member || staff(message.member)) return;
  const c = await cfg(message.guild.id).catch(() => null); if (!c) return;
  const text = message.content || "", letters = text.match(/[A-Za-z]/g) || [], upper = text.match(/[A-Z]/g) || [];
  const caps = letters.length ? upper.length / letters.length * 100 : 0, mentions = message.mentions.users.size + message.mentions.roles.size;
  const bl = await Blacklist.findOne({ Guild: message.guild.id }).lean().exec().catch(() => null);
  const banned = bl?.Words?.some(w => w && text.toLowerCase().includes(String(w).toLowerCase()));
  const key = `${message.guild.id}:${message.author.id}`, now = Date.now(), window = Number(c.SpamWindow || 10000), list = (spam.get(key) || []).filter(t => now - t <= window); list.push(now); spam.set(key, list);
  let reason = null;
  if (c.AntiCaps && letters.length >= 8 && caps >= Number(c.CapsPercentage || 70)) reason = `Excessive caps (${Math.round(caps)}%)`;
  else if (mentions >= Number(c.MassMentionLimit || 5)) reason = `Mass mentions (${mentions})`;
  else if (banned) reason = "Banned word";
  else if (c.AntiSpam && list.length >= Number(c.SpamLimit || 5)) reason = `Spam (${list.length} messages)`;
  if (!reason) return;
  await message.delete().catch(() => {});
  await message.channel.send(msg("⚠️・AutoMod", `${message.author}, your message was removed.\n**Reason:** ${reason}`, 0xed4245)).catch(() => {});
  await log(message.guild, "AutoMod", [["User", `${message.author} (${message.author.tag})`], ["Channel", `${message.channel}`], ["Reason", reason], ["Message", text || "None"]]);
}
async function prefix(client, message) {
  if (!message.guild) return false;
  const p = client.runtime?.prefixByGuild?.get(message.guild.id) || ".";
  if (!message.content.startsWith(p)) return false;
  const a = message.content.slice(p.length).trim().split(/\s+/); if (!a[0]) return false;
  const root = a.shift().toLowerCase(), sub = a.shift()?.toLowerCase(), args = a;
  if (root === "honeypot") {
    if (!admin(message.member)) { await message.channel.send(msg("❌・Permission denied", "Administrator permission is required.", 0xed4245)); return true; }
    if (sub === "setup") { const ch = await setupHoney(message.guild, args[0] || "ban"); await message.channel.send(msg("🍯・Honeypot enabled", `Hidden channel: ${ch}\nAction: **${args[0] || "ban"}**`, 0x57f287)); return true; }
    if (sub === "off") { await Honeypot.findOneAndUpdate({ Guild: message.guild.id }, { $set: { Enabled: false } }, { upsert: true }); await message.channel.send(msg("🍯・Honeypot disabled", "The honeypot is disabled.")); return true; }
  }
  if (root === "verify" && sub === "setup") { if (!admin(message.member)) { await message.channel.send(msg("❌・Permission denied", "Administrator permission is required.", 0xed4245)); return true; } const [r,c] = await setupVerify(message.guild); await message.channel.send(msg("🛡️・Verification ready", `Unverified role: ${r}\nVerification channel: ${c}`, 0x57f287)); return true; }
  if (root === "modlogs") {
    if (!admin(message.member)) { await message.channel.send(msg("❌・Permission denied", "Administrator permission is required.", 0xed4245)); return true; }
    if (sub === "set") { const c = message.guild.channels.cache.get(args[0]?.replace(/[<#>]/g, "")); if (!c?.isTextBased?.()) { await message.channel.send(msg("❌・Invalid channel", "Mention a text channel.", 0xed4245)); return true; } await ModLogs.findOneAndUpdate({ Guild: message.guild.id }, { $set: { Channel: c.id, Enabled: true } }, { upsert: true }); await message.channel.send(msg("📝・Mod logs enabled", `Logging to ${c}.`, 0x57f287)); return true; }
    if (sub === "off") { await ModLogs.findOneAndUpdate({ Guild: message.guild.id }, { $set: { Enabled: false } }, { upsert: true }); await message.channel.send(msg("📝・Mod logs disabled", "Moderation logging is disabled.")); return true; }
  }
  if (root === "notifier") {
    if (!admin(message.member)) { await message.channel.send(msg("❌・Permission denied", "Administrator permission is required.", 0xed4245)); return true; }
    if (sub === "add") { const c = message.guild.channels.cache.get(args[1]?.replace(/[<#>]/g, "")); if (!args[0] || !c?.isTextBased?.()) { await message.channel.send(msg("❌・Invalid notifier", "Use `.notifier add <youtube_url> <#channel>`.")); return true; } const id = await channelId(args[0]); if (!id) throw new Error("Could not resolve YouTube channel."); const v = await latest(id).catch(() => null); await Notifier.findOneAndUpdate({ Guild: message.guild.id, YouTubeChannelId: id }, { $set: { YouTubeUrl: args[0], Channel: c.id, Enabled: true, LastVideoId: v?.id || null } }, { upsert: true }); await message.channel.send(msg("📺・Notifier added", `New uploads from ${args[0]} will be posted in ${c}.`, 0x57f287)); return true; }
    if (sub === "remove") { const id = await channelId(args[0]); if (!id) { await message.channel.send(msg("❌・Invalid YouTube channel", "Provide a valid YouTube channel URL.", 0xed4245)); return true; } await Notifier.deleteOne({ Guild: message.guild.id, YouTubeChannelId: id }); await message.channel.send(msg("📺・Notifier removed", "Notifier removed.", 0x57f287)); return true; }
    if (sub === "list") { const rows = await Notifier.find({ Guild: message.guild.id, Enabled: true }).lean().exec(); await message.channel.send(msg("📺・Active notifiers", rows.length ? rows.map((n,i) => `**${i+1}.** ${n.YouTubeUrl} → <#${n.Channel}>`).join("\n") : "No active notifiers.")); return true; }
  }
  if (root === "automod" && sub === "config") {
    if (!staff(message.member)) { await message.channel.send(msg("❌・Permission denied", "Manage Messages permission is required.", 0xed4245)); return true; }
    const t=args[0]?.toLowerCase(), n=Number(args[1]), s=Number(args[2]), u={};
    if(t==='spam'&&Number.isInteger(n)&&n>=2&&n<=20&&s>=2&&s<=60){u.SpamLimit=n;u.SpamWindow=s*1000;}
    else if(t==='caps'&&n>=50&&n<=100){u.CapsPercentage=n;u.AntiCaps=true;}
    else if(t==='caps-off'){u.AntiCaps=false;}
    else if(t==='mentions'&&Number.isInteger(n)&&n>=2&&n<=20){u.MassMentionLimit=n;}
    else { await message.channel.send(msg("❌・Invalid setting", "Use `spam <messages> <seconds>`, `caps <percent>`, `caps-off`, or `mentions <limit>.", 0xed4245)); return true; }
    await cfg(message.guild.id,u); await message.channel.send(msg("🛡️・AutoMod updated", `Updated **${t}** successfully.`,0x57f287)); return true;
  }
  return false;
}
module.exports = async client => {
  client.runtime = client.runtime || {}; client.runtime.prefixByGuild = client.runtime.prefixByGuild || new Map();
  client.on(Discord.Events.MessageCreate, async m => { try { if (!m.guild || m.author.bot) return; const c=await cfg(m.guild.id).catch(()=>null); if(c?.Prefix) client.runtime.prefixByGuild.set(m.guild.id,c.Prefix); if(await prefix(client,m)) return; const h=await Honeypot.findOne({Guild:m.guild.id,Enabled:true}).lean().exec().catch(()=>null); if(h?.Channel===m.channel.id&&!staff(m.member)){if(h.Action==='kick')await m.member.kick('LightCore honeypot triggered').catch(()=>{});else await m.member.ban({reason:'LightCore honeypot triggered',deleteMessageSeconds:86400}).catch(()=>{});await log(m.guild,'Honeypot triggered',[["User",`${m.author}`],["Action",h.Action],["Channel",`${m.channel}`]]);return;} await automod(m); } catch(e){ console.error('Part2 message handler:',e); } });
  client.on(Discord.Events.MessageUpdate, async (o,n) => { try { if(n.guild&&!n.author?.bot&&n.member&&o.content!==n.content){await automod(n);await log(n.guild,'Message edited',[["User",`${n.author}`],["Channel",`${n.channel}`],["Before",o.content||'None'],["After",n.content||'None']],0xfee75c);} } catch(e){console.error('Part2 message update:',e);} });
  client.on(Discord.Events.MessageDelete, async m => { try { if(m.guild&&!m.author?.bot) await log(m.guild,'Message deleted',[["User",m.author?`${m.author}`:'Unknown'],["Channel",`${m.channel}`],["Content",m.content||'Unavailable']]); } catch(e){console.error('Part2 delete log:',e);} });
  client.on(Discord.Events.GuildBanAdd, async b => { try {const l=await b.guild.fetchAuditLogs({type:Discord.AuditLogEvent.MemberBanAdd,limit:5}).catch(()=>null),e=l?.entries.find(x=>x.target?.id===b.user.id&&Date.now()-x.createdTimestamp<15000);await log(b.guild,'Member banned',[["User",`${b.user}`],["Moderator",e?.executor||'Unknown'],["Reason",e?.reason||'None']]);}catch(e){console.error('Part2 ban log:',e);} });
  client.on(Discord.Events.GuildMemberRemove, async m => { try {const l=await m.guild.fetchAuditLogs({type:Discord.AuditLogEvent.MemberKick,limit:5}).catch(()=>null),e=l?.entries.find(x=>x.target?.id===m.id&&Date.now()-x.createdTimestamp<15000);if(e)await log(m.guild,'Member kicked',[["User",`${m.user}`],["Moderator",e.executor],["Reason",e.reason||'None']]);}catch(e){console.error('Part2 kick log:',e);} });
  client.on(Discord.Events.GuildMemberUpdate, async (o,n) => { try {const a=o.communicationDisabledUntilTimestamp||0,b=n.communicationDisabledUntilTimestamp||0;if(a!==b)await log(n.guild,b>Date.now()?'Member timed out':'Member timeout removed',[["User",`${n.user}`],["Until",b>Date.now()?`<t:${Math.floor(b/1000)}:F>`:'Cleared']]);}catch(e){console.error('Part2 timeout log:',e);} });
  client.on('warnAdd', async (u,mod,reason) => { try {const g=client.guilds.cache.find(x=>x.members.cache.has(u.id));if(g)await log(g,'Member warned',[["User",`${u}`],["Moderator",`${mod}`],["Reason",reason||'None']]);}catch(e){console.error('Part2 warn log:',e);} });
  client.on(Discord.Events.GuildMemberAdd, async m => { try {const d=await Verify.findOne({Guild:m.guild.id,Enabled:true}).lean().exec();if(d?.AutoSetup&&!m.user.bot){const r=m.guild.roles.cache.get(d.UnverifiedRole);if(r)await m.roles.add(r,'LightCore verification').catch(()=>{});}}catch(e){console.error('Part2 verification join:',e);} });
  client.on(Discord.Events.InteractionCreate, async i => { try { if(i.isButton?.()&&i.customId==='lc_verify'){const d=await Verify.findOne({Guild:i.guild.id,Enabled:true}).lean().exec(),r=i.guild.roles.cache.get(d?.UnverifiedRole);if(!r)return i.reply({content:'Verification is not configured here.',flags:Discord.MessageFlags.Ephemeral});if(!i.member.roles.cache.has(r.id))return i.reply({content:'You are already verified.',flags:Discord.MessageFlags.Ephemeral});await i.member.roles.remove(r,'LightCore verification');return i.reply({content:'✅ You are verified. Welcome!',flags:Discord.MessageFlags.Ephemeral});} if(!i.isChatInputCommand?.())return; if(i.commandName==='honeypot'){if(!admin(i.member))return i.reply({content:'Administrator permission is required.',flags:Discord.MessageFlags.Ephemeral});if(i.options.getSubcommand()==='setup'){const c=await setupHoney(i.guild,i.options.getString('action')||'ban');return i.reply({content:`🍯 Honeypot enabled in ${c}.`,flags:Discord.MessageFlags.Ephemeral});}await Honeypot.findOneAndUpdate({Guild:i.guild.id},{$set:{Enabled:false}},{upsert:true});return i.reply({content:'🍯 Honeypot disabled.',flags:Discord.MessageFlags.Ephemeral});} if(i.commandName==='verify'){if(!admin(i.member))return i.reply({content:'Administrator permission is required.',flags:Discord.MessageFlags.Ephemeral});const [r,c]=await setupVerify(i.guild);return i.reply({content:`🛡️ Verification ready: ${r} ${c}`,flags:Discord.MessageFlags.Ephemeral});} if(i.commandName==='modlogs'){if(!admin(i.member))return i.reply({content:'Administrator permission is required.',flags:Discord.MessageFlags.Ephemeral});if(i.options.getSubcommand()==='set'){const c=i.options.getChannel('channel');if(!c?.isTextBased?.())return i.reply({content:'Select a text channel.',flags:Discord.MessageFlags.Ephemeral});await ModLogs.findOneAndUpdate({Guild:i.guild.id},{$set:{Channel:c.id,Enabled:true}},{upsert:true});return i.reply({content:`📝 Mod logs enabled in ${c}.`,flags:Discord.MessageFlags.Ephemeral});}await ModLogs.findOneAndUpdate({Guild:i.guild.id},{$set:{Enabled:false}},{upsert:true});return i.reply({content:'📝 Mod logs disabled.',flags:Discord.MessageFlags.Ephemeral});} if(i.commandName==='notifier'){if(!admin(i.member))return i.reply({content:'Administrator permission is required.',flags:Discord.MessageFlags.Ephemeral});const s=i.options.getSubcommand();if(s==='add'){const u=i.options.getString('youtube_url'),c=i.options.getChannel('channel'),id=await channelId(u).catch(()=>null);if(!id||!c?.isTextBased?.())return i.reply({content:'Invalid YouTube URL or channel.',flags:Discord.MessageFlags.Ephemeral});const v=await latest(id).catch(()=>null);await Notifier.findOneAndUpdate({Guild:i.guild.id,YouTubeChannelId:id},{$set:{YouTubeUrl:u,Channel:c.id,Enabled:true,LastVideoId:v?.id||null}},{upsert:true});return i.reply({content:`📺 Notifier added: ${u} → ${c}`,flags:Discord.MessageFlags.Ephemeral});}if(s==='remove'){const id=await channelId(i.options.getString('youtube_url')).catch(()=>null);if(!id)return i.reply({content:'Invalid YouTube channel.',flags:Discord.MessageFlags.Ephemeral});await Notifier.deleteOne({Guild:i.guild.id,YouTubeChannelId:id});return i.reply({content:'📺 Notifier removed.',flags:Discord.MessageFlags.Ephemeral});}const rows=await Notifier.find({Guild:i.guild.id,Enabled:true}).lean().exec();return i.reply({content:rows.length?rows.map((n,j)=>`${j+1}. ${n.YouTubeUrl} → <#${n.Channel}>`).join('\n'):'No active notifiers.',flags:Discord.MessageFlags.Ephemeral});} if(i.commandName==='automod'&&i.options.getSubcommand?.()==='config'){if(!staff(i.member))return i.reply({content:'Manage Messages permission is required.',flags:Discord.MessageFlags.Ephemeral});const t=i.options.getString('type'),n=i.options.getInteger('value'),s=i.options.getInteger('seconds'),u={};if(t==='spam'&&n>=2&&n<=20&&s>=2&&s<=60){u.SpamLimit=n;u.SpamWindow=s*1000}else if(t==='caps'&&n>=50&&n<=100){u.CapsPercentage=n;u.AntiCaps=true}else if(t==='caps-off'){u.AntiCaps=false}else if(t==='mentions'&&n>=2&&n<=20)u.MassMentionLimit=n;else return i.reply({content:'Invalid AutoMod setting.',flags:Discord.MessageFlags.Ephemeral});await cfg(i.guild.id,u);return i.reply({content:'🛡️ AutoMod configuration updated.',flags:Discord.MessageFlags.Ephemeral});}}catch(e){console.error('Part2 interaction handler:',e);if(!i.replied&&!i.deferred)await i.reply({content:'❌ Something went wrong. Please try again.',flags:Discord.MessageFlags.Ephemeral}).catch(()=>{});}});
  const poll=async()=>{try{for(const n of await Notifier.find({Enabled:true}).lean().exec()){const v=await latest(n.YouTubeChannelId).catch(()=>null);if(!v||v.id===n.LastVideoId)continue;await Notifier.updateOne({_id:n._id},{$set:{LastVideoId:v.id,LastCheckedAt:new Date()}});const g=client.guilds.cache.get(n.Guild),c=g?.channels.cache.get(n.Channel);if(c?.isTextBased?.())await c.send({embeds:[new Discord.EmbedBuilder().setTitle('📺・New YouTube upload').setDescription(`**${v.title}**\nhttps://youtu.be/${v.id}`).addFields({name:'Channel',value:v.author}).setColor(0xff0000).setTimestamp()]}).catch(()=>{});}}catch(e){console.error('YouTube notifier poll:',e);}};await poll();setInterval(poll,120000);
};
