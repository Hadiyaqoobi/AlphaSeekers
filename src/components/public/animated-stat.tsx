"use client";

import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

type AnimatedStatProps = {
    value: number;
    suffix?: string;
    className?: string;
};

export function AnimatedStat({ value, suffix = "", className }: AnimatedStatProps) {
    const ref = useRef<HTMLSpanElement>(null);
    const isInView = useInView(ref, { once: true, margin: "-50px" });
    const count = useMotionValue(0);
    const rounded = useTransform(count, (latest: number) => Math.round(latest));

    useEffect(() => {
        if (isInView) {
            const controls = animate(count, value, {
                duration: 2,
                ease: [0.21, 0.47, 0.32, 0.98], // custom spring-like ease
            });
            return controls.stop;
        }
    }, [isInView, value, count]);

    return (
        <span className={className}>
            <motion.span ref={ref}>{rounded}</motion.span>
            {suffix}
        </span>
    );
}
