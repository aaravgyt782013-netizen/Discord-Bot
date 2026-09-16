const mongoose = require("mongoose");

const Schema = new mongoose.Schema(
  {
    Guild: { type: String, required: true, index: true },
    User: { type: String, required: true, index: true },
    Message: { type: String, default: "Not specified", maxlength: 1000 },
    CreatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

Schema.index({ Guild: 1, User: 1 }, { unique: true });

module.exports = mongoose.model("afk", Schema);
