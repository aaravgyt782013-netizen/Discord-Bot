const Economy = require("../../database/models/economy");
const Profile = require("../../database/models/economyProfile");

const QUESTS = [
  { key: "profile", title: "Know Yourself", text: "Open your LightCore profile.", reward: 150, xp: 35 },
  { key: "boss", title: "Guardian Challenge", text: "Complete a boss battle.", reward: 250, xp: 55 },
  { key: "work", title: "Clock In", text: "Use the work command and earn some money.", reward: 200, xp: 45 },
  { key: "explore", title: "Explorer", text: "Use three different economy commands today.", reward: 300, xp: 70 },
];

/** @type {import("../../typings.d").Command} */
module.exports = async (client, interaction) => {
  const profile = await Profile.findOneAndUpdate(
    { User: interaction.user.id },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const today = new Date().toISOString().slice(0, 10);
  const index = Math.abs(interaction.user.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % QUESTS.length;
  const quest = QUESTS[index];
  const claimedToday = profile.Quest?.key === `${today}:${quest.key}`;

  if (interaction.options.getString("action") === "claim") {
    if (claimedToday) return client.errNormal({ error: "You've already claimed today's quest reward.", type: "editreply" }, interaction);

    await Economy.findOneAndUpdate(
      { User: interaction.user.id },
      { $inc: { Money: quest.reward } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    profile.Quest = { key: `${today}:${quest.key}`, claimedAt: new Date() };
    profile.XP = (profile.XP || 0) + quest.xp;
    await profile.save();

    return client.succNormal({
      text: `Quest completed: **${quest.title}**\n💰 **+$${quest.reward}**\n✨ **+${quest.xp} XP**`,
      type: "editreply",
    }, interaction);
  }

  client.embed({
    title: "📜・Daily Quest",
    desc: `**${quest.title}**\n${quest.text}`,
    fields: [
      { name: "💰┆Reward", value: `$${quest.reward}`, inline: true },
      { name: "✨┆XP", value: `+${quest.xp}`, inline: true },
      { name: "📅┆Status", value: claimedToday ? "Claimed" : "Available", inline: true },
    ],
    type: "editreply",
  }, interaction);
};
