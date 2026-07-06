import { ModellViewer } from "@/components/viewer/ModellViewer";
import { requireUser } from "@/lib/auth/session";
import { ladeTesthaus } from "@/lib/messung/testhaus";

export default async function ViewerSeite() {
  await requireUser();
  const mess = ladeTesthaus();
  return <ModellViewer mess={mess} />;
}
