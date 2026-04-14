import { StudyAssistant } from "@/components/ai/study-assistant";
import { getSessionUser } from "@/lib/security/session";
import { redirect } from "next/navigation";

type StudyAssistantPageProps = { params: { locale: string } };

export default async function StudyAssistantPage({ params }: StudyAssistantPageProps) {
  const { locale } = params;
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${locale}/login?next=/${locale}/study-assistant`);
  }

  return <StudyAssistant />;
}
