/**
 * The weekly-slot rule the auto-scheduler, class creation, the setup page and the
 * class-health digest all share (src/lib/scheduling/weekly-slot.ts).
 */
import { describe, expect, it } from "vitest";

import {
  classSpanMinutes,
  dateToKabulLocalInput,
  formatWeeklySlot,
  formatWeeklySlots,
  isWithinLiveWindow,
  kabulLocalInputToDate,
  occurrenceHalfWindowMs,
  parseStoredWeeklySlot,
  parseStoredWeeklySlots,
  parseWeeklySlotStrict,
  parseWeeklySlotsStrict,
  planAutoSlot,
  slotFitsAvailability,
  slotsFromDaysAndTime,
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
  it("books the time staff posted, whatever hours the teacher saved (staff set every date)", () => {
    for (const schedulePreference of ["Wed 2:00 PM", "Thu 2:00 PM", "Wed 4:30 PM"]) {
      expect(planAutoSlot({ schedulePreference }).ok).toBe(true);
    }
    expect(planAutoSlot({ schedulePreference: "Thu 2:00 PM" })).toEqual({
      ok: true,
      slot: { dayOfWeek: 4, hour: 14, minute: 0 },
      slots: [{ dayOfWeek: 4, hour: 14, minute: 0 }],
    });
  });

  it("the teacher's hours only colour the staff hint (green fits, orange outside)", () => {
    expect(slotFitsAvailability({ dayOfWeek: 3, hour: 14, minute: 0 }, 60, wed14to15)).toBe(true);
    expect(slotFitsAvailability({ dayOfWeek: 4, hour: 14, minute: 0 }, 60, wed14to15)).toBe(false);
    expect(slotFitsAvailability({ dayOfWeek: 3, hour: 14, minute: 30 }, 60, wed14to15)).toBe(false);
  });

  it("needs a readable time", () => {
    expect(planAutoSlot({ schedulePreference: "evenings" })).toEqual({ ok: false, reason: "unparseable" });
    expect(planAutoSlot({ schedulePreference: null })).toEqual({ ok: false, reason: "unparseable" });
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

describe("several days a week (2026-10-19)", () => {
  const at6pm = (dayOfWeek: number) => ({ dayOfWeek, hour: 18, minute: 0 });

  it("reads several days sharing one time, in week order, without repeats", () => {
    expect(parseWeeklySlotsStrict("Tue, Thu, Fri 6:00 PM")).toEqual([at6pm(2), at6pm(4), at6pm(5)]);
    expect(parseWeeklySlotsStrict("Fri/Tue 18:00")).toEqual([at6pm(2), at6pm(5)]);
    expect(parseWeeklySlotsStrict("Tuesday and Thursday 6:00 pm")).toEqual([at6pm(2), at6pm(4)]);
    expect(parseWeeklySlotsStrict("Tue, Tue 6:00 PM")).toEqual([at6pm(2)]);
    expect(parseWeeklySlotsStrict("Tue 6:00 PM")).toEqual([at6pm(2)]);
  });

  it("rejects anything that is not only days and a time", () => {
    for (const bad of ["Tue, evening 6:00 PM", "Saturdays to Thursdays 7:00 AM", "6:00 PM", "Tue, Thu", "Tue 25:00", ""]) {
      expect(parseWeeklySlotsStrict(bad)).toBeNull();
    }
  });

  it("writes the canonical stored form, and a single day exactly as before", () => {
    expect(formatWeeklySlots([at6pm(5), at6pm(2), at6pm(4)])).toBe("Tue, Thu, Fri 6:00 PM");
    expect(formatWeeklySlots([at6pm(2)])).toBe("Tue 6:00 PM");
    expect(slotsFromDaysAndTime(["Tue", "Thu"], "18:00")).toEqual([at6pm(2), at6pm(4)]);
    expect(slotsFromDaysAndTime([], "18:00")).toBeNull();
  });

  it("plans every day, and older free text still as one day", () => {
    const plan = planAutoSlot({ schedulePreference: "Tue, Thu, Fri 6:00 PM" });
    expect(plan.ok && plan.slots.map((s) => s.dayOfWeek)).toEqual([2, 4, 5]);
    expect(parseStoredWeeklySlots("7:00 AM to 8:00 AM, Saturdays to Thursdays")).toEqual([
      { dayOfWeek: 6, hour: 7, minute: 0 },
    ]);
  });

  it("keeps each day's matching window inside its own day", () => {
    const DAY = 24 * 60 * 60 * 1000;
    expect(occurrenceHalfWindowMs([at6pm(2)])).toBe(3.5 * DAY);
    // Tue, Thu, Fri: the shortest gap is Thu to Fri, one day.
    expect(occurrenceHalfWindowMs([at6pm(2), at6pm(4), at6pm(5)])).toBe(0.5 * DAY);
    // Sat and Sun are one day apart across the week's end.
    expect(occurrenceHalfWindowMs([at6pm(0), at6pm(3), at6pm(6)])).toBe(0.5 * DAY);
    expect(occurrenceHalfWindowMs([at6pm(1), at6pm(4)])).toBe(1.5 * DAY);
  });
});
