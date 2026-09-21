import React from "react";
import type { Dictionary } from "@/i18n";
import { prepareProjectMeasurement } from "@/lib/viewer-next/projectMeasurement";
import { ViewerNextClient } from "./ViewerNextClient";

export function ProjectViewer({
  measurement,
  projectName,
  projectAddress,
  dict,
  webglMessage,
}: {
  measurement: unknown;
  projectName: string;
  projectAddress: string | null;
  dict: Dictionary["viewerNext"];
  webglMessage: string;
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
    />
  );
}
