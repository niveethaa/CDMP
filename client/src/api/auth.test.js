import { describe, it, expect, afterEach, beforeEach, jest } from "@jest/globals";
import { fetchMe, changePassword } from "./auth";

// Stub localStorage (not available in the node test environment)
beforeEach(() => {
  global.localStorage = {
    getItem: jest.fn(() => "fake-token"),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  };
});

function mockFetchOnce(body, ok = true, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("auth API client", () => {
  describe("fetchMe", () => {
    it("calls /auth/me with the auth header and returns JSON", async () => {
      mockFetchOnce({ email: "r@utoronto.ca", role: "researcher" });

      const result = await fetchMe();

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5001/api/auth/me",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer fake-token",
          }),
        })
      );
      expect(result.email).toBe("r@utoronto.ca");
    });

    it("throws when the response is not ok", async () => {
      mockFetchOnce({}, false, 401);
      await expect(fetchMe()).rejects.toThrow(/failed to fetch account/i);
    });
  });

  describe("changePassword", () => {
    it("sends a PUT with current and new passwords", async () => {
      mockFetchOnce({ message: "Password updated successfully." });

      const result = await changePassword("oldpass12", "newpass12");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5001/api/auth/change-password",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            currentPassword: "oldpass12",
            newPassword: "newpass12",
          }),
        })
      );
      expect(result.message).toMatch(/updated/i);
    });

    it("throws with the server message on failure", async () => {
      mockFetchOnce({ message: "Current password is incorrect." }, false, 401);
      await expect(changePassword("wrong", "newpass12")).rejects.toThrow(
        /current password is incorrect/i
      );
    });
  });
});