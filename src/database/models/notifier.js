const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  Guild: { type: String, required: true, index: true },
  YouTubeChannelId: { type: String, required: true },
  YouTubeUrl: { type: String, required: true },
  Channel: { type: String, required: true },
  LastVideoId: { type: String, default: null },
  LastCheckedAt: { type: Date, default: null },
  Enabled: { type: Boolean, default: true },
}, { timestamps: true });

Schema.index({ Guild: 1, YouTubeChannelId: 1 }, { unique: true });

module.exports = mongoose.model("notifier", Schema);
