# Implementation Plan — Unified Todo Board, Handle-Rooted Branch-Lines

Worktree (absolute): `/Users/cici/Desktop/project/Planner/.worktrees/todo-unified-board`
Approved design: `.agents/tasks/todo-unified-board/design.md` (handle-rooted model, APPROVED — `design-review.json`, 0 HIGH / 0 MEDIUM / 2 NIT).

This plan implements the APPROVED handle-rooted design. It does NOT re-decide architecture. It is a CONTINUATION
of an aborted build: FEAT-001 and FEAT-002 are already committed on `feat/todo-unified-board` against the OLD
indegree-0 head model, so most items below MODIFY already-committed code rather than create it. Every item is tagged:

- **[NEW EDIT]** — genuinely new or modified code this pass must write.
- **[VERIFY ONLY]** — already shipped on the branch; confirm it matches the design, do NOT re-apply.

All paths are relative to the worktree root unless marked absolute. Every item must leave the worktree buildable.

## Build / test commands (discovered from package.json)

- Lint / typecheck (the gating check): `npm run lint` → runs `tsc --noEmit`.
- Build: `npm run build` → runs `vite build`.
- Dev server: `npm run dev` → `vite --port=3123 --host=0.0.0.0` (port **3123**).
- No test runner is configured (scripts are dev/build/preview/clean/lint; no `test`, no Vitest). The pure-helper
  unit tests are a recommended Vitest add (see item 2); if Vitest is not added, the helpers must still pass `tsc --noEmit`.

Dependencies live under the **main repo root** `node_modules` (the worktree shares it). FEAT-001's Verification Log
already confirmed `npm run lint` / `npm run build` run from inside the worktree against that shared `node_modules`.
Do NOT add new runtime dependencies. Only one optional dev dependency (Vitest) is in scope, and only for item 2.

## What is already committed (do NOT rebuild — tags below say verify vs edit)

- **FEAT-001 (commit 007bb0e):** `src/todoBranchLines.ts` pure helpers (`buildTodoGraph`, `computeBranchLineHeads`,
  `reachableFrom`, `computeVisibleItemIds`) under the **OLD indegree-0 head model**; store `todoBranchFilter` +
  `setTodoBranchFilter` wiring (persisted, excluded from `HISTORY_KEYS`); `addTodoEdge` rewritten to resolve the edge
  lane from its endpoints; `normalizeTodoEdges` relaxed to presence-only endpoint checks.
- **FEAT-002 (commit a921c13):** Todo page is the unified four-view container (画板/甘特图/看板/日程) driven by a shared
  `visibleItemIds` memo; `TodoBoard`/`TodoGantt`/`SchedulePage`/`BoardCanvas` take `visibleItemIds` instead of a `lane`
  prop; fixed-origin rigid-drag scaffolding present (gated on indegree-0); `App.tsx` sidebar rebuilt as a branch-line
  filter (全选/全不选/多选/单选); standalone 日程 menu item removed and `SchedulePage` re-homed as the schedule view.
  All of this was wired against the OLD indegree-0 helpers.
- **草稿 (drafts) module deletion: NOT done** — still to implement (item 10).

The genuinely-new work this pass is: the `isHandle` node kind end-to-end, the handle-rooted rewrite of the two pure
helpers, the two toggle actions + mutual-exclusivity, the `addTodoEdge` handle-target guard, the always-show-background
visibility rule, re-gating rigid drag + the sidebar on handles, BoardNode handle rendering, and the drafts deletion.

## Verification evidence requirement (MANDATORY for the coder)

After each item that changes code, run `npm run lint` and record the result. Before hand-off, run `npm run build`
and exercise the running dev server (`npm run dev`, port 3123) through the integration checklist in item 9. Record
WHAT you ran and the RESULT (pass/fail + key output) in a `## Verification Log` section appended to THIS plan.md.
The reviewer reads this evidence instead of re-running the suites, so it must be concrete (commands + outcomes).

---

- [ ] 1. **[NEW EDIT]** Add the persisted `isHandle` node kind to the data model and make it durable.
      Add `isHandle?: boolean;` to the `TodoItem` interface (alongside `isDirectory?: boolean`). In `src/store.ts`'s
      `normalizeTodoItems` field whitelist (~line 241, right beside `isDirectory: item.isDirectory === true ? true : undefined`)
      add `isHandle: item.isHandle === true ? true : undefined,`. CRITICAL: `normalizeTodoItems` rebuilds every item from
      this whitelist on initial load (~line 531) AND on `restoreFromBackup` (~line 1120); without this line every
      user-created handle is silently dropped on load/import/restore, collapsing all branch-lines back to background.
      Backup export serializes `todoItems` wholesale (no per-field whitelist in `dataBackup.ts`), so the whitelist is the
      only drop point. Also add the `AppState` signature `toggleTodoItemHandle: (itemId: string) => void;` next to
      `toggleTodoItemDirectory` (its implementation is item 3).
      Files: `src/types.ts`, `src/store.ts`.
      Verify: `npm run lint` fails ONLY with "toggleTodoItemHandle not implemented" on `src/store.ts` (expected until item 3).

- [ ] 2. **[NEW EDIT]** Rewrite the two pure helpers in `src/todoBranchLines.ts` to the handle-rooted model; optionally add Vitest.
      `buildTodoGraph` and `reachableFrom` are UNCHANGED. Rewrite `computeBranchLineHeads` to return ONLY `isHandle === true`
      items — `items.filter((i) => i.isHandle === true).sort((a,b) => a.order - b.order || a.id.localeCompare(b.id)).map((i) => ({ id: i.id, label: i.text?.trim() || '未命名分线' }))` — no longer consulting indegree. The FEAT-001
      `未命名 / 未命名目录` two-branch label fallback is intentionally replaced by the single `未命名分线` (handles are the
      only heads now; see design-review NIT #2). Keep the second parameter (rename to `_edges`): heads no longer depend on
      edges, but `App.tsx` and the sidebar pass `todoEdges` positionally, so do NOT change the arity (`noUnusedLocals` is OFF).
      Rewrite `computeVisibleItemIds(items, edges, filter)` to the design's REVISED block: `null` ⇒ `null`; otherwise compute
      `inSomeBranchLine` = union of `reachableFrom(h)` over EVERY handle, seed `visible` with all nodes NOT in
      `inSomeBranchLine` (the always-shown no-branch-line background), then add `reachableFrom(headId)` for each SELECTED,
      still-valid handle (skip `!byId.get(headId)` or `head.isHandle !== true`). Net effect vs FEAT-001: `[]` ⇒ background-only
      (not blank), subset ⇒ those handles' reach ∪ background, `null` ⇒ all. Also update the `BranchLineHead` doc comment.
      Optionally add Vitest as a devDependency + a `"test": "vitest run"` script and rewrite/author `src/todoBranchLines.test.ts`
      for the handle-rooted cases (worked example A/F as handles; no-branch-line always-shown rule with isolated Z and
      handle-less chain P→Q; head = handle NOT indegree-0; edge-render set {F}={F→B,B→D,B→E}, {A,F}=all five; lone handle;
      handle feeding a cycle terminates; dangling edge skipped; stale/demoted filter id ignored; empty graph). If Vitest is
      skipped (it was in FEAT-001 — not in the shared `node_modules`), note that in the Verification Log; the helpers then
      stand on `tsc` alone.
      Files: `src/todoBranchLines.ts`; optionally `package.json`, `src/todoBranchLines.test.ts`.
      Verify: `npm run lint` passes (module typechecks; `target: ES2022` so Set spread/iteration compile with no `--downlevelIteration`). If Vitest added, `npm run test` — all handle-rooted specs pass.

- [ ] 3. **[NEW EDIT]** Add the `toggleTodoItemHandle` store action and enforce handle↔directory mutual exclusivity in BOTH toggles.
      In `src/store.ts`, beside `toggleTodoItemDirectory` (~line 1367), add `toggleTodoItemHandle` with the design's exact body:
      on promotion set `isHandle: true` and clear `isDirectory` (`isDirectory: undefined`); on demotion set `isHandle: undefined`;
      AND when promoting (`makingHandle`), prune every edge whose `targetItemId` is this node (`todoEdges: makingHandle ? state.todoEdges.filter((e) => e.targetItemId !== itemId) : state.todoEdges`) so the "a handle has no incoming edge"
      invariant (rule 1) holds immediately for pre-existing edges. It touches `todoItems` and `todoEdges` (both `HISTORY_KEYS`)
      ⇒ one undo step. Also MODIFY `toggleTodoItemDirectory` (~line 1367) to clear `isHandle` when it turns directory ON:
      insert `isHandle: !item.isDirectory ? undefined : item.isHandle,` into the mapped object (`!item.isDirectory` is the
      "making directory" direction already used for `isDirectory: !item.isDirectory`). This makes the store the single owner
      of "at most one of handle/directory" from both toggles (review finding #4). No filter cleanup is needed on demote/delete —
      `computeVisibleItemIds` ignores stale/non-handle filter ids.
      Files: `src/store.ts`.
      Verify: `npm run lint` passes (item-1 `toggleTodoItemHandle` signature now satisfied; no "not implemented" error).

- [ ] 4. **[NEW EDIT]** Add the handle-target guard to `addTodoEdge`.
      In `src/store.ts`'s `addTodoEdge` (~line 1377), immediately after the endpoint lookup (`const src = …; const tgt = …; if (!src || !tgt) return {};`) add the single line `if (tgt.isHandle === true) return {}; // HANDLE INVARIANT: a handle can never be an edge target (rule 1)`. This is the ONLY new line in `addTodoEdge` — the lane-from-endpoints
      resolution (`lanesOf`/common-lane/`?? src.laneId`) and the lane-agnostic duplicate check are ALREADY present (FEAT-001,
      verify only — do NOT re-apply). Handle-as-SOURCE stays allowed (that is how a branch-line extends from its head); only the
      TARGET is rejected. Together with item 3's incoming-edge pruning, this is the complete two-point enforcement of rule 1.
      Files: `src/store.ts`.
      Verify: `npm run lint` passes. Runtime confirmation (edge into a handle is rejected) is in item 9.

- [ ] 5. **[VERIFY ONLY]** Confirm `addTodoEdge` lane-from-endpoints + `normalizeTodoEdges` presence-only are already shipped.
      Do NOT edit. Confirm `addTodoEdge` (~line 1377) resolves the lane from endpoints (`lanesOf`, common-lane, `?? src.laneId`)
      with a lane-agnostic duplicate check, and that `normalizeTodoEdges` (~line 258) rejects an edge only on non-string/unknown
      `laneId`, equal endpoints, or a missing endpoint (`!itemById.has(...)`) — with NO primary-`laneId`-equality clause, so
      cross-lane edges survive reload. These were committed in FEAT-001. If either has drifted from this description, STOP and
      flag it (the handle guard in item 4 assumes this baseline).
      Files: none (inspection of `src/store.ts`).
      Verify: visual confirmation against the design's "Edge lane model"; the cross-lane-edge reload round-trip in item 9 exercises `normalizeTodoEdges`.

- [ ] 6. **[NEW EDIT]** Wire the `isHandle` node kind through `BoardNode`/`BoardCanvas` in `src/components/TodoPage.tsx`.
      (a) Add `isHandle?: boolean` to the `BoardNodeData` interface (~line 740), beside `isDirectory?: boolean`.
      (b) In the `nodes` useMemo node-mapping `data: { … }` object (~line 841, which currently ends `…, isDirectory: item.isDirectory }`)
      add `isHandle: item.isHandle`.
      (c) In the `BoardNode` body (~line 752) branch handle-FIRST (`data.isHandle ? <handle> : data.isDirectory ? <directory> : <task>`),
      rendering the handle with a distinct accent + a handle glyph (lucide `Flag` or `GitBranch`, consistent with the board
      switcher). When `data.isHandle`, OMIT the left/target `<Handle position={Position.Left} …>` (currently unconditional at
      ~line 774) — a handle takes no incoming edge, so a target port would invite a rejected connection. KEEP the right/source
      `<Handle position={Position.Right} …>` (~line 797) for all three kinds.
      (d) Pass `showHandleToggle` to `BoardNode`'s `TodoItemToolbarHost` (mirroring the existing `showDirectoryToggle` at ~line 799)
      so the 分线头/任务 toggle appears only on the canvas.
      Files: `src/components/TodoPage.tsx`.
      Verify: `npm run lint` passes (will fail until item 7 adds the toolbar prop/button it references — run items 6 and 7 together if lint is strict).

- [ ] 7. **[NEW EDIT]** Add the 分线头/任务 (handle) toggle to `TodoItemToolbar`.
      In `src/components/TodoItemToolbar.tsx` add an optional `showHandleToggle` prop and, when set, a toggle button parallel to
      the existing `showDirectoryToggle` "目录/任务" button — label 分线头/任务, calling the new `toggleTodoItemHandle(itemId)`
      store action. Only the canvas `BoardNode` (item 6d) passes `showHandleToggle`; `TodoBoard`/`TodoGantt` do not, so the
      handle toggle never appears in kanban/gantt. Optional UX nicety (NOT required, store owns the invariant): hide the
      directory toggle when `data.isHandle` and the handle toggle when `data.isDirectory`.
      Files: `src/components/TodoItemToolbar.tsx`.
      Verify: `npm run lint` passes (items 6 and 7 together leave TodoPage/toolbar consistent).

- [ ] 8. **[NEW EDIT]** Re-gate rigid branch-line drag and the sidebar filter on `isHandle` (not indegree-0).
      This is one coherent item spanning the two head-definition-dependent surfaces committed in FEAT-002 against the OLD model.
      (a) In `src/components/TodoPage.tsx`, change the `membersByHead` memo (~line 844) gate from indegree-0 to handles: replace
      the indegree check with `if (it.isHandle !== true) continue;` so ONLY handle nodes rigid-drag their branch-line; the memo
      still builds from the FULL graph (`buildTodoGraph(allItems, allEdges)`) and still `reach.delete(it.id)` so hidden members
      move too. The fixed-origin `dragSnapshot` ref and the `onNodeDragStart`/`onNodeDrag`/`onNodeDragStop` handlers (one undo
      step via `beginHistoryGroup`/`endHistoryGroup`; off-screen members repositioned from stored position + the fixed delta)
      are UNCHANGED from FEAT-002 — do NOT rewrite them, only change what qualifies as a draggable head.
      (b) In `src/App.tsx`, the sidebar already calls `computeBranchLineHeads(todoItems, todoEdges)` and renders 全选 (`setBranchFilter(null)`)
      / 全不选 (`setBranchFilter([])`) / per-head checkbox (多选) / label-click (单选) / `暂无分线` empty state over the shared
      `todoBranchFilter` (FEAT-002, verify only). Because item 2 rewrote `computeBranchLineHeads` to return handles, the list now
      enumerates HANDLE nodes labelled `未命名分线` by fallback with NO App.tsx edit required — CONFIRM this is all that changes
      (the list reacts to handle create/delete/rename/toggle, not to ordinary edge changes). If any sidebar code still assumes
      indegree-0 head semantics, fix it here.
      Files: `src/components/TodoPage.tsx`; verify `src/App.tsx`.
      Verify: `npm run lint` passes. Rigid-drag-moves-only-handles and the handle-only sidebar list are exercised in item 9.

- [ ] 9. **[NEW EDIT]** Integration verification on the running dev server (handle-rooted behaviours).
      Run `npm run build` (must succeed) and `npm run lint` (must pass), then `npm run dev` (port 3123) and walk the design's
      "Integration (manual click-through)" checklist, verifying the HANDLE-SPECIFIC behaviours this pass introduced:
      create a node and promote it via the 分线头 toggle ⇒ it appears in the sidebar list; connecting an edge INTO a handle is
      rejected (no edge); promoting a node that already has an incoming edge drops that edge; the handle flag survives a page
      reload (create handle → reload → still a handle, still listed — confirms item 1's whitelist); a task/directory reachable
      from NO handle is ALWAYS shown regardless of 全选/全不选 (the new always-show-background rule); 全选/全不选/单选/多选 update
      the board AND the other three views identically; switching views preserves the selection; dragging a handle rigidly moves
      its whole branch-line INCLUDING currently-hidden members (verify by re-showing them) and a shared node moves with the
      dragged handle only; dragging a NON-handle moves only that node; connecting a scheduled task (now on a calendar lane)
      succeeds AND that edge survives a page reload (confirms item 5's `normalizeTodoEdges`); the schedule view shows only
      filtered items; the 日程 menu item is gone and schedule is reachable only via the view switcher. Run the worked example:
      A and F as HANDLES, edges A→B, A→C, B→D, B→E, F→B ⇒ select-A {A,B,C,D,E}, select-F {F,B,D,E}, shared {B,D,E}.
      Record every command and result in the `## Verification Log`.
      Files: none (verification only); append results to the Verification Log.
      Verify: build + lint pass and every checklist item behaves as described; evidence recorded for the reviewer. (A headless CLI
      cannot click through a browser; in that case record structural coverage — `tsc` + `vite build` + live module transforms —
      and leave the browser walk-through to a human/reviewer via `npm run dev`, as FEAT-002 did.)

- [ ] 10. **[NEW EDIT]** Fully delete the 草稿 (drafts) module across the shared files (still pending).
      Single same-pattern deletion batched as one item. Delete `src/components/DraftsPage.tsx` and `src/components/DraftNode.tsx`
      outright (`DraftNode` is used only by `DraftsPage` via `nodeTypes = { draftNode: DraftNode }`; confirm no other importer).
      In `src/App.tsx`: remove `'drafts'` from `MenuId`, the `{ id: 'drafts' … FilePenLine }` `menuItems` entry, the
      `) : activeMenu === 'drafts' ? ( <Suspense …><DraftsPage /></Suspense>` branch, the `DraftsPage` lazy import, and the
      `FilePenLine` lucide import (final `MenuId = 'task-pool' | 'bom' | 'time-templates'`). In `src/types.ts`: delete
      `DraftStrokePoint`/`DraftStroke`/`DraftBoard`, the `drafts: DraftBoard[]` field, and the 11 draft action signatures
      (`addDraft`, `renameDraft`, `deleteDraft`, `addDraftNode`, `updateDraftNodes`, `removeDraftNode`, `addDraftEdge`,
      `removeDraftEdge`, `addDraftStroke`, `replaceDraftStrokes`, `clearDraftStrokes`) + their comment. In `src/store.ts`: remove
      `DraftBoard, DraftStroke` from the `./types` import; the `drafts` load block; `initialDrafts` + its state entry; `'drafts'`
      from the `HistorySnapshot` key union AND `HISTORY_KEYS`; the `drafts` line in `captureHistorySnapshot`; the `drafts` line in
      `persistState`'s `toSave`; the `drafts` block in `restoreFromBackup`; the `drafts:` key in BOTH `deleteTask` return branches
      (~line 1692 AND ~line 1723 — removing only one leaves a dangling `state.drafts` reference); the `drafts: []` in
      `clearWorkspace` (~line 2205); and all 11 action implementations. In `src/dataBackup.ts`: delete the `withoutDraftStrokes`
      helper and the `drafts` serialize line, and change `return withoutDraftStrokes(parsed.data);` to `return parsed.data;`.
      GUARDRAIL: after removal, grep `src/` for `[Dd]raft`; the ONLY remaining matches must be the UNRELATED editing-buffer locals
      (`draftColor`/`hexDraft`/`setDraftColor`/`setHexDraft` in `ColorPicker.tsx`; `draft`/`setDraft`/`draftTitle`/`draftStart`/`draftEnd`
      in `TodoPage.tsx`/`TodoBoard.tsx`/`TaskNode.tsx`/`TodoTimeLabel.tsx`/`SchedulePage.tsx`) — DO NOT touch those. Confirm zero
      references to `DraftBoard`/`DraftStroke`/`state.drafts`/`addDraft`/`DraftsPage`/`DraftNode`.
      Files: delete `src/components/DraftsPage.tsx`, `src/components/DraftNode.tsx`; edit `src/App.tsx`, `src/types.ts`,
      `src/store.ts`, `src/dataBackup.ts`.
      Verify: `npm run lint` AND `npm run build` pass; backup export/import round-trips with no `drafts` key AND with `isHandle`
      preserved; record in the Verification Log.

## Verify-only surfaces already shipped in FEAT-002 (confirm, do NOT re-apply)

These are part of the unified-board work committed in FEAT-002 against the OLD model but are head-definition-INDEPENDENT,
so they need no handle-rooted change — only a confirmation pass:

- `TodoViewSwitcher` has the fourth `'schedule'` view (`CalendarRange`, `text-emerald-600`), `onBack` optional.
- `TodoBoard` / `TodoGantt` take `visibleItemIds: Set<string> | null` with set-membership filtering; `../taskTimeBlocks`
  fully removed from `TodoBoard`; `TodoGantt` imports only `{ formatLocalDateTime, parseTaskTime }` and its header is the
  static literal `甘特图` (no `lane` reference); both resolve `mainLaneId` internally.
- `SchedulePage` takes optional `visibleItemIds`, filters `scopedItems` before `collectEvents`, embeds
  `<TodoGantt visibleItemIds={…} />`; no `ganttLane` memo remains; lane-provisioning effects unchanged (benign per design).
- `TodoPage` is the unified four-view container (default `laneView='board'`, `<TodoViewSwitcher>` with no `onBack`, all four
  views wired, `SchedulePage` lazy-imported), `visibleItemIds` via `computeVisibleItemIds(todoItems, todoEdges, branchFilter)`
  passed to every view; `BoardCanvas` takes `visibleItemIds`, filters nodes by set membership and edges by both-endpoints-visible,
  resolves `mainLaneId` with the "laneId is a hint only" connect comment; fixed-origin `dragSnapshot` rigid-drag scaffolding present.
- `App.tsx` sidebar is the branch-line filter (全选/全不选/多选/单选, `暂无分线` empty state) over `todoBranchFilter`; the standalone
  日程 menu item, its render branch, App-level `SchedulePage` lazy import, and `CalendarDays` icon import are all removed.

If any of the above has drifted from the design, note it in the Verification Log; otherwise just confirm.

## Suggested item ordering / dependencies

1 → 2 → 3 → 4 (data model, helpers, actions, edge guard: each leaves lint green with the next pending). 5 is a pure
inspection and can run anytime. 6 + 7 ship together (toolbar prop/button referenced by BoardNode). 8 depends on 2 (handle
heads) and 6 (isHandle on items). 9 is end-to-end verification after 1–8. 10 (drafts deletion) is independent of the handle
work and may run last; it shares `App.tsx`/`types.ts`/`store.ts`/`dataBackup.ts` with the handle edits, so doing it last
avoids merge churn in those files.

## Assumptions / gaps

- No test runner exists; item 2's Vitest is recommended but optional (it was skipped in FEAT-001 because Vitest is not in
  the shared repo-root `node_modules`). If skipped again, the pure helpers are gated by `tsc --noEmit` only — note it in the log.
- Line numbers are approximate ("~line N"); the referenced constructs were located in the worktree and match the design's
  pinned anchors. Use the described construct/symbol, not the literal line.
- Design-review NITs are non-blocking: (#1) handle promotion does not reset directory-inflated width/height — cosmetic only,
  leave as-is unless trivially addressed; (#2) the single `未命名分线` fallback replacing the FEAT-001 two-branch label is
  intentional (item 2).
- The List/band drill-in code in `TodoPage` stays in the file (not routed to by default) to keep the diff focused; removing
  it is out of scope.

## Verification Log

All items 1–10 implemented this pass. Evidence (full detail in `verification.md`):

- `npm run lint` (tsc --noEmit): **PASS**, exit 0, no dangling refs after drafts deletion + isHandle wiring.
- `npm run build` (vite build): **PASS**, 1858 modules transformed, built in ~1.4s, no unresolved imports.
- Pure-helper runtime check via `tsx` on the REAL `computeBranchLineHeads`/`computeVisibleItemIds` (throwaway
  `src/__verify_branchlines.ts`, since deleted): **8/8 PASS**. Worked example A/F as handles: heads={A,F};
  select-A⇒{A,B,C,D,E}∪background; select-F⇒{F,B,D,E}∪background; multi=union; null=all; []=background-only
  {Z,P,Q}; shared handle-rooted={B,D,E}; stale filter id ignored. The NEW always-show-background rule confirmed.
- `npm run dev` (vite --port=3123): **boots clean** (ready in 226 ms). All touched modules transform 200
  (main.tsx, App.tsx, store.ts, todoBranchLines.ts, TodoPage.tsx). App.tsx transformed output has 0 "DraftsPage"
  matches; TodoPage has the `showHandleToggle` wiring; DraftsPage.tsx/DraftNode.tsx are gone from disk. Server
  stopped after the check. A headless agent cannot click a browser, so the interactive walk-through (board default
  view, handle create/drag, four-view filter sync, reload persistence) is left to a human/reviewer via `npm run dev`
  — the tsc + build + live-transform + exact worked-example helper run cover the logic each behaviour depends on.
- Drafts grep guardrail: `grep -rn "[Dd]raft" src/` returns ONLY the unrelated editing-buffer locals; zero
  DraftBoard/DraftStroke/state.drafts/addDraft/DraftsPage/DraftNode references remain; those locals untouched.
