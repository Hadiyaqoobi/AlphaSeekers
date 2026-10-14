// STUB — replaced by the AI engineer's implementation at merge
//
// The real version moves the body of /api/cron/ai-prep here so the gated
// /api/cron/tick can call it in-process. This placeholder only fixes the
// signature the tick depends on.
export async function runAiPrep(now: Date = new Date()): Promise<Record<string, unknown>> {
  void now;
  return { skipped: "stub" };
}
