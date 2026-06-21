const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    source: {
      fileName: {
        type: String,
        required: true,
        trim: true,
      },
      year: {
        type: Number,
        required: true,
        index: true,
      },
      rowNumber: {
        type: Number,
        required: true,
      },
      partyCode: {
        type: String,
        trim: true,
        uppercase: true,
        index: true,
      },
      dataEra: {
        type: String,
        enum: ["modern", "pre_2004", "unknown"],
        default: "unknown",
      },
      importDataBatchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ImportDataBatch",
      },
    },

    donor: {
      donorType: {
        type: String,
        trim: true,
      },
      donorFirstName: {
        type: String,
        trim: true,
      },
      donorLastName: {
        type: String,
        trim: true,
      },
      donorMiddleName: {
        type: String,
        trim: true,
      },
      donorDisplayName: {
        type: String,
        trim: true,
        index: true,
      },
      city: {
        type: String,
        trim: true,
      },
      province: {
        type: String,
        trim: true,
        uppercase: true,
        index: true,
      },
      postalCode: {
        type: String,
        trim: true,
        uppercase: true,
        index: true,
      },
      fsa: {
        type: String,
        trim: true,
        uppercase: true,
        index: true,
      },
    },

    party: {
      code: {
        type: String,
        trim: true,
        uppercase: true,
        index: true,
        required: true,
      },
      name: {
        type: String,
        trim: true,
      },
    },

    recipient: {
      id: {
        type: String,
        trim: true,
      },
      name: {
        type: String,
        trim: true,
      },
      politicalEntity: {
        type: String,
        trim: true,
      },
      electoralDistrict: {
        type: String,
        trim: true,
        index: true,
      },
      electoralEvent: {
        type: String,
        trim: true,
      },
    },

    contribution: {
      dateReceived: {
        type: Date,
        index: true,
      },
      amountMonetary: {
        type: Number,
        index: true,
        default: 0,
      },
      amountNonMonetary: {
        type: Number,
        index: true,
        default: 0,
      },
      amountTotal: {
        type: Number,
        index: true,
        default: 0,
      },
    },

    geography: {
      provinceCode: {
        type: String,
        trim: true,
        uppercase: true,
        index: true,
      },
      provinceName: {
        type: String,
        trim: true,
      },
      ridingCode: {
        type: String,
        trim: true,
        index: true,
      },
      ridingName: {
        type: String,
        trim: true,
        index: true,
      },
      boundarySet: {
        type: String,
        trim: true,
      },
      geoCodeStatus: {
        type: String,
        enum: ["matched", "unmatched", "ambiguous", "not_attempted"],
        default: "not_attempted",
      },
      latitude: {
        type: Number,
      },
      longitude: {
        type: Number,
      },
    },

    access: {
      individualRecordRestricted: {
        type: Boolean,
        default: true,
      },
      publicAggregationAllowed: {
        type: Boolean,
        default: true,
      },
    },

    raw: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    collection: "donations",
  },
);

donationSchema.index({ "source.year": 1, "party.code": 1 });
donationSchema.index({ "geography.provinceCode": 1, "source.year": 1 });
donationSchema.index({ "geography.ridingCode": 1, "source.year": 1 });
donationSchema.index({ "geography.ridingName": 1, "source.year": 1 });
donationSchema.index({ "contribution.amountTotal": -1 });

donationSchema.index({
  "donor.donorDisplayName": "text",
  "recipient.name": "text",
  "recipient.electoralDistrict": "text",
  "geography.ridingName": "text",
});

module.exports = mongoose.model("Donation", donationSchema);
