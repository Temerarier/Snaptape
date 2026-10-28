import { notFound } from "next/navigation";
import { ProjectViewer } from "@/components/viewer-next/ProjectViewer";
import { TestHouseSelector } from "@/components/viewer-next/TestHouseSelector";
import { loadTestHouse, TEST_HOUSES } from "./testHouses";
import { getDictionary, toLocale } from "@/i18n";
import { requireStaff } from "@/lib/auth/staff";

export default async function ViewerNextPage({ searchParams }: {
  searchParams: Promise<{ house?: string }>;
}) {
  const user = await requireStaff();
  const { house = "garage-house" } = await searchParams;
  const option = TEST_HOUSES.find(item => item.id === house);
  if (!option) notFound();
  const locale = toLocale(user.locale);
  const dict = getDictionary(locale);
  const { measurement, model3d } = await loadTestHouse(option.id);

  return (
    <>
    <TestHouseSelector value={house} label={dict.viewerNext.testHouse} options={TEST_HOUSES} />
    <ProjectViewer key={house}
      measurement={measurement}
      model3d={model3d}
      model3dStatus={model3d ? "ready" : null}
      projectName={option.label}
      projectAddress={null}
      dict={dict.viewerNext}
      webglMessage={dict.viewer.webglFehler}
    />
    </>
  );
}
