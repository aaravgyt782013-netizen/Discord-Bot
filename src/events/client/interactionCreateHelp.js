const Discord = require("discord.js");

const CATEGORY_ORDER = ["economy","leveling","music","moderation","tickets","fun","utility","automation","admin","other"];
const LABELS = {
  economy:["Economy","💰"], leveling:["Leveling","🆙"], music:["Music","🎵"], moderation:["Moderation","🛡️"], tickets:["Tickets","🎫"],
  fun:["Fun & Games","🎮"], utility:["Utility","🔧"], automation:["Automation","🤖"], admin:["Admin","🛠️"], other:["Other","📦"],
};
const ADMIN_COMMANDS = new Set(["addmoney","removemoney","setmoney","clear","additem","deleteitem","config","reward","rewards","createreward","deletereward","setxp","setlevel","xpboost","levelmessage"]);
function cleanName(name){return String(name||"").toLowerCase().replace(/^[-_.]+/,"");}
function categoryForName(name,parent=""){
  const value=cleanName(name), context=`${cleanName(parent)} ${value}`;
  if(ADMIN_COMMANDS.has(value)||/^(levels?)\s+(config|reward|rewards|deletereward|setxp|setlevel|createreward)$/.test(context))return "admin";
  if(/level|xp|rank|leaderboard/.test(context))return "leveling";
  if(/economy|balance|daily|hourly|weekly|monthly|yearly|work|beg|deposit|withdraw|pay|shop|buy|hunt|battle|fish|pet|quest|boss|present|profile|rob|crime/.test(context))return "economy";
  if(/play|music|song|queue|skip|pause|resume|stop|volume|shuffle|loop|lyrics|radio|bassboost|playing|seek|previous/.test(context))return "music";
  if(/ticket|transcript/.test(context))return "tickets";
  if(/ban|kick|warn|timeout|unban|clearuser|lockdown|lock|unlock|softban|nuke|demote|automod|moderation|honeypot|verify|modlogs/.test(context))return "moderation";
  if(/game|games|trivia|rps|guess|word|8ball|fasttype|snake|wouldyou|press|fun|meme|joke|fact|rate|roast|hug|rickroll|ascii/.test(context))return "fun";
  if(/auto|logging|logs|reaction|custom|reminder|starboard|giveaway|suggestion|message|sticky|announcement|notifier/.test(context))return "automation";
  if(/help|invite|avatar|userinfo|serverinfo|roleinfo|channelinfo|ping|uptime|botinfo|embed|say|translate|weather|afk|birthdays|notepad|images|search|tools|voice|prefix|dcredits/.test(context))return "utility";
  return "other";
}
function normalizeCommandData(command){const data=typeof command?.data?.toJSON==="function"?command.data.toJSON():command?.data;return data?.name?data:null;}
function flattenSlashCommand(data){
  const result=[],root=cleanName(data.name),options=Array.isArray(data.options)?data.options:[];
  if(!options.some(o=>o.type===1||o.type===2)){result.push({name:root,description:data.description||"No description declared in the command file.",parent:""});return result;}
  for(const sub of options.filter(o=>o.type===1||o.type===2)){
    if(sub.type===2&&Array.isArray(sub.options)){
      const nested=sub.options.filter(o=>o.type===1);
      if(nested.length)for(const child of nested)result.push({name:`${root} ${cleanName(sub.name)} ${cleanName(child.name)}`,description:child.description||"No description declared in the command file.",parent:root});
      else result.push({name:`${root} ${cleanName(sub.name)}`,description:sub.description||"No description declared in the command file.",parent:root});
    }else result.push({name:`${root} ${cleanName(sub.name)}`,description:sub.description||"No description declared in the command file.",parent:root});
  } return result;
}
function loadedCommands(client){const seen=new Set(),result=[];for(const command of client.commands?.values?.()||[]){const data=normalizeCommandData(command);if(!data)continue;for(const entry of flattenSlashCommand(data)){if(seen.has(entry.name))continue;seen.add(entry.name);result.push(entry);}}return result;}
function buildCommandLines(client,category,mode,prefix){return loadedCommands(client).filter(e=>categoryForName(e.name,e.parent)===category).sort((a,b)=>a.name.localeCompare(b.name)).map(e=>{const trigger=mode==="prefix"?`${prefix}${e.name}`:`/${e.name}`;return `\`${trigger}\` — ${e.description}`;});}
function buildEmbed(client,mode,category){
  const prefix=client.config.discord.prefix||".",lines=buildCommandLines(client,category,mode,prefix),chunks=[];let chunk="";
  for(const line of lines){const next=chunk?`${chunk}\n${line}`:line;if(next.length>1000){if(chunk)chunks.push(chunk);chunk=line;}else chunk=next;}if(chunk)chunks.push(chunk);
  const fields=chunks.slice(0,24).map((value,index)=>({name:chunks.length>1?`Commands ${index+1}`:"Commands",value,inline:false}));
  if(!fields.length)fields.push({name:"Commands",value:"No commands are currently loaded in this category.",inline:false});
  return new Discord.EmbedBuilder().setTitle(`❓・LightCore ${LABELS[category][0]}`).setDescription(`${mode==="prefix"?`**Prefix:** ${prefix}`:"**Slash:** /"}\n\n${mode==="prefix"?"Every command below is currently available through prefix handling.":"Every command below is currently registered for slash use."}`).addFields(fields).setColor(client.config.colors.normal).setFooter({text:`LightCore • ${lines.length} command${lines.length===1?"":"s"}`});
}
function buildMenu(mode,owner){return new Discord.ActionRowBuilder().addComponents(new Discord.StringSelectMenuBuilder().setCustomId(mode==="prefix"?`lc_phelp:${owner}`:`lc_help:${mode}:${owner}`).setPlaceholder(mode==="prefix"?"Choose a prefix help category":"Choose a LightCore help category").addOptions(CATEGORY_ORDER.map(c=>({label:LABELS[c][0],description:`View ${LABELS[c][0].toLowerCase()} ${mode} commands`,emoji:LABELS[c][1],value:c}))));}
module.exports=async(client,interaction)=>{
  if(!interaction.isStringSelectMenu?.())return;if(!interaction.customId.startsWith("lc_phelp:")&&!interaction.customId.startsWith("lc_help:"))return;
  const p=interaction.customId.split(":"),mode=p[0]==="lc_phelp"?"prefix":p[1],owner=p[0]==="lc_phelp"?p[1]:p[2];
  if(!owner||interaction.user.id!==owner)return interaction.reply({content:"This help menu belongs to another user.",flags:Discord.MessageFlags.Ephemeral});
  const category=interaction.values?.[0];if(!CATEGORY_ORDER.includes(category))return;
  return interaction.update({embeds:[buildEmbed(client,mode,category)],components:[buildMenu(mode,owner)]});
};
