# Learning Planner Implementation Map

Date: 2026-05-03

This document maps the safest integration points for a new `Learning Planner` subsystem in the Alice project. It is an implementation plan only; no runtime code is changed here.

## 1. Existing Files And Modules Relevant To This Feature

### HUD and user entry

- `src/hud/pages/AutonomousLearningHudPage.jsx`
  - Current HUD page for learning.
  - Already has a textarea labeled "O que a Alice deve aprender?".
  - Submits `onAutonomousLearningAction('add-goal', { goal })`.
  - Best first UI integration point for planner request creation and planner status display.

- `src/App.jsx`
  - Owns `handleAutonomousLearningAction`.
  - Current `add-goal` flow:
    - calls `createAutonomousLearningGoalFromText`;
    - upserts the generated goal into `aliceMemory.autonomousLearning`;
    - commits memory;
    - triggers `runStartupAutonomousLearningLoop`.
  - Best application-level integration point for invoking the Learning Planner before goals/gaps become Runner tasks.

- `src/debugHud.js`
  - Builds the `debugHud.learningLoop` view model consumed by `AutonomousLearningHudPage`.
  - Best low-risk place to expose planner state, planner validation failures, rejected plans, accepted plans and task links without coupling the HUD directly to raw memory internals.

- `src/hud/AliceHud.jsx`
  - Routes HUD pages and passes `onAutonomousLearningAction`.
  - Likely does not need major changes unless a separate "Learning Planner" page/tab is introduced.

### Existing autonomous learning flow

- `src/autonomousLearningGoals.js`
  - Current heuristic goal-to-stage/gap mapper.
  - `createAutonomousLearningGoalFromText` parses user text locally into learning stages.
  - `createGapsFromLearningGoals` converts persisted goals into capability gaps.
  - This is the current fallback path and should remain available if the planner API is unavailable or returns an invalid plan.

- `src/autonomousCapabilityScanner.js`
  - Produces known gaps from memory, goals, observed targets and system state.
  - Any approved Learning Planner output should ultimately feed the same gap/task flow, not create an executor path around it.

- `src/autonomousLearningPlanner.js`
  - Despite the name, this currently converts a gap into an official Autonomous Runner task using controlled strategies.
  - Important existing function: `createAutonomousLearningTaskForGap`.
  - This should remain the gap-to-Runner-task compiler unless deliberately renamed later.
  - New model-backed planning should not be mixed into this file if that would blur responsibilities.

- `src/autonomousLearningLoop.js`
  - Main governed learning loop.
  - Processes completed Runner tasks through `validateLearningExperimentTask`.
  - Promotes validated experiments via `promoteLearningValidation`.
  - Enqueues official Runner tasks through `enqueueAutonomousRunnerMemoryTask`.
  - This is the correct Runner integration point after an approved planner plan has been normalized into learning gaps or task intents.

- `src/autonomousLearningPolicy.js`
  - Defines learning policy, blocked actions, allowed environments, rate limits and promotion rules.
  - The Learning Planner validator should reuse this policy and extend it only if planner-specific fields are needed.

- `src/autonomousLearningValidator.js`
  - Validates terminal learning tasks after Runner execution.
  - Requires Runner task status `done`, all step validations passed, physical evidence confirmed and `verify_runner_evidence`.
  - This is the right hook for post-execution evidence validation before any candidate or guarded procedure is created.

- `src/autonomousProcedurePromoter.js`
  - Creates `candidate` and `guarded` procedures from validated learning evidence.
  - Already avoids direct active promotion for new learning.
  - Should remain the only promotion path for Learning Planner results.

- `src/autonomousProcedureReuseEngine.js`, `src/autonomousProcedureOptimizer.js`, `src/autonomousReuseIndex.js`
  - Existing reuse and optimization paths.
  - New planner output should mark procedure dependencies and expected capabilities in a way that remains indexable here.

### Runner execution and evidence

- `src/autonomousTaskRunner.js`
  - Official executor tick for long-running or multistep tasks.
  - Acquires lease, executes steps, validates completion criteria, persists evidence and updates Runner state.
  - Must not be bypassed.

- `src/autonomousRunnerState.js`
  - Defines Runner task/step schemas, transitions, evidence refs, queue and state guards.
  - Important invariant: transition to `done` requires execution verification, validation passed and persisted evidence proof.
  - Learning Planner task conversion must produce valid Runner tasks/steps according to this schema.

- `src/autonomousRunnerPlanner.js`
  - Generates simple operational plans for tasks with command fields.
  - Useful fallback for simple command tasks, but model-generated learning plans should probably be converted explicitly instead of relying only on this generic autoplanner.

- `src/autonomousRunnerExecutor.js`
  - Executes Runner steps through Tauri tools:
    - `run_vm_guest_agent_action` for visual VM actions;
    - `run_local_vm_guest_task` for real VM command execution;
    - `run_local_workspace_playground_task` for controlled workspace fallback.
  - The Learning Planner must express work as Runner steps so this executor remains the only execution route.

- `src/autonomousRunnerEvidence.js`
  - Builds evidence refs and summarizes physical evidence status.
  - Learning Planner evaluation should consume these refs rather than storing large execution histories in memory.

- `src/autonomousRunnerToolExecutor.js`
  - Handles the public `manage_autonomous_runner` tool.
  - Useful if model/tool-call initiated learning needs to enqueue a planner-approved task through the same official Runner interface.

### Persistence

- `src/aliceMemory.js`
  - Owns normalized memory shape and pruning.
  - `autonomousLearning` currently stores goals, observed targets, gaps, recent experiments, candidates, procedures, generated scripts and audit logs.
  - Has explicit bounds, but it is still `alice-memory.json`, so planner request/response bodies should be summarized and capped here.
  - Best place for lightweight planner metadata only.

- `src/aliceMemoryPersistence.js`
  - Tauri-backed loading/saving for `alice-memory.json`.
  - Existing persistence diagnostics should be reused to monitor memory pressure.

- `src-tauri/src/lib.rs`
  - Provides `load_alice_memory_json`, `save_alice_memory_json`, `save_runner_evidence`, `verify_runner_evidence`.
  - Evidence files already live under app data `data/evidence/<executionId>/`.
  - If planner plan artifacts are large, a new app-data artifact store should be added here instead of embedding full model histories in `alice-memory.json`.

### Model/API integration

- `src/geminiLive.js`, `src/liveSessionOrchestrator.js`, `src/alice.js`
  - Current Live API stack handles conversation, tool declarations and tool responses.
  - `alice.js` already instructs the model to use `manage_autonomous_runner` for large tasks and not mark tasks complete without evidence.
  - The Learning Planner needs a separate strict structured planning request path. It should not rely on free-form chat output from the live session as the source of truth.

## 2. HUD Integration Point

The correct HUD entry point is the existing learning goal form in `src/hud/pages/AutonomousLearningHudPage.jsx`.

Recommended change:

- Keep the user-facing action in the Learning HUD.
- Replace or extend `onAutonomousLearningAction('add-goal', { goal })` with a planner-aware operation such as `plan-learning-goal`.
- In `src/App.jsx`, handle this operation by creating a planner request, calling the model/API, validating the structured plan, persisting only a compact planner record, then converting approved items into the existing learning/Runner pipeline.

Suggested UI state additions:

- planner request status: `idle | planning | validation_failed | approved | enqueued | failed`;
- latest planner reason/error;
- accepted plan summary;
- rejected plan summary;
- linked Runner task ids created from approved plan items;
- evidence/evaluation status after execution.

The HUD should not execute anything. It should only submit the learning objective, display planner state and expose manual controls already consistent with learning/Runner actions.

## 3. Runner Integration Point

The Runner integration should happen through the existing memory/Runner path:

1. User submits objective in HUD.
2. Learning Planner returns a strict structured plan.
3. Plan validator approves items.
4. Approved items are converted into either:
   - existing learning goals/gaps consumed by `runAutonomousLearningLoop`; or
   - direct official Runner task inputs that match `autonomousRunnerState` schema.
5. Tasks are enqueued with `enqueueAutonomousRunnerMemoryTask`.
6. `runAutonomousTaskRunnerTick` executes them.

Best integration locations:

- New planner orchestration module: receives user objective and returns approved planner state.
- `src/App.jsx`: calls planner orchestration from the HUD action and commits memory.
- `src/autonomousLearningLoop.js`: may consume planner-approved gaps or process terminal planner-created Runner tasks.
- `src/autonomousLearningPlanner.js`: should remain the compiler from approved learning gap/task intent to Runner task. If reused, add a clearly named function rather than embedding model-call logic there.

Hard constraint:

- Do not create a `Learning Planner Executor`.
- Do not call Tauri execution commands from the planner.
- Do not mark plan items complete when the model says they are complete.
- Completion must come from Runner state plus evidence verification.

## 4. Evidence Validation Hook

Evidence validation should stay in the existing post-Runner path:

- Runner persists evidence through `save_runner_evidence` in `src-tauri/src/lib.rs`.
- Runner attaches evidence refs via `src/autonomousRunnerEvidence.js`.
- Learning task validation happens in `src/autonomousLearningValidator.js`.
- Physical evidence is rechecked with `verify_runner_evidence`.
- Procedure promotion happens in `src/autonomousProcedurePromoter.js`.

The new learning evaluator should hook after `validateLearningExperimentTask`, not before it.

Recommended shape:

- `validateLearningExperimentTask` remains the hard evidence gate.
- Add `src/learningPlanner/learningEvaluator.js` to evaluate validated evidence against the planner item's intended skill:
  - confirms the task was created from an approved planner item;
  - checks all required evidence refs exist and are physically verified;
  - checks expected capability/outcome markers;
  - returns `candidate_allowed`, `guarded_allowed` or rejection reason.
- `promoteLearningValidation` should only be called when both evidence validation and planner-item evaluation pass.

This keeps the model out of the trusted evidence path.

## 5. Proposed File Structure

Recommended new files:

- `src/learningPlanner/contracts.js`
  - Strict schemas/constants for planner request, planner response, plan item, validation result and planner memory record.
  - Include version fields.

- `src/learningPlanner/modelClient.js`
  - Calls the selected model/API and requests structured output.
  - Must return raw response plus parsed candidate object.
  - Should be dependency-injected for tests.

- `src/learningPlanner/planValidator.js`
  - Validates strict structured planner output.
  - Enforces allowed environments, risk limits, blocked actions, no destructive commands, no completion claims, evidence requirements and bounded sizes.

- `src/learningPlanner/taskCompiler.js`
  - Converts approved plan items into existing learning goals/gaps or official Runner task inputs.
  - Must reuse `createAutonomousLearningTaskForGap` or `enqueueAutonomousRunnerMemoryTask` rather than creating a new executor.

- `src/learningPlanner/orchestrator.js`
  - High-level flow:
    - build request from HUD input and memory context;
    - call model client;
    - validate plan;
    - compile approved items;
    - return memory patch and task ids.

- `src/learningPlanner/evaluator.js`
  - Evaluates completed planner-backed tasks after `validateLearningExperimentTask`.
  - Returns whether skill can become procedure candidate/guarded candidate.

- `src/learningPlanner/memory.js`
  - Normalization and bounded persistence for planner records.
  - Store compact records only: ids, statuses, summaries, hashes, task ids, evidence refs, errors.

- `src/learningPlanner/index.js`
  - Public exports.

Recommended tests:

- `src/learningPlanner/planValidator.test.js`
- `src/learningPlanner/taskCompiler.test.js`
- `src/learningPlanner/orchestrator.test.js`
- `src/learningPlanner/evaluator.test.js`
- HUD/App integration tests can be added to:
  - `src/hud/AliceHud.test.jsx`
  - `src/App.test.js`
  - or a focused new test if current test organization supports it.

Optional native persistence files if planner artifacts become large:

- `src-tauri/src/learning_planner.rs`
  - Store raw planner request/response artifacts under app data, for example `data/learning-plans/<planId>/`.
  - Expose commands such as `save_learning_plan_artifact` and `load_learning_plan_artifact`.
  - Only add this if compact memory records are not enough.

## 6. Risks

- Naming collision: `src/autonomousLearningPlanner.js` already exists but is currently a task compiler, not a model-backed planner. New code should avoid overloading this file.

- Parallel execution risk: a model-generated plan may be tempting to execute directly. All executable actions must be compiled into official Runner tasks.

- False completion risk: the model may claim a plan item is done. The system must ignore model completion claims and rely only on Runner terminal state plus physical evidence.

- Evidence spoofing risk: planner output could include fake evidence refs. Evidence refs must be generated by Runner execution and confirmed by `verify_runner_evidence`.

- Memory growth risk: full prompts, full model responses or long histories can push `alice-memory.json` toward the 50 MiB limit. Store only compact planner metadata in memory and put bulky artifacts in app data if needed.

- Overbroad task risk: user objectives can be vague or unsafe. The planner validator must reject destructive, high-risk or unsupported items before enqueueing.

- Environment mismatch risk: current learning policy defaults to `allowedEnvironments: ['real_vm']`. Planner output must be checked against configured VM readiness and policy; workspace fallback must not be used when the item requires real VM.

- Promotion risk: new procedures must start as `candidate` or `guarded`, never `active`. Existing promotion code mostly enforces this for new learning, but duplicate procedure reinforcement must be reviewed so planner-backed candidates do not accidentally inherit active status without the required guarded path.

- Live session coupling risk: using the conversational Live API as the planner transport may produce non-deterministic, hard-to-test behavior. Prefer a small structured planning client with injectable transport and strict output validation.

## 7. Phased Implementation Plan

### Phase 1 - Contracts and validation only

- Add strict Learning Planner contracts.
- Add a pure plan validator.
- Validate:
  - required ids and version;
  - bounded string/list sizes;
  - allowed environments;
  - allowed action kinds;
  - required evidence policy;
  - no `completed`/`done` status from model output;
  - no destructive or blocked actions;
  - no direct execution instructions outside Runner.

No model calls and no Runner enqueueing in this phase.

### Phase 2 - Planner request/model client

- Add `modelClient` with dependency-injected transport.
- Build a structured planning request from:
  - user objective;
  - learning policy;
  - VM readiness summary;
  - existing procedures/candidates summary;
  - existing learning goals/gaps summary.
- Return parsed structured output, raw artifact metadata and validation result.

The model client must not mutate memory or enqueue tasks.

### Phase 3 - Memory state and HUD status

- Add compact planner memory records under `aliceMemory.autonomousLearning.learningPlanner` or a similarly bounded field.
- Extend memory normalization/pruning in `src/aliceMemory.js`.
- Extend `src/debugHud.js` and `AutonomousLearningHudPage.jsx` to show planner status.
- Wire HUD action in `src/App.jsx` to run the planner flow and persist compact status.

At the end of this phase, plans can be requested and validated but not executed.

### Phase 4 - Compile approved plan items to official Runner tasks

- Add `taskCompiler`.
- Convert each approved plan item into existing learning gaps or official Runner task input.
- Enqueue only through `enqueueAutonomousRunnerMemoryTask`.
- Add Runner audit events indicating planner origin.
- Record task ids back into compact planner memory.

Do not run steps directly from the planner.

### Phase 5 - Evidence-aware evaluation

- Add planner-backed evaluator after Runner completion.
- Reuse `validateLearningExperimentTask` and `verify_runner_evidence` as hard gates.
- Check planner item intent against validated evidence and task metadata.
- Only then allow `promoteLearningValidation`.
- Ensure generated procedures remain `candidate`/`guarded`.

### Phase 6 - Artifact persistence hardening

- If planner prompts/responses need retention, add app-data artifact persistence outside `alice-memory.json`.
- Store hashes and paths in memory, not full histories.
- Add retention and cleanup rules.

## 8. Tests Needed Per Phase

### Phase 1 tests

- `planValidator` accepts a minimal valid structured plan.
- Rejects missing schema version or malformed plan id.
- Rejects `completed`, `done` or model-claimed completion state.
- Rejects destructive command text and blocked policy actions.
- Rejects disallowed environment.
- Rejects plan item without evidence requirements.
- Rejects oversized strings/lists.

### Phase 2 tests

- `modelClient` sends a structured request with objective, policy and context.
- Parses valid structured model output.
- Surfaces invalid JSON/invalid schema as validation failure.
- Handles API/network failure without mutating memory.
- Does not include heavy memory fields in the request context.

### Phase 3 tests

- `aliceMemory` normalizes and prunes planner records.
- Planner record storage keeps compact fields and bounded arrays.
- `debugHud` formats planner status without exposing huge raw response bodies.
- HUD action calls the planner operation and displays validation errors.

### Phase 4 tests

- `taskCompiler` converts approved plan item into valid Runner task schema.
- Enqueued task has `metadata.createdBy` identifying the Learning Planner.
- Enqueued task includes required evidence policy and completion criteria.
- Compiler rejects plan items that would require a parallel executor.
- App/HUD integration commits memory and schedules the Runner wake-up only after successful validation.

### Phase 5 tests

- Evaluator rejects task not in `done`.
- Evaluator rejects task with missing step validation.
- Evaluator rejects missing or non-physical evidence.
- Evaluator calls `verify_runner_evidence`.
- Evaluator rejects evidence refs not produced by Runner.
- Evaluator allows candidate/guarded only after validated Runner evidence.
- Promotion test confirms no planner-backed procedure becomes `active` directly.

### Phase 6 tests

- Native artifact path sanitization rejects traversal.
- Saving planner artifact writes under app data only.
- Memory stores artifact refs/hashes, not full raw histories.
- Retention cleanup preserves linked evidence required by active candidates/guarded procedures.

## Recommended First Code Touches

When implementation begins, the first code changes should be pure and low-risk:

1. `src/learningPlanner/contracts.js`
2. `src/learningPlanner/planValidator.js`
3. `src/learningPlanner/planValidator.test.js`

Only after those pass should the project add model calls, HUD wiring or Runner enqueueing.
