const Economy = require("../../database/models/economy");
const Profile = require("../../database/models/economyProfile");

const BOSSES = [
  { name: "Forest Guardian", emoji: "🌲", hp: 120, reward: 350, xp: 80 },
  { name: "Crystal Golem", emoji: "💎", hp: 180, reward: 550, xp: 120 },
  { name: "Sky Wyrm", emoji: "🐲", hp: 250, reward: 850, xp: 180 },
];

/** @type {import("../../typings.d").Command} */
module.exports = async (client, interaction) => {
  const boss = BOSSES[Math.floor(Math.random() * BOSSES.length)];
  const profile = await Profile.findOneAndUpdate(
    { User: interaction.user.id },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const level = Math.floor(Math.sqrt((profile.XP || 0) / 100)) + 1;
  const damage = 35 + Math.floor(Math.random() * 25) + level * 3;
  const victory = damage >= boss.hp || Math.random() < 0.35;
  const earned = victory ? boss.reward + Math.floor(Math.random() * 100) : Math.floor(boss.reward / 5);
  const xp = victory ? boss.xp : Math.floor(boss.xp / 4);

  await Economy.findOneAndUpdate(
    { User: interaction.user.id },
    { $inc: { Money: earned } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  profile.XP = (profile.XP || 0) + xp;
  await profile.save();

  client.embed({
    title: `${boss.emoji}・${boss.name}`,
    desc: victory
      ? `**Victory!** You defeated the boss.\n\n⚔️ Power: **${damage}**\n💰 Reward: **$${earned}**\n✨ XP: **+${xp}**`
      : `The boss escaped after your attack.\n\n⚔️ Power: **${damage}**\n💰 Consolation reward: **$${earned}**\n✨ XP: **+${xp}**`,
    type: "editreply",
  }, interaction);
};
