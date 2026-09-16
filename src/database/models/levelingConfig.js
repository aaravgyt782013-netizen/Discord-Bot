const mongoose = require("mongoose");

const Schema = new mongoose.Schema(
  {
    Guild: { type: String, required: true, unique: true, index: true },
    Enabled: { type: Boolean, default: false },
    MessageThreshold: { type: Number, default: 5, min: 1, max: 100 },
    MinXP: { type: Number, default: 15, min: 1, max: 1000 },
    MaxXP: { type: Number, default: 25, min: 1, max: 1000 },
    XPMultiplier: { type: Number, default: 1, min: 0.1, max: 10 },
    LevelUpChannel: { type: String, default: null },
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
  next();
});

module.exports = mongoose.model("levelingConfig", Schema);
