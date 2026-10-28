import React from "react";
import type { Dictionary } from "@/i18n";
import { prepareProjectMeasurement } from "@/lib/viewer-next/projectMeasurement";
import { ViewerNextClient } from "./ViewerNextClient";
import type { Model3dData } from "@workspace/db";
import type { Model3dStatus } from "@/lib/viewer-next/model/fromModel3d";

export function ProjectViewer({
  measurement,
  projectName,
  projectAddress,
  projectId,
  dict,
  webglMessage,
  model3d,
  model3dStatus = null,
}: {
  measurement: unknown;
  projectName: string;
  projectAddress: string | null;
  projectId?: string;
  dict: Dictionary["viewerNext"];
  webglMessage: string;
  model3d?: Model3dData | null;
  model3dStatus?: Model3dStatus;
}) {
  const prepared = prepareProjectMeasurement(measurement, dict);

  if (prepared.kind !== "viewer") {
    const message =
      prepared.kind === "older-version"
        ? dict.projectMessages.olderVersion
        : dict.projectMessages.unreadable;
    return (
      <main
        className="mx-auto max-w-3xl px-6 py-12"
        data-project-viewer-state={prepared.kind}
      >
        <h1 className="text-2xl font-semibold tracking-tight">{projectName}</h1>
        {projectAddress ? (
          <p className="mt-1 text-neutral-500">{projectAddress}</p>
        ) : null}
        <p className="mt-8 text-neutral-700">{message}</p>
      </main>
    );
  }

  return (
    <ViewerNextClient
      measurement={prepared.measurement}
      derived={prepared.derived}
      cards={prepared.cards}
      dict={dict}
      webglMessage={webglMessage}
      projectName={projectName}
      projectAddress={projectAddress}
      uploadHref={projectId ? `/app/projekt/${projectId}/upload` : undefined}
      printHref={projectId ? `/app/projekt/${projectId}/print` : undefined}
      model3d={model3d}
      model3dStatus={model3dStatus}
    />
  );
}
