import { LearningDashboard } from "@/components/ai/learning-dashboard";

export default function LearningPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink-main tracking-tight">Your learning journey</h1>
        <p className="text-ink-soft mt-2">
          A view of what you&apos;ve studied, where you&apos;re growing, and what&apos;s due for review.
        </p>
      </div>
      <LearningDashboard />
    </main>
  );
}
