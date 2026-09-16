const { PermissionFlagsBits } = require("discord.js");
const levelingService = require("../handlers/games/levelingService");

function hasManageServer(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

function parseMultiplier(value) {
  if (String(value ?? "").toLowerCase() === "off") return 1;
  const multiplier = Number(String(value ?? "").trim().replace(/x$/i, ""));
  if (!Number.isFinite(multiplier) || multiplier < 0.1 || multiplier > 10) return null;
  return multiplier;
}

function resolveMember(guild, value) {
  const raw = String(value || "").trim();
  const id = raw.match(/^<@!?(\d+)>$/)?.[1] || raw.match(/^\d{17,20}$/)?.[0];
  if (id) return guild.members.cache.get(id) || null;
  const lower = raw.toLowerCase();
  return guild.members.cache.find((member) => member.user.username.toLowerCase() === lower || member.displayName.toLowerCase() === lower) || null;
}

module.exports = async (client, interaction) => {
  if (!interaction.guild) return interaction.reply?.({ content: "❌ This command can only be used in a server.", ephemeral: true });
  if (!hasManageServer(interaction)) return interaction.reply?.({ content: "❌ You need **Manage Server** to change XP boosts.", ephemeral: true });

  const target = interaction.options.getString("target");
  const rawMultiplier = interaction.options.getString("multiplier") ?? interaction.options.getNumber?.("multiplier");
  const multiplier = parseMultiplier(rawMultiplier);
  if (!target || multiplier == null) {
    return interaction.reply?.({ content: "❌ Use `.xpboost server 1.5x`, `.xpboost @user 2x`, or `off` to reset a boost.", ephemeral: true });
  }

  const isServer = target.toLowerCase() === "server" || target.toLowerCase() === "global";
  try {
    if (isServer) {
      if (String(rawMultiplier).toLowerCase() === "off") await levelingService.clearXPBoost(interaction.guild.id);
      else await levelingService.setXPBoost(interaction.guild.id, null, multiplier);
      const value = String(rawMultiplier).toLowerCase() === "off" ? "1x" : `${multiplier}x`;
      return interaction.reply?.({ content: `✅ Server-wide XP boost is now **${value}**.` });
    }

    const member = resolveMember(interaction.guild, target);
    if (!member || member.user.bot) return interaction.reply?.({ content: "❌ I couldn't find that server member.", ephemeral: true });

    if (String(rawMultiplier).toLowerCase() === "off") {
      await levelingService.clearXPBoost(interaction.guild.id, member.id);
      return interaction.reply?.({ content: `✅ Removed the individual XP boost from ${member}.` });
    }

    await levelingService.setXPBoost(interaction.guild.id, member.id, multiplier);
    return interaction.reply?.({ content: `✅ ${member} now has a **${multiplier}x** XP boost.` });
  } catch (error) {
    console.error("XP boost command error:", error);
    return interaction.reply?.({ content: "❌ I couldn't update the XP boost. Please try again.", ephemeral: true });
  }
};
