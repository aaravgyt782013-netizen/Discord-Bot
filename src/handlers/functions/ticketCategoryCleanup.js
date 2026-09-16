const Discord = require("discord.js");
const ticketSchema = require("../../database/models/tickets");

const WRAPPED = Symbol.for("lightcore.ticketCategoryCleanupWrapped");

module.exports = async (client) => {
  if (ticketSchema.prototype[WRAPPED]) return;
  ticketSchema.prototype[WRAPPED] = true;

  const originalSave = ticketSchema.prototype.save;

  ticketSchema.prototype.save = async function (...args) {
    let removedCategoryIds = [];

    try {
      if (!this.isNew && this.isModified("Categories") && this._id) {
        const previous = await ticketSchema.findById(this._id).lean().exec();
        const currentIds = new Set(
          (this.Categories || [])
            .map((category) => String(category?.Category || ""))
            .filter(Boolean),
        );

        removedCategoryIds = (previous?.Categories || [])
          .map((category) => String(category?.Category || ""))
          .filter((categoryId) => categoryId && !currentIds.has(categoryId));

        if (removedCategoryIds.length && String(this.Category || "") && removedCategoryIds.includes(String(this.Category))) {
          const replacement = (this.Categories || [])[0];
          this.Category = replacement?.Category || null;
          this.Role = replacement?.Role || null;
          this.Logs = replacement?.Logs || null;
        }
      }
    } catch (error) {
      console.warn("Ticket category cleanup pre-save check failed:", error?.message || error);
    }

    const result = await originalSave.apply(this, args);

    if (!removedCategoryIds.length) return result;

    const guild = client.guilds.cache.get(String(this.Guild));
    if (!guild) return result;

    const stillUsed = new Set(
      (this.Categories || [])
        .map((category) => String(category?.Category || ""))
        .filter(Boolean),
    );

    for (const categoryId of [...new Set(removedCategoryIds)]) {
      if (stillUsed.has(categoryId)) continue;

      try {
        const channel = await guild.channels.fetch(categoryId).catch(() => null);
        if (!channel || channel.type !== Discord.ChannelType.GuildCategory) continue;
        await channel.delete("Ticket category removed from LightCore ticket setup");
      } catch (error) {
        console.warn(`Could not delete ticket category ${categoryId}:`, error?.message || error);
      }
    }

    return result;
  };
};
