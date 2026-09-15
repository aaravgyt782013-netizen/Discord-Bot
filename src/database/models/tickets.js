const mongoose = require("mongoose");

const TicketCategory = new mongoose.Schema({
  Name: { type: String, required: true },
  Category: { type: String, required: true },
  Role: { type: String, required: true },
  Logs: { type: String, default: null },
  Transcript: { type: String, default: null },
  Description: { type: String, default: "Support ticket" },
  Emoji: { type: String, default: "🎫" },
  Enabled: { type: Boolean, default: true },
}, { _id: true });

const SetupDraft = new mongoose.Schema({
  User: String,
  Name: String,
  Emoji: String,
  Description: String,
  Category: String,
  Role: String,
  Logs: String,
  Transcript: String,
}, { _id: false });

const Schema = new mongoose.Schema({
  Guild: String,
  Category: String,
  Role: String,
  Channel: String,
  Logs: String,
  TicketCount: { type: Number, default: 0 },
  Categories: { type: [TicketCategory], default: [] },
  SetupDrafts: { type: [SetupDraft], default: [] },
});

module.exports = mongoose.model("tickets", Schema);
