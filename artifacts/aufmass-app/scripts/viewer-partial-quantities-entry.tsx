import { createRoot, type Root } from "react-dom/client";
import { LocaleProvider } from "../i18n/LocaleProvider";
import { enUS } from "../i18n/en-US";
import { ProjectViewer } from "../components/viewer-next/ProjectViewer";
import { prepareProjectMeasurement } from "../lib/viewer-next/projectMeasurement";
import type { CardRow, ViewerCard } from "../lib/viewer-next/viewerCards";

type Scenario = "omitted" | "null" | "malformed" | "empty";

let root: Root | undefined;

const collectionNames = [
  "faces",
  "openings",
  "edges",
  "attachments",
  "condition_areas",
  "downspouts",
] as const;

function measurementFor(scenario: Scenario): Record<string, unknown> {
  const measurement: Record<string, unknown> = {
    meta: { schema_version: "1.6" },
  };
  if (scenario === "omitted") return measurement;
  for (const name of collectionNames) {
    measurement[name] =
      scenario === "null" ? null : scenario === "malformed" ? "unreadable" : [];
  }
  return measurement;
}

function rowsOf(cards: ViewerCard[]): Record<string, string> {
  const values: Record<string, string> = {};
  const visit = (rows: CardRow[]) => {
    for (const row of rows) {
      values[row.id] = row.value ?? "—";
      if (row.subRows) visit(row.subRows);
    }
  };
  for (const card of cards) visit(card.rows);
  return values;
}

declare global {
  interface Window {
    mountPartialViewer: (scenario: Scenario) => {
      kind: string;
      cards?: Record<string, string>;
      rows?: Record<string, string>;
    };
  }
}

window.mountPartialViewer = (scenario) => {
  const measurement = measurementFor(scenario);
  const prepared = prepareProjectMeasurement(measurement, enUS.viewerNext);
  const result =
    prepared.kind === "viewer"
      ? {
          kind: prepared.kind,
          cards: Object.fromEntries(
            prepared.cards.map((card) => [card.id, card.hero]),
          ),
          rows: rowsOf(prepared.cards),
        }
      : { kind: prepared.kind };

  root?.unmount();
  const host = document.createElement("div");
  host.id = "viewer-partial-regression-root";
  document.body.replaceChildren(host);
  root = createRoot(host);
  root.render(
    <LocaleProvider locale="en-US" dict={enUS}>
      <ProjectViewer
        measurement={measurement}
        projectName={`Isolated partial data: ${scenario}`}
        projectAddress={null}
        dict={enUS.viewerNext}
        webglMessage={enUS.viewer.webglFehler}
      />
    </LocaleProvider>,
  );
  return result;
};