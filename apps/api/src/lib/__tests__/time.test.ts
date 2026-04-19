import { describe, it, expect } from "vitest";
import { dateInTz, tzMidnight, splitSessionByDay, todayInTz, addDays } from "../time";

describe("Time utilities", () => {
  describe("dateInTz", () => {
    it("returns correctly formatted string in targeted timezone", () => {
      const date = new Date(Date.UTC(2023, 10, 15, 12, 0, 0)); // Nov 15 12:00:00 UTC
      expect(dateInTz(date, "America/New_York")).toBe("2023-11-15");
      expect(dateInTz(date, "Asia/Tokyo")).toBe("2023-11-15");

      const borderline = new Date(Date.UTC(2023, 10, 15, 23, 0, 0)); // Nov 15 23:00:00 UTC
      expect(dateInTz(borderline, "America/New_York")).toBe("2023-11-15");
      expect(dateInTz(borderline, "Asia/Tokyo")).toBe("2023-11-16");
    });
  });

  describe("tzMidnight", () => {
    it("calculates midnight UTC instant for a timezone", () => {
      const midnightNY = tzMidnight("2023-11-15", "America/New_York");
      // NY is UTC-5 in November (no DST) -> midnight NY = 05:00 UTC
      expect(midnightNY.toISOString()).toBe("2023-11-15T05:00:00.000Z");

      const midnightTokyo = tzMidnight("2023-11-15", "Asia/Tokyo");
      // Tokyo is UTC+9 -> midnight Tokyo = 15:00 UTC on the previous day
      expect(midnightTokyo.toISOString()).toBe("2023-11-14T15:00:00.000Z");
    });
  });

  describe("splitSessionByDay", () => {
    it("splits sessions spanning midnight", () => {
      // Create a session crossing midnight in New York.
      // NY midnight = Nov 16 05:00:00 UTC
      const start = new Date(Date.UTC(2023, 10, 16, 4, 0, 0)); // Nov 15, 23:00 NY
      const end = new Date(Date.UTC(2023, 10, 16, 6, 0, 0)); // Nov 16, 01:00 NY

      const result = splitSessionByDay(start, end, "America/New_York");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ date: "2023-11-15", seconds: 3600 });
      expect(result[1]).toEqual({ date: "2023-11-16", seconds: 3600 });
    });

    it("keeps single-day sessions together", () => {
      const start = new Date(Date.UTC(2023, 10, 16, 14, 0, 0)); // Nov 16, 09:00 NY
      const end = new Date(Date.UTC(2023, 10, 16, 15, 0, 0)); // Nov 16, 10:00 NY
      const result = splitSessionByDay(start, end, "America/New_York");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ date: "2023-11-16", seconds: 3600 });
    });
  });

  describe("addDays", () => {
    it("adds or subtracts days across months/years", () => {
      expect(addDays("2023-11-15", 2)).toBe("2023-11-17");
      expect(addDays("2023-11-15", -2)).toBe("2023-11-13");

      expect(addDays("2023-01-01", -1)).toBe("2022-12-31");
      expect(addDays("2024-02-28", 1)).toBe("2024-02-29"); // leap year
      expect(addDays("2023-02-28", 1)).toBe("2023-03-01"); // non leap year
    });
  });
});
