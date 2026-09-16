const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  Guild: { type: String, required: true, unique: true, index: true },
  Channel: { type: String, default: null },
  Action: { type: String, enum: ["ban", "kick"], default: "ban" },
  Enabled: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("honeypot", Schema);
