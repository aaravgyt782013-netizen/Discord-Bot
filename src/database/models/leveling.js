const mongoose = require("mongoose");

const Schema = new mongoose.Schema(
  {
    Guild: { type: String, required: true, index: true },
    User: { type: String, required: true, index: true },
    XP: { type: Number, default: 0, min: 0 },
    Level: { type: Number, default: 0, min: 0 },
    MessageCount: { type: Number, default: 0, min: 0 },
    LastXPAt: { type: Date, default: null },
    LastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

Schema.index({ Guild: 1, User: 1 }, { unique: true });
Schema.index({ Guild: 1, XP: -1 });

module.exports = mongoose.model("leveling", Schema);
