import { describe, expect, it } from "vitest";
import {
  addWeeks,
  formatDayLabel,
  formatISODate,
  formatRangeLabel,
  getWeekRange,
  toDayKey,
} from "@/lib/date";

const iso = (date: Date) => date.toISOString();

describe("toDayKey", () => {
  it("strips the time of day", () => {
    expect(iso(toDayKey(new Date("2026-08-02T15:30:45.123Z")))).toBe("2026-08-02T00:00:00.000Z");
  });

  it("is idempotent", () => {
    const once = toDayKey(new Date("2026-08-02T15:30:00Z"));
    expect(iso(toDayKey(once))).toBe(iso(once));
  });

  it("uses UTC calendar fields, so a late-evening UTC timestamp keeps its own date", () => {
    expect(iso(toDayKey(new Date("2026-08-02T23:59:59Z")))).toBe("2026-08-02T00:00:00.000Z");
  });
});

describe("getWeekRange", () => {
  it("returns the Monday-to-Sunday week containing a midweek date", () => {
    // 2026-07-29 is a Wednesday.
    const { start, end, days } = getWeekRange(new Date("2026-07-29T12:00:00Z"));

    expect(iso(start)).toBe("2026-07-27T00:00:00.000Z");
    expect(iso(end)).toBe("2026-08-02T00:00:00.000Z");
    expect(days).toHaveLength(7);
    expect(days.map(formatISODate)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  it("treats Sunday as the last day of the week, not the first", () => {
    // 2026-08-02 is a Sunday: it belongs to the week starting 2026-07-27.
    const { start, end } = getWeekRange(new Date("2026-08-02T00:00:00Z"));

    expect(iso(start)).toBe("2026-07-27T00:00:00.000Z");
    expect(iso(end)).toBe("2026-08-02T00:00:00.000Z");
  });

  it("returns the week starting on the given day when that day is a Monday", () => {
    const { start, end } = getWeekRange(new Date("2026-07-27T09:00:00Z"));

    expect(iso(start)).toBe("2026-07-27T00:00:00.000Z");
    expect(iso(end)).toBe("2026-08-02T00:00:00.000Z");
  });

  it("spans a month boundary without skipping days", () => {
    const { days } = getWeekRange(new Date("2026-07-30T00:00:00Z"));

    expect(days[0].getUTCMonth()).toBe(6); // July
    expect(days[6].getUTCMonth()).toBe(7); // August
  });

  it("always starts on a Monday and ends on a Sunday, whatever day is passed in", () => {
    for (let offset = 0; offset < 14; offset++) {
      const date = new Date(Date.UTC(2026, 0, 1 + offset));
      const { start, end } = getWeekRange(date);

      expect(start.getUTCDay()).toBe(1);
      expect(end.getUTCDay()).toBe(0);
      expect(end.getTime() - start.getTime()).toBe(6 * 24 * 60 * 60 * 1000);
    }
  });
});

describe("addWeeks", () => {
  it("moves forward by whole weeks", () => {
    expect(iso(addWeeks(new Date("2026-07-27T00:00:00Z"), 1))).toBe("2026-08-03T00:00:00.000Z");
  });

  it("moves backward for a negative count", () => {
    expect(iso(addWeeks(new Date("2026-07-27T00:00:00Z"), -1))).toBe("2026-07-20T00:00:00.000Z");
  });

  it("returns the same instant for zero", () => {
    const date = new Date("2026-07-27T00:00:00Z");
    expect(iso(addWeeks(date, 0))).toBe(iso(date));
  });

  it("keeps landing on the same weekday", () => {
    const monday = new Date("2026-07-27T00:00:00Z");
    expect(addWeeks(monday, 5).getUTCDay()).toBe(monday.getUTCDay());
  });
});

describe("formatISODate", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(formatISODate(new Date("2026-08-02T15:30:00Z"))).toBe("2026-08-02");
  });

  it("round-trips through getWeekRange days", () => {
    const { days } = getWeekRange(new Date("2026-08-02T00:00:00Z"));
    expect(formatISODate(new Date(`${formatISODate(days[3])}T00:00:00Z`))).toBe(formatISODate(days[3]));
  });
});

describe("labels", () => {
  it("formats a day label with weekday, month and day", () => {
    expect(formatDayLabel(new Date("2026-07-27T00:00:00Z"))).toBe("Mon, Jul 27");
  });

  it("formats a range label with the year on the end date", () => {
    expect(
      formatRangeLabel(new Date("2026-07-27T00:00:00Z"), new Date("2026-08-02T00:00:00Z"))
    ).toBe("Jul 27 – Aug 2, 2026");
  });
});
