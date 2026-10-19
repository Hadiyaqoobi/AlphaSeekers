"use client";

import { useTranslations } from "next-intl";

import { DAY_ABBREVIATIONS } from "@/lib/scheduling/weekly-slot";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type DayPickerProps = {
    id: string;
    label: string;
    /** Ticked days as "Sun" … "Sat". */
    value: string[];
    onChange: (days: string[]) => void;
};

/**
 * Tick every day a class meets (it used to be one day only). Each ticked day is
 * booked as its own session at the class's one time. Shared by the "post a
 * class" form and the class edit form; the value stays in week order.
 */
export function DayPicker({ id, label, value, onChange }: DayPickerProps) {
    const ts = useTranslations("staffForms");

    function toggle(day: string) {
        const next = value.includes(day) ? value.filter((d) => d !== day) : [...value, day];
        onChange(DAY_ABBREVIATIONS.filter((d) => next.includes(d)));
    }

    return (
        <fieldset className="space-y-1" id={id}>
            <legend className="text-xs font-semibold text-ink-soft">{label}</legend>
            <div className="flex flex-wrap gap-2">
                {DAY_ABBREVIATIONS.map((day, index) => {
                    const on = value.includes(day);
                    return (
                        <label
                            className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm font-semibold focus-within:ring-2 focus-within:ring-neon-400 ${
                                on
                                    ? "border-neon-400 bg-neon-400/15 text-neon-400"
                                    : "border-line text-ink-soft hover:border-neon-400"
                            }`}
                            key={day}
                        >
                            <input
                                checked={on}
                                className="sr-only"
                                onChange={() => toggle(day)}
                                type="checkbox"
                                value={day}
                            />
                            {on ? "✓ " : ""}
                            {ts(DAY_KEYS[index])}
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}
