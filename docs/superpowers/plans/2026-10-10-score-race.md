# 同关竞技 Implementation Plan

> **For agentic workers:** Use executing-plans to implement task-by-task in the existing workspace; preserve the V2 source backup. No Git reset or branch switch.

**Goal:** Deliver a playable local player-versus-rule-AI score race with fair seeded encounters.

**Architecture:** A separate React race screen owns two independent GameData objects and one fixed-step match clock. A prebuilt encounter schedule supplies cloned enemies, deterministic per-enemy drops and separately seeded hazards. Existing physics and art remain shared; optional race markers suppress normal wave spawning and progression writes. A local controller uses only current scene state.

**Tech Stack:** TypeScript, React, Canvas, Vitest, Playwright/Edge.

- [x] Back up V2 source with per-file hashes using `backup_v2_source.py`.
- [x] Add `src/game/race/race.test.ts`: deterministic schedule despite kills, same input parity, pause/time/death/tie rules, no normal storage writes, bounded AI inputs. Run Vitest and confirm the missing modules fail.
- [x] Add `src/game/race/match.ts` for seeded schedule and round lifecycle; add `controller.ts` for current-state rule AI. Optional `race` and `raceSeed` fields allow existing physics without normal progression or wave scheduler.
- [x] Modify engine, hazards, combat and run-progress only at race integration points. Preserve baseline solo behavior. Run targeted tests.
- [x] Add `src/app/race/RaceApp.tsx` and CSS; provide start, pause, rematch, new seed, local-AI labels, mobile scene switch, player touch/keyboard controls and isolated results history. Add a hash-based entry to App.
- [x] Run full Vitest, both TypeScript checks, changed-file ESLint and Vite build. Verify real browser start, controls, pause, AI movement, mobile switching and ordinary V2 entry. Use simulation tests for full 180-second time and storage behavior.
- [x] Package the built HTML plus art and instructions, create a one-click launcher, verify package and preserve V1/V2 hashes. Report clearly that Pyramid is not connected.
