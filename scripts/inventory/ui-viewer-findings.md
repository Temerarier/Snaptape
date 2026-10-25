# Viewer screenshots and authorized real-run start

## Environment and live-run handoff

- Before starting the Leipzig run, checked the currently running Next process without printing environment values: `EXTRAKTOR_STUB` was **unset**; `STAFF_EMAILS` was set but did **not** match the temporary test-account override. The default web workflow had already been restored.
- On `Inventory 2026-10-25 real Leipzig` (project UUID `93e09fad-fef3-4e2b-af9f-adf4bd137831`), confirmed the nine photos, Standard selected, no reference object/value, then clicked **Start measurement once**.
- The UI first showed **“Checking your files …”**, then navigated to the project page with status **“Measuring”** and message **“Measuring your building… this page updates automatically.”** It listed 9 files, showed no classification gate failure, and kept Open 3D disabled. This is the stop condition requested; no second click, retry, premium run, or further polling was performed. The live run was left active for the main agent to SELECT-poll.
- The web workflow was not restarted after the live measurement started.
- Start-state screenshot observation: `1papdc`.

## Braamheide stub viewer

Tested only the new user's own Braamheide stub project, UUID `2a4ba0ce-7e33-455a-9f81-b449eb0c7ed0`.

### Desktop — 1280×720

- Screenshot observation: `6j279k` (the preceding route-navigation capture is `01t2li`).
- The measurements panel rendered populated data and viewer controls, but no 3D model appeared. The viewport displayed: **“The 3D view could not be started. Your browser or device does not support WebGL. The measurements in the panel remain available.”**
- Renderer check: one 300×150 canvas, no image fallback. Browser logs reported `THREE.WebGLRenderer` could not create a WebGL context; therefore the observed state is the app's WebGL-unavailable fallback, not a rendered model.
- Document width was 1265px at 1280px viewport width; no horizontal overflow was measured. No raw viewer/common/measurement translation-key-like strings were detected.
- Browser logs also included a React hydration-mismatch warning. No other viewer-specific console error was observed.

### Phone — 390×844

- Screenshot observation: `usyh5h` (the first resized capture is `wy6ol4`).
- The same WebGL-unavailable fallback remained; measurement controls/data were stacked below the viewport, with “Show full model” between viewer and Measurements.
- Measured document/body client width was 375px and scroll width 383px, i.e. 8px horizontal overflow. The viewer itself measured 375px client/scroll width. The screenshot showed a bottom horizontal scrollbar and the fallback sentence clipped at the right edge. The development issues badge also overlapped part of the first measurement row.
- No raw translation-key-like strings were detected. The browser logs retained the WebGL creation errors and hydration warning seen at desktop.

## Screenshot export

The browser tool supplied the screenshot observations above, but no supported byte/file export was available in this pass. Per browser harness constraints, `page.screenshot()` was not called. The observations are referenced by ID here; image files were not written into `screenshots/inventory-2026-10-25/`.
