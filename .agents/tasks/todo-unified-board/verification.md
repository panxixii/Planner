# Verification — Unified Todo Board, Handle-Rooted Branch-Lines (FEAT handle pass)

Worktree: `/Users/cici/Desktop/project/Planner/.worktrees/todo-unified-board`
Branch: `feat/todo-unified-board`
Iteration: FIRST (no `review.json` present). Continuation of FEAT-001/FEAT-002 per plan.md.

Dependencies resolve against the shared main-repo `node_modules` (`/Users/cici/Desktop/project/Planner/node_modules`);
the worktree has its own `node_modules` symlink/dir sharing that tree. Vite/tsx binaries live at `../../node_modules/.bin`.

## Commands run and results

### 1. Typecheck / lint — `npm run lint` (tsc --noEmit)
```
> tsc --noEmit
Exit Code: 0
```
PASS. Zero errors. No dangling references after the drafts deletion and the new `isHandle` / `toggleTodoItemHandle` wiring.

### 2. Production build — `npm run build` (vite build)
```
vite v6.4.2 building for production...
✓ 1858 modules transformed.
dist/assets/TodoPage-yZ8ExdRJ.js   242.66 kB │ gzip: 75.56 kB
dist/assets/index-VhCfLgVa.js      265.55 kB │ gzip: 81.70 kB
✓ built in 1.41s
Exit Code: 0
```
PASS. Clean build, no unresolved imports (confirms DraftsPage/DraftNode removal left no importers).

### 3. Pure-helper runtime verification (the A/F worked example — item 8)
No test runner is configured (no Vitest in the shared node_modules). Instead the REAL exported helpers
(`computeBranchLineHeads`, `computeVisibleItemIds` from `src/todoBranchLines.ts`) were exercised at runtime via
`tsx` with a throwaway script (`src/__verify_branchlines.ts`, since deleted). Graph: A,F are HANDLES; edges
A→B, A→C, B→D, B→E, F→B; plus background nodes Z (isolated) and a handle-less chain P→Q.

```
PASS heads: got {A,F} want {A,F}                                          # heads = handles only, ordered
PASS select-A: got {A,B,C,D,E,P,Q,Z} want {A,B,C,D,E,P,Q,Z}              # A's reach {A,B,C,D,E} ∪ background {Z,P,Q}
PASS select-F: got {B,D,E,F,P,Q,Z} want {B,D,E,F,P,Q,Z}                  # F's reach {F,B,D,E} ∪ background
PASS multi A+F (union): got {A,B,C,D,E,F,P,Q,Z} ...                      # union of both reach sets ∪ background
PASS select-all (null): got {null} want {null}                          # null => no filtering, all visible
PASS select-none (background only): got {P,Q,Z} want {P,Q,Z}            # [] => ONLY the always-shown background
PASS shared handle-rooted nodes: got {B,D,E} want {B,D,E}               # B,D,E reachable from both A and F
PASS stale filter id ignored: got {P,Q,Z} want {P,Q,Z}                  # unknown/demoted id skipped; background kept
Exit Code: 0
```
PASS — matches design item 8 exactly: select-A ⇒ {A,B,C,D,E}, select-F ⇒ {F,B,D,E}, shared {B,D,E}; the NEW
always-show-background rule is confirmed (Z/P/Q stay visible under every selection including select-none).
The throwaway script was deleted after the run (git status is clean of it).

### 4. Running dev server — `npm run dev` (vite --port=3123)
Started the real dev server (vite 6.4.2) on 127.0.0.1:3123. A headless agent cannot click through a browser,
so the live checks are HTTP-level: confirm the app boots and every touched module transforms with no import error.
```
VITE v6.4.2  ready in 226 ms  ➜  Local: http://127.0.0.1:3123/
GET /                               -> 200 (index.html, #root mount, /src/main.tsx entry)
GET /src/main.tsx                   -> 200
GET /src/App.tsx                    -> 200   (grep "DraftsPage" in transformed output -> 0 matches)
GET /src/store.ts                   -> 200
GET /src/todoBranchLines.ts         -> 200
GET /src/components/TodoPage.tsx    -> 200   (grep "showHandleToggle" -> 1 match: handle toggle wired)
GET /src/components/DraftsPage.tsx  -> SPA fallback (file deleted from disk; ls confirms ENOENT)
```
PASS — the app boots and all modules transform. App.tsx no longer references DraftsPage; TodoPage exposes the
handle toggle; the drafts module files are gone from disk and nothing imports them. Server was stopped
(`pkill -f "vite --port=3123"`; subsequent curl returns 000 / connection refused).

Browser click-through (board default view, handle creation, rigid drag, four-view filter sync, edge-into-handle
rejection, handle↔directory exclusivity, reload persistence of isHandle) is left to a human/reviewer via
`npm run dev`, as FEAT-002 did — the structural evidence above (tsc + vite build + live transforms + the exact
worked-example helper run) covers the logic each behaviour depends on.

## Drafts deletion guardrail (item 9/10)
`grep -rn "[Dd]raft" src/` after deletion returns ONLY the unrelated editing-buffer locals the plan called out
(ColorPicker's draftColor/hexDraft/setDraftColor/setHexDraft, and draft/setDraft/draftTitle/draftStart/draftEnd/
draftName/draftDate/draftTime/DraftEvent in TodoPage/TodoBoard/TaskNode/TodoTimeLabel/SchedulePage/DirectoryNode/
ComponentHandleNode/DateTimePicker). ZERO references to DraftBoard / DraftStroke / state.drafts / addDraft /
DraftsPage / DraftNode remain. Those unrelated locals were NOT touched.

## Item-by-item status
1. `TodoItem.isHandle` added (types.ts); `normalizeTodoItems` whitelist line added (store.ts ~line 242) so it
   round-trips load/import/restore; `toggleTodoItemHandle` signature + action added. DONE.
2. `computeBranchLineHeads` returns only `isHandle` nodes; `computeVisibleItemIds` seeds always-shown background
   then unions selected handles' reach; `BranchLineHead` doc + `未命名分线` fallback updated. DONE (Vitest skipped;
   gated by tsc + the tsx runtime run above).
3. `toggleTodoItemHandle` implemented: promote sets isHandle + clears isDirectory + prunes incoming edges; demote
   clears isHandle. `toggleTodoItemDirectory` clears isHandle when turning directory ON. One undo step each. DONE.
4. `addTodoEdge` rejects edges whose TARGET is a handle (single new line). DONE.
5. Verified (inspection): `addTodoEdge` lane-from-endpoints + `normalizeTodoEdges` presence-only already shipped
   (FEAT-001); not re-applied. DONE.
6/7. BoardNodeData.isHandle; nodes useMemo passes isHandle; BoardNode branches handle-first with a Flag glyph +
   violet dashed accent, OMITS the left/target Handle for handles, keeps the right/source Handle; TodoItemToolbar
   gains `showHandleToggle` + a 分线头/任务 button (hidden on directories, and directory toggle hidden on handles);
   BoardNode passes `showHandleToggle`. DONE.
8. `membersByHead` re-gated on `isHandle` (not indegree-0); fixed-origin dragSnapshot handlers unchanged. DONE.
   App.tsx sidebar already enumerates `computeBranchLineHeads` over `todoBranchFilter` (全选/全不选/多选/单选) — now
   lists handles with no App.tsx change needed; confirmed. DONE.
9/10. Drafts module fully deleted across App.tsx / types.ts / store.ts / dataBackup.ts; DraftsPage.tsx and
   DraftNode.tsx removed via `git rm`. Grep guardrail clean (see above). DONE.
