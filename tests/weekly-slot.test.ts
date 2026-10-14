/**
 * The weekly-slot rule the auto-scheduler, class creation, the setup page and the
 * class-health digest all share (src/lib/scheduling/weekly-slot.ts).
 */
import { describe, expect, it } from "vitest";

import {
  classSpanMinutes,
  dateToKabulLocalInput,
  formatWeeklySlot,
  isWithinLiveWindow,
  kabulLocalInputToDate,
  parseStoredWeeklySlot,
  parseWeeklySlotStrict,
  planAutoSlot,
} from "@/lib/scheduling/weekly-slot";

const wed14to15 = [{ dayOfWeek: 3, startMinute: 14 * 60, endMinute: 15 * 60 }];

describe("parseWeeklySlotStrict", () => {
  it("reads the canonical and 24h forms", () => {
    expect(parseWeeklySlotStrict("Tue 6:00 PM")).toEqual({ dayOfWeek: 2, hour: 18, minute: 0 });
    expect(parseWeeklySlotStrict("Tuesday 18:30")).toEqual({ dayOfWeek: 2, hour: 18, minute: 30 });
    expect(parseWeeklySlotStrict("sat 12:00 am")).toEqual({ dayOfWeek: 6, hour: 0, minute: 0 });
  });

  it("rejects what the old parser silently turned into Saturday 5:00 PM", () => {
    for (const bad of ["6pm", "Tue 6pm", "Tuesday evening", "", "Tue 25:00", "Tue 13:00 PM", "Tue 6"]) {
      expect(parseWeeklySlotStrict(bad)).toBeNull();
    }
  });
});

describe("parseStoredWeeklySlot (legacy free text)", () => {
  it("takes the first day and time but never invents either", () => {
    expect(parseStoredWeeklySlot("7:00 AM to 8:00 AM, Saturdays to Thursdays")).toEqual({
      dayOfWeek: 6,
      hour: 7,
      minute: 0,
    });
    expect(parseStoredWeeklySlot("7:00 AM to 8:00 AM")).toBeNull();
    expect(parseStoredWeeklySlot("TBD")).toBeNull();
    expect(parseStoredWeeklySlot(null)).toBeNull();
  });
});

describe("planAutoSlot", () => {
  it("books the posted time when the whole class fits one availability window", () => {
    expect(planAutoSlot({ schedulePreference: "Wed 2:00 PM", spanMinutes: 60, availability: wed14to15 })).toEqual({
      ok: true,
      slot: { dayOfWeek: 3, hour: 14, minute: 0 },
    });
  });

  it("never moves the class: another day, or running past the window, is not booked", () => {
    expect(planAutoSlot({ schedulePreference: "Thu 2:00 PM", spanMinutes: 60, availability: wed14to15 })).toEqual({
      ok: false,
      reason: "outside-availability",
    });
    expect(planAutoSlot({ schedulePreference: "Wed 2:30 PM", spanMinutes: 60, availability: wed14to15 })).toEqual({
      ok: false,
      reason: "outside-availability",
    });
  });

  it("requires availability and a readable time", () => {
    expect(planAutoSlot({ schedulePreference: "Wed 2:00 PM", spanMinutes: 60, availability: [] })).toEqual({
      ok: false,
      reason: "no-availability",
    });
    expect(planAutoSlot({ schedulePreference: "evenings", spanMinutes: 60, availability: wed14to15 })).toEqual({
      ok: false,
      reason: "unparseable",
    });
  });

  it("counts the segment breaks of a long class", () => {
    expect(classSpanMinutes(60)).toBe(60);
    expect(classSpanMinutes(120)).toBe(130);
    expect(classSpanMinutes(90)).toBe(100);
    expect(classSpanMinutes(10)).toBe(30);
  });
});

describe("formatting and Kabul time", () => {
  it("formats the canonical stored slot", () => {
    expect(formatWeeklySlot({ dayOfWeek: 2, hour: 18, minute: 0 })).toBe("Tue 6:00 PM");
    expect(formatWeeklySlot({ dayOfWeek: 0, hour: 0, minute: 5 })).toBe("Sun 12:05 AM");
  });

  it("reads and writes datetime-local values as Kabul wall clock, whatever the device zone", () => {
    const date = kabulLocalInputToDate("2026-10-20T18:00");
    expect(date?.toISOString()).toBe("2026-10-20T13:30:00.000Z");
    expect(dateToKabulLocalInput(new Date("2026-10-20T13:30:00.000Z"))).toBe("2026-10-20T18:00");
    expect(kabulLocalInputToDate("not a date")).toBeNull();
  });

  it("offers the live page only around the session", () => {
    const start = new Date("2026-10-20T13:30:00Z");
    const session = { startTime: start, endTime: new Date(start.getTime() + 60 * 60_000) };
    expect(isWithinLiveWindow(session, start.getTime() - 60 * 60_000)).toBe(false);
    expect(isWithinLiveWindow(session, start.getTime() - 10 * 60_000)).toBe(true);
    expect(isWithinLiveWindow(session, start.getTime() + 70 * 60_000)).toBe(true);
    expect(isWithinLiveWindow(session, start.getTime() + 2 * 60 * 60_000)).toBe(false);
  });
});
