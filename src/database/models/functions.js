const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  Guild: { type: String, required: true, index: true },
  Levels: { type: Boolean, default: false },
  Beta: { type: Boolean, default: false },
  AntiAlt: { type: Boolean, default: false },
  AntiSpam: { type: Boolean, default: false },
  AntiCaps: { type: Boolean, default: false },
  AntiInvite: { type: Boolean, default: false },
  AntiLinks: { type: Boolean, default: false },
  Prefix: { type: String, default: "." },
  Color: String,
  SpamLimit: { type: Number, default: 5, min: 2, max: 20 },
  SpamWindow: { type: Number, default: 10000, min: 2000, max: 60000 },
  CapsPercentage: { type: Number, default: 70, min: 50, max: 100 },
  MassMentionLimit: { type: Number, default: 5, min: 2, max: 20 },
}, { timestamps: true });

module.exports = mongoose.model("functions", Schema);
