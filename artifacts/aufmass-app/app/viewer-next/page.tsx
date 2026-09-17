import { computeDerived } from "@workspace/measurement";
import type { MeasurementInput } from "@workspace/measurement";
import fixture from "../../../../fixtures/garage-house.json";
import { ViewerNextClient } from "@/components/viewer-next/ViewerNextClient";
import { buildCards } from "@/lib/viewer-next/viewerCards";
import type { MinimalMeasurement } from "@/lib/viewer-next/viewerCards";
import { getDictionary, toLocale } from "@/i18n";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ViewerNextPage() {
  const user = await getCurrentUser();
  const locale = toLocale(user?.locale);
  const dict = getDictionary(locale);

  const measurement = fixture as unknown as MeasurementInput & typeof fixture;
  const derived = computeDerived(measurement);
  const displayMeasurement = fixture as unknown as MinimalMeasurement;
  const cards = buildCards(derived, displayMeasurement, dict.viewerNext);

  return (
    <ViewerNextClient
      measurement={displayMeasurement}
      cards={cards}
      dict={dict.viewerNext}
      webglMessage={dict.viewer.webglFehler}
    />
  );
}
