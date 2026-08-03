const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // Optional: a failed login attempt may reference an email that has no
      // matching user account, so there is no user id to record.
      required: false,
    },
    email: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: [
        "login",
        "login_failed",
        "query",
        "export",
        "password_change",
        "password_reset",
        "privacy_agreement",
      ],
      required: true,
    },
    filters: {
      type: Object,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ActivityLog", activityLogSchema);
