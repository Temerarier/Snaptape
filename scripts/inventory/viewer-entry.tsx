import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { ProjectViewer } from "../../artifacts/aufmass-app/components/viewer-next/ProjectViewer";
import { prepareProjectMeasurement } from "../../artifacts/aufmass-app/lib/viewer-next/projectMeasurement";
import { buildModel } from "../../artifacts/aufmass-app/lib/viewer-next/model";
import { getDictionary } from "../../artifacts/aufmass-app/i18n";
import { LocaleProvider } from "../../artifacts/aufmass-app/i18n/LocaleProvider";
const root = createRoot(document.getElementById("root")!);
const dict = getDictionary("en-US");
(window as any).mountInventory = (id: string, measurement: any) => {
  (window as any).inventoryRender = null;
  const p = prepareProjectMeasurement(measurement, dict.viewerNext);
  let model: any = null, modelError: string | null = null;
  if (p.kind === "viewer") try { model = buildModel(p.measurement as any,p.derived); } catch(e) { modelError = String(e); }
  flushSync(()=>root.render(<LocaleProvider locale="en-US" dict={dict}><ProjectViewer key={id} measurement={measurement} projectName={`Inventory ${id}`} projectAddress={null} dict={dict.viewerNext} webglMessage={dict.viewer.webglFehler}/></LocaleProvider>));
  return {
    id, version: measurement?.meta?.schema_version ?? null, preparation:p.kind, modelError,
    input:{walls:(measurement?.faces ?? []).filter((f:any)=>f.face_class==="wall").length,roofs:(measurement?.faces ?? []).filter((f:any)=>f.face_class==="roof_face").length,openings:measurement?.openings?.length ?? 0},
    modeled:model?{walls:model.walls.length,roofs:model.roofFaces.length,openings:model.openings.length}:null,
    notes:model?.notes ?? []
  };
};
(window as any).observeRender = function(this: any, scene: any, camera: any) {
  const gl = this.getContext();
  (window as any).inventoryRender = {drawCalls:this.info.render.calls,triangles:this.info.render.triangles,glError:gl.getError(),contextLost:gl.isContextLost(),camera:camera.position.toArray()};
};
