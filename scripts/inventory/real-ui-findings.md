# Real Leipzig run — terminal/UI follow-up

## Terminal result

The terminal result below was supplied by the requester from the SELECT monitor; it was not independently re-read from the database or displayed by the UI in this pass:

- Project: `93e09fad-fef3-4e2b-af9f-adf4bd137831`
- Run: `752926e6-4e0c-43e8-80fa-75ab3a240ecf`
- Status: `model_ready`, schema 1.7
- Model/route: Kimi K3 / photo
- Duration: 1,093,462 ms
- Tokens: 30,923 input / 67,575 output
- Estimated cost: USD 1.106394
- Retry/repair: none
- Warnings: 13

## Viewer UI follow-up limitation

- The previous authenticated browser wait exceeded the notebook's 45-second script limit; the notebook worker then reset and discarded the page, cookies, and in-memory test-session state.
- I created a fresh browser context and navigated to the own-user project route. It redirected to `/login` (`25cj4k`), confirming the authenticated session was not preserved in the fresh context.
- No credentials were available in the reset session. I did not create another user, guess credentials, use an auth/owner bypass, restart the workflow, or modify project/run data.
- Because the required own-user session was lost, I could not open the real Leipzig viewer or capture its terminal UI, desktop/390px screenshots, warnings, or console/hydration messages. There is no real-viewer console error prefix to report from this pass.
- No screenshot bytes were exported; only the login-page observation ID is available. No screenshot file was written.

The run was already terminal according to the requester, so no additional polling or measurement action was performed.
