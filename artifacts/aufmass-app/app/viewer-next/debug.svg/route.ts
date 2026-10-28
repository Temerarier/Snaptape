import fixture from "../../../../../fixtures/garage-house.json";
import { buildModel } from "@/lib/viewer-next/model";
import { renderDebugSvg } from "@/lib/viewer-next/model/debugSvg";
import { requireStaff } from "@/lib/auth/staff";

export async function GET(): Promise<Response> {
  await requireStaff();
  const model = buildModel(fixture);
  return new Response(renderDebugSvg(model), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
