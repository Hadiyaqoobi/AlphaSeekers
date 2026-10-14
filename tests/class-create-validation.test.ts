/**
 * The ONE validation both "post a class" endpoints share
 * (src/lib/platform/class-create.ts). An unreadable class time must be a clear
 * 400, never the old silent Saturday 5:00 PM.
 */
import { describe, expect, it } from "vitest";

import { parseCreateClassBody } from "@/lib/platform/class-create";

const base = {
  name: "English A2",
  subjectCategory: "English",
  description: "Speaking practice",
  teacherId: "teacher-1",
};

describe("parseCreateClassBody", () => {
  it("builds the canonical schedule from the form's day + time", () => {
    const parsed = parseCreateClassBody({ ...base, day: "Tue", time: "18:00" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.schedulePreference).toBe("Tue 6:00 PM");
    expect(parsed.data.maxStudents).toBe(50);
    expect(parsed.data.durationMinutes).toBe(60);
    expect(parsed.data.schedulingMode).toBe("AUTO");
    expect(parsed.data.registrationDeadline).toBeNull();
  });

  it("still accepts a readable schedulePreference string (scripts, older clients)", () => {
    const parsed = parseCreateClassBody({ ...base, schedulePreference: "Tuesday 6:00 pm", schedulingMode: "MANUAL" });
    expect(parsed.ok && parsed.data.schedulePreference).toBe("Tue 6:00 PM");
    expect(parsed.ok && parsed.data.schedulingMode).toBe("MANUAL");
  });

  it("rejects an unreadable or missing class time with a message naming the field", () => {
    for (const body of [
      { ...base, schedulePreference: "6pm" },
      { ...base, schedulePreference: "Tuesday evening" },
      { ...base, day: "Tue", time: "" },
      { ...base },
    ]) {
      const parsed = parseCreateClassBody(body);
      expect(parsed.ok).toBe(false);
      if (parsed.ok) continue;
      expect(parsed.body.message).toMatch(/schedulePreference|time/i);
      expect(parsed.body.errors.length).toBeGreaterThan(0);
    }
  });

  it("rejects links that are not http(s) instead of silently dropping them", () => {
    const parsed = parseCreateClassBody({ ...base, day: "Mon", time: "09:00", registrationFormUrl: "javascript:alert(1)" });
    expect(parsed.ok).toBe(false);
    const blank = parseCreateClassBody({ ...base, day: "Mon", time: "09:00", whatsappGroupUrl: "" });
    expect(blank.ok && blank.data.whatsappGroupUrl).toBeUndefined();
  });

  it("requires a teacher or an invite", () => {
    const { teacherId: _unused, ...noTeacher } = base;
    void _unused;
    expect(parseCreateClassBody({ ...noTeacher, day: "Mon", time: "09:00" }).ok).toBe(false);
    expect(
      parseCreateClassBody({ ...noTeacher, day: "Mon", time: "09:00", newTeacherName: "Ahmad", newTeacherEmail: "a@example.com" })
        .ok,
    ).toBe(true);
  });
});
