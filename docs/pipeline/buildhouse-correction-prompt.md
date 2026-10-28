SNAPTAPE – STEP 2 CORRECTION (VARIANTE A, PROMPT A-2026-10-12)

Our check ran the function buildHouse(MESS, api) below against the measurement. Result: STOP - the 3D model cannot be shown.

ERRORS (each must be resolved):
__ERRORS__

WHAT TO DO:
- For each error: correct the geometry so that the measured value holds. If the geometry of the house really forces a different value, keep it and call api.konflikt(id, text) naming both values and the reason.
- Change nothing else. Every rule of the step-2 prompt still applies (numbers from MESS or api.ergaenzt, every id built or reported with api.nichtGebaut, the function never throws, no THREE / document / window / fetch / Math.random).

ANSWER FORMAT:
- ONE fenced code block ```js with the COMPLETE corrected function buildHouse(MESS, api) { ... } - the whole function, not only the changed part.
- Under the code at most three short lines in German: what you changed and why.

YOUR PREVIOUS FUNCTION:
__PREVIOUS_CODE__
