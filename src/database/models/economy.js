const mongoose = require("mongoose");

const Schema = new mongoose.Schema(
  {
    // Kept for backwards compatibility with older LightCore records.
    // New reads/writes intentionally ignore Guild so balances are global.
    Guild: { type: String, default: null },
    User: { type: String, required: true },
    Money: { type: Number, default: 0, min: 0 },
    Bank: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// LightCore's economy is account-based, not server-based. Existing command
// files still pass Guild in their filters, so normalize those filters here.
// This keeps the existing economy command set while making the balance global.
function makeGlobalFilter(filter) {
  if (!filter || typeof filter !== "object") return filter;
  const normalized = { ...filter };
  delete normalized.Guild;
  delete normalized.guild;
  return normalized;
}

Schema.pre("find", function () {
  this.setQuery(makeGlobalFilter(this.getQuery()));
});

Schema.pre("findOne", function () {
  this.setQuery(makeGlobalFilter(this.getQuery()));
});

Schema.pre("findOneAndUpdate", function () {
  this.setQuery(makeGlobalFilter(this.getQuery()));
});

Schema.pre("updateOne", function () {
  this.setQuery(makeGlobalFilter(this.getQuery()));
});

Schema.pre("updateMany", function () {
  this.setQuery(makeGlobalFilter(this.getQuery()));
});

Schema.pre("deleteOne", function () {
  this.setQuery(makeGlobalFilter(this.getQuery()));
});

Schema.pre("deleteMany", function () {
  this.setQuery(makeGlobalFilter(this.getQuery()));
});

module.exports = mongoose.model("economy", Schema);
