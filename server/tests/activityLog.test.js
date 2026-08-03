const ActivityLog = require("../src/models/ActivityLog");

describe("ActivityLog", () => {
  it("accepts password reset events", async () => {
    const event = new ActivityLog({
      email: "researcher@utoronto.ca",
      action: "password_reset",
    });

    await expect(event.validate()).resolves.toBeUndefined();
  });
});
