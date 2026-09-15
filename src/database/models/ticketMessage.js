const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  Guild: String,
  openTicket: String,
  dmMessage: String,
  panelTitle: { type: String, default: "Need help? Open a ticket!" },
  panelDescription: { type: String, default: "Choose a ticket category below and our support team will help you." },
  panelChannel: { type: String, default: null },
  panelMessageId: { type: String, default: null },
});

module.exports = mongoose.model("ticketMessage", Schema);
