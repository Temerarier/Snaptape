# Viewer cutover inventory

This is a read-only, PII-free checkpoint of the development workspace database.
Project and owner references are truncated hashes used only to distinguish rows
in this report. Names, addresses, email addresses, UUIDs, measurements, session
tokens, and secret values were not read into the report.

## Stored `model_ready` projects

The database contains 28 `model_ready` projects:

- 24 have `meta.schema_version = "1.5"` and must show the older-version message.
- 3 have `meta.schema_version = "1.6"` and are eligible for the new viewer.
- 1 has no stored measurement and must show the unreadable-measurement message.
- No stored object has a missing or non-string schema version.

“Expected result” below is the route result implied by the stored payload and
the cutover contract. It is not a browser result. Browser rendering, omissions,
and console errors remain to be recorded by the authenticated browser pass.

| No. | Project ref | Stored measurement | Expected result | DB preflight gaps | Browser result / console |
| ---: | --- | --- | --- | --- | --- |
| 1 | `2c34f81e44` | missing | unreadable message | measurement absent | pending |
| 2 | `33cd122af1` | 1.5 object | older-version message | not processed by viewer | pending |
| 3 | `089dc74a2b` | 1.5 object | older-version message | not processed by viewer | pending |
| 4 | `035669f0c0` | 1.5 object | older-version message | not processed by viewer | pending |
| 5 | `6dd3b1c5bc` | 1.5 object | older-version message | not processed by viewer | pending |
| 6 | `0a2e069024` | 1.5 object | older-version message | not processed by viewer | pending |
| 7 | `c672e60702` | 1.5 object | older-version message | not processed by viewer | pending |
| 8 | `cf987fc594` | 1.5 object | older-version message | not processed by viewer | pending |
| 9 | `d144cb0f0c` | 1.5 object | older-version message | not processed by viewer | pending |
| 10 | `7af674817d` | 1.5 object | older-version message | not processed by viewer | pending |
| 11 | `033fcf2e27` | 1.5 object | older-version message | not processed by viewer | pending |
| 12 | `00e9e91c2d` | 1.5 object | older-version message | not processed by viewer | pending |
| 13 | `793af5311b` | 1.5 object | older-version message | not processed by viewer | pending |
| 14 | `64a86c5d73` | 1.5 object | older-version message | not processed by viewer | pending |
| 15 | `0e99dc5131` | 1.5 object | older-version message | not processed by viewer | pending |
| 16 | `584739a60e` | 1.5 object | older-version message | not processed by viewer | pending |
| 17 | `6073c6983e` | 1.5 object | older-version message | not processed by viewer | pending |
| 18 | `904daf7687` | 1.5 object | older-version message | not processed by viewer | pending |
| 19 | `78fbbcc699` | 1.5 object | older-version message | not processed by viewer | pending |
| 20 | `2c50053936` | 1.5 object | older-version message | not processed by viewer | pending |
| 21 | `319be89e0e` | 1.5 object | older-version message | not processed by viewer | pending |
| 22 | `81463d726b` | 1.5 object | older-version message | not processed by viewer | pending |
| 23 | `856d82c4ea` | 1.5 object | older-version message | not processed by viewer | pending |
| 24 | `b0de3cbdcd` | 1.5 object | older-version message | not processed by viewer | pending |
| 25 | `3274af3d59` | 1.5 object | older-version message | not processed by viewer | pending |
| 26 | `08f46699f2` | 1.6 object | new viewer | none found in structural preflight | pending |
| 27 | `00578fd797` | 1.6 object | new viewer | none found in structural preflight | pending |
| 28 | `db5f26e9e9` | 1.6 object | new viewer | none found in structural preflight | pending |

The 1.6 structural preflight mirrors the identity filtering performed by
`lib/viewer-next/projectMeasurement.ts`. All records in the arrays consumed by
the viewer have a non-empty unique ID and their required discriminator:

| Project ref | Faces | Edges | Openings | Attachments | Conditions | Missing wall dimensions | Missing roof areas | Missing opening dimensions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `08f46699f2` | 17/17 | 22/22 | 19/19 | 8/8 | 1/1 | 0 | 0 | 0 |
| `00578fd797` | 23/23 | 25/25 | 15/15 | 6/6 | 3/3 | 0 | 0 | 0 |
| `db5f26e9e9` | 11/11 | 14/14 | 26/26 | 11/11 | 2/2 | 0 | 0 | 0 |

Each `usable/raw` count is equal. This is only a server-side preflight; model
builder diagnostics and visual omissions still require the browser pass.

## Authorized browser verification feasibility

The projects belong to five owners:

| Owner ref | Projects | 1.6 | 1.5 | Unreadable | Existing active session |
| --- | ---: | ---: | ---: | ---: | --- |
| `2ba1ee7d24` | 1 | 0 | 1 | 0 | no |
| `2cc649d6e8` | 8 | 1 | 7 | 0 | yes |
| `54711e27c6` | 11 | 2 | 9 | 0 | no |
| `b86eb123c2` | 1 | 0 | 1 | 0 | no |
| `e8c1758005` | 7 | 0 | 6 | 1 | no |

Owner-route verification is feasible without changing source authorization:

1. Use the existing CDP helper in `scripts/viewer-browser-cdp.mjs`.
2. For each owner, generate a cryptographically random token in harness memory.
3. Insert only its SHA-256 hash, the real owner ID, and a short expiry into
   `sessions`, matching `lib/auth/session.ts`.
4. Set the opaque `aufmass_session` cookie through CDP, visit only that owner's
   `/app/projekt/<id>/viewer` routes, and capture state, omissions, screenshot,
   browser exceptions, and console errors.
5. Delete the temporary row by token hash in a `finally` block. Never log the
   token, owner ID, project UUID, email, name, or address.

This retains the route's `requireUser()` and `projects.user_id` filter. It is a
temporary normal session, not an auth bypass. Existing sessions should not be
reused because their raw cookie tokens are intentionally unavailable.

Staff-route verification is feasible with one prerequisite: the harness must be
given an already-authorized staff user identifier through a non-logged test
environment input. It can create and clean up a temporary session in the same
way, while `/admin/projekt/<id>/viewer` still executes `requireStaff()` against
the server-side `STAFF_EMAILS` allowlist. The harness must not read or print
`STAFF_EMAILS`. Without an explicitly supplied staff identity, staff browser
verification is blocked; the database does not store staff role membership.

The existing fixture conformance script demonstrates safe navigation,
viewport sizing, DOM assertions, screenshots, and uncaught-exception capture.
It does not authenticate, capture `Runtime.consoleAPICalled`, or enumerate
stored projects, so the project pass needs those additions. No browser run was
started for this inventory task.

## Legacy import graph at this checkpoint

Direct imports found:

- `app/app/viewer/page.tsx` imports
  `components/viewer/ModellViewer.tsx`.
- `components/viewer/ModellViewer.tsx` imports
  `components/viewer/BauteilPanel.tsx` and `lib/viewer/szene.ts`.
- `components/viewer/BauteilPanel.tsx` imports a type from
  `lib/viewer/szene.ts`.
- `lib/viewer/buehne.ts` imports runtime helpers from `lib/viewer/szene.ts`.
- `lib/viewer/szene.test.ts` imports `lib/viewer/szene.ts`.

No import of `lib/messung/anzeigeAdapterV15.ts` remains. The current project
viewer pages import `components/viewer-next/ProjectViewer.tsx`; they no longer
import `ModellViewer` or the v1.5 adapter.

`lib/viewer/szene.ts` cannot be deleted with the old project viewer:
`lib/viewer/buehne.ts` is used by the shared login-page house presentation.
Its focused test should remain as well. This confirms the warning in the
cutover brief that shared login viewer dependencies must be preserved.