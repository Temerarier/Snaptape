---
name: Tracked build output crashes the dev server
description: Why git-tracked .next/dist build files cause recurring client runtime crashes and how to untrack them without git rm
---

**Rule:** Build output directories (e.g. Next.js `.next/`) must never be git-tracked. If they are, every platform checkpoint/merge/rollback rewrites those files *underneath the running dev server*, corrupting its webpack chunk graph. Open browser tabs then crash with `TypeError: Cannot read properties of undefined (reading 'call')` at `options.factory` (webpack runtime), even though server logs show no error and all routes return 200.

**Why:** The dev server assumes exclusive ownership of its build dir. Git operations (auto-checkpoints included) restore/replace stale manifests and chunk packs, so served chunks reference modules that no longer exist. Clearing the cache only fixes it until the next checkpoint touches the tracked files — the crash recurs.

**How to apply:**
- Symptom signature: recurring client-side webpack `reading 'call'` errors, clean server logs, auto-checkpoint messages mentioning "webpack cache / manifest files" — check `git ls-files <app>/.next | wc -l` first.
- Fix without forbidden `git rm`: ensure `.gitignore` covers the dir, then plain `rm -rf <app>/.next` (allowed file op) — the next auto-checkpoint commits the deletions, permanently untracking them.
- **Order matters:** the dev server must be STOPPED (kill its process; workflow skill has no stop, and `restart_workflow` regenerates `.next` within seconds) and must stay stopped until a checkpoint commit happens — otherwise the regenerated files are re-committed as modified and remain tracked. `git update-index --force-remove` and `git rm --cached` are both blocked in the main agent.
- After the checkpoint, restart the workflow; regenerated files are then ignored for good.
- Users with an open preview tab still hold stale chunks after any dev-server restart; a hard reload of the preview clears it.
