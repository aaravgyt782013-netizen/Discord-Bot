const { PermissionFlagsBits } = require("discord.js");
const levelingConfig = require("../database/models/levelingConfig");

const DEFAULT_MESSAGE = "{user.mention} reached **Level {user.level}**! GG!";

module.exports = async (client, interaction) => {
  const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
  if (!canManage) return interaction.reply?.({ content: "❌ You need **Manage Server** to change the level-up message.", ephemeral: true });

  const raw = String(interaction.options.getString("message") || "").trim();
  const message = raw.toLowerCase() === "reset" ? DEFAULT_MESSAGE : raw;
  if (!message) return interaction.reply?.({ content: "❌ Provide a message, or use `reset` to restore the default.", ephemeral: true });
  if (message.length > 1000) return interaction.reply?.({ content: "❌ The level-up message must be 1000 characters or fewer.", ephemeral: true });

  try {
    const config = await levelingConfig.findOneAndUpdate(
      { Guild: interaction.guild.id },
      { $set: { Enabled: true, LevelUpMessage: message } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();

    return interaction.reply?.({
      content: `✅ Level-up message updated.\n\n**Preview:** ${config.LevelUpMessage}`,
    });
  } catch (error) {
    console.error("Level-up message configuration error:", error);
    return interaction.reply?.({ content: "❌ I couldn't save the level-up message. Please try again.", ephemeral: true });
  }
};
