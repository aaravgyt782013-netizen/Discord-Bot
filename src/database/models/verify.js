const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  Guild: { type: String, required: true, unique: true, index: true },
  Channel: { type: String, default: null },
  Role: { type: String, default: null },
  Logs: { type: String, default: null },
  UnverifiedRole: { type: String, default: null },
  Enabled: { type: Boolean, default: false },
  AutoSetup: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("verify", Schema);
