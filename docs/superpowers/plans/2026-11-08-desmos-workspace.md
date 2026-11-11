# Shared Desmos Workspace Implementation Plan

**Goal:** Match the user's reference: opening Desmos reserves a left pane and keeps the full question and responses in a separate right pane everywhere in SAT.

**Architecture:** A shared calculator workspace owns the responsive layout and iframe lifetime. SAT tools expose calculator state and the formula sheet separately; every SAT learning/question surface uses that workspace.

**Tech Stack:** React, TypeScript, Tailwind, official public Desmos embeds.

**Spec:** User's two reference screenshots and request from 2026-11-08 in this chat.

## Constraints and review focus

- No calculator overlay covering the question; separate scrolling for the two panes.
- Closed calculator restores the ordinary question layout.
- Preserve entered graphs while hiding/showing or switching calculator modes.
- Use official graphing/scientific pages without API keys or trial credentials.
- Do not submit student answers or change grading, content or progress while verifying.

## Tasks

- [x] Replace floating calculator with a shared left-calculator/right-content workspace and Graphing/Scientific modes.
- [x] Apply the workspace to the bank, test modules, path lessons, skill pages, drills and SAT Blitz.
- [x] Typecheck/build; verify the bank and path in the browser, plus other reachable SAT surfaces.
- [x] Capture screenshots and commit the final change locally.

Execution: direct implementation in this session, following the user's instruction.

## Validation

- TypeScript and Vite build pass; existing CAD externalization and large-chunk warnings remain.
- Math rendering regression check passes for 15,868 texts across all 2,751 active SAT questions.
- Browser: bank, path lesson and hard Math drill show calculator left / task right without overlap. Closing restores sidebar and standard question layout.
- Graphing and Scientific load successfully. A temporary `y=x` graph survives mode changes and closing/reopening the pane.
- No student answers submitted; XP shown before and after the checks is 140. Test-module and Blitz integration verified through typechecking/build and shared workspace code review; no timed student test was started for QA.
