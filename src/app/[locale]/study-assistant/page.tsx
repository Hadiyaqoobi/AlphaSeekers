import { StudyAssistant } from "@/components/ai/study-assistant";
import { getSessionUser } from "@/lib/security/session";
import { redirect } from "next/navigation";

type StudyAssistantPageProps = { params: Promise<{ locale: string }> };

export default async function StudyAssistantPage(props: StudyAssistantPageProps) {
  const params = await props.params;
  const { locale } = params;
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${locale}/login?next=/${locale}/study-assistant`);
  }

  return <StudyAssistant />;
}
