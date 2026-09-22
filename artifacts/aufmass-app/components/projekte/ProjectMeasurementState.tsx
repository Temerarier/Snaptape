import Link from "next/link";
import type { Dictionary } from "@/i18n";
import { projectMeasurementState } from "@/lib/projekte/measurementState";
import { AutoRefresh } from "./AutoRefresh";

export function ProjectMeasurementState({
  status,
  projectName,
  projectAddress,
  dict,
  retryHref,
}: {
  status: string;
  projectName: string;
  projectAddress: string | null;
  dict: Dictionary["projectDetail"];
  retryHref?: string;
}) {
  const state = projectMeasurementState(status);
  const failed = state === "failed";
  const processing = state === "processing";

  return (
    <main
      className="mx-auto max-w-3xl px-6 py-12"
      data-project-viewer-state={
        failed ? "failed" : processing ? "waiting" : "unavailable"
      }
      aria-busy={processing ? true : undefined}
    >
      <h1 className="text-2xl font-semibold tracking-tight">{projectName}</h1>
      {projectAddress ? (
        <p className="mt-1 text-neutral-500">{projectAddress}</p>
      ) : null}

      {failed ? (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-900">
            {dict.measurementFailed}
          </p>
          {retryHref ? (
            <Link
              href={retryHref}
              className="mt-4 inline-flex rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              {dict.measureAgain}
            </Link>
          ) : null}
        </div>
      ) : processing ? (
        <>
          <AutoRefresh />
          <div className="mt-8 flex min-h-64 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
            <div className="text-center">
              <span
                className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700"
                aria-hidden="true"
              />
              <p className="mt-4 text-sm text-neutral-600">
                {dict.messungLaeuft}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-xl border border-neutral-200 bg-neutral-50 p-6">
          <p className="text-sm text-neutral-700">
            {dict.measurementUnavailable}
          </p>
        </div>
      )}
    </main>
  );
}