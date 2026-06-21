const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const connectDB = require("../config/db");
const PoliticalParty = require("../models/PoliticalParty");

const parties = [
  {
    code: "CPC",
    name: "Conservative Party of Canada",
    aliases: ["Conservative", "Conservative Party"],
    active: true,
  },
  {
    code: "LPC",
    name: "Liberal Party of Canada",
    aliases: ["Liberal", "Liberal Party"],
    active: true,
  },
  {
    code: "NDP",
    name: "New Democratic Party",
    aliases: ["N.D.P.", "New Democrats"],
    active: true,
  },
  {
    code: "BQ",
    name: "Bloc Québécois",
    aliases: ["Bloc Quebecois", "Bloc"],
    active: true,
  },
  {
    code: "GPC",
    name: "Green Party of Canada",
    aliases: ["Green Party", "Green"],
    active: true,
  },
  {
    code: "PPC",
    name: "People's Party of Canada",
    aliases: ["People's Party", "People Party"],
    active: true,
  },
];

async function seedPoliticalParties() {
  try {
    await connectDB();

    for (const party of parties) {
      await PoliticalParty.findOneAndUpdate(
        { code: party.code },
        { $set: party },
        {
          upsert: true,
          new: true,
        },
      );
    }

    console.log("Seeded " + parties.length + " political parties.");
  } catch (error) {
    console.error("Failed to seed political parties:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedPoliticalParties();
