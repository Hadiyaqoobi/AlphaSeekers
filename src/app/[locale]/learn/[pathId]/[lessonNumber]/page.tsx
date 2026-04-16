import { notFound, redirect } from "next/navigation";

import { LessonViewer } from "@/components/learn/lesson-viewer";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/security/session";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { locale: string; pathId: string; lessonNumber: string };
}

export default async function LessonPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/${params.locale}/login?next=/${params.locale}/learn/${params.pathId}/${params.lessonNumber}`);
  }

  const lessonNumber = parseInt(params.lessonNumber, 10);
  if (Number.isNaN(lessonNumber) || lessonNumber < 1) notFound();

  const path = await prisma.learningPath.findUnique({
    where: { id: params.pathId },
  });
  if (!path || path.userId !== user.id) notFound();

  // Block access to locked lessons
  if (lessonNumber > path.currentLesson) {
    redirect(`/${params.locale}/learn/${params.pathId}`);
  }

  return (
    <LessonViewer
      pathId={params.pathId}
      lessonNumber={lessonNumber}
      locale={params.locale}
      pathTitle={path.title}
    />
  );
}
