const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  Guild: { type: String, required: true, index: true },
  TicketID: { type: Number, required: true },
  channelID: { type: String, required: true },
  creator: { type: String, required: true, index: true },
  claimed: { type: String, default: "None" },
  Category: { type: String, default: "Support" },
  resolved: { type: Boolean, default: false, index: true },
}, { timestamps: true });

Schema.index({ Guild: 1, channelID: 1 }, { unique: true });
Schema.index({ Guild: 1, creator: 1, resolved: 1 });
Schema.index({ Guild: 1, TicketID: 1 });

module.exports = mongoose.model("ticketChannels", Schema);
