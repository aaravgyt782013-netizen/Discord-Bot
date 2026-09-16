const mongoose = require("mongoose");

const Schema = new mongoose.Schema(
  {
    Guild: { type: String, required: true, unique: true, index: true },
    Enabled: { type: Boolean, default: false },
    MessageThreshold: { type: Number, default: 5, min: 1, max: 100 },
    MinXP: { type: Number, default: 15, min: 1, max: 1000 },
    MaxXP: { type: Number, default: 25, min: 1, max: 1000 },
    XPMultiplier: { type: Number, default: 1, min: 0.1, max: 10 },
    XPBoost: { type: Number, default: 1, min: 0.1, max: 10 },
    UserXPBoosts: { type: Map, of: Number, default: () => new Map() },
    LevelUpChannel: { type: String, default: null },
    LevelUpMessage: {
      type: String,
      default: "{user.mention} reached **Level {user.level}**! GG!",
      maxlength: 1000,
    },
    Announcements: { type: Boolean, default: true },
    LevelCoinReward: { type: Number, default: 100, min: 0, max: 1000000 },
  },
  { timestamps: true },
);

Schema.pre("validate", function (next) {
  if (this.MinXP > this.MaxXP) {
    const value = this.MinXP;
    this.MinXP = this.MaxXP;
    this.MaxXP = value;
  }
  if (this.UserXPBoosts) {
    for (const [userId, boost] of this.UserXPBoosts.entries()) {
      const numeric = Number(boost);
      if (!Number.isFinite(numeric) || numeric < 0.1 || numeric > 10) this.UserXPBoosts.delete(userId);
    }
  }
  next();
});

module.exports = mongoose.model("levelingConfig", Schema);
