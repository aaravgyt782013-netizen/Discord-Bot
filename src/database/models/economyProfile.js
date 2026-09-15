const mongoose = require("mongoose");

const Schema = new mongoose.Schema(
  {
    User: { type: String, required: true, unique: true, index: true },
    XP: { type: Number, default: 0, min: 0 },
    Pet: {
      name: { type: String, default: null },
      type: { type: String, default: null },
      energy: { type: Number, default: 100, min: 0, max: 100 },
      adoptedAt: { type: Date, default: null },
    },
    Quest: {
      key: { type: String, default: null },
      claimedAt: { type: Date, default: null },
    },
    Inventory: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("economyProfile", Schema);
