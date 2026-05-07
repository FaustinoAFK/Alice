# Diagramas Mermaid

## 1. Arquitetura geral

```mermaid
flowchart LR
  User[Usuario] --> HUD[React HUD]
  HUD --> App[App.jsx]
  App --> Live[Gemini Live]
  App --> Memory[aliceMemory]
  App --> Tools[Roteador de tools]
  App --> Tauri[Tauri/Rust]
  Tools --> Knowledge[Conhecimento web]
  Tools --> MindMap[Mind map]
  Tools --> Autonomy[Autonomia/Learning]
  Tools --> Runner[Autonomous Task Runner]
  Knowledge --> Tauri
  Autonomy --> Tauri
  Runner --> Tauri
  Tauri --> Edge[Edge extension bridge]
  Tauri --> VM[Hyper-V/VirtualBox]
  VM --> Guest[Python Guest Agent]
  Tauri --> Evidence[data/evidence]
  Memory --> HUD
```

## 2. Inicializacao

```mermaid
sequenceDiagram
  participant Main as main.jsx
  participant App as App.jsx
  participant Tauri as Tauri lib.rs
  participant Memory as aliceMemory.js
  participant HUD as AliceHud
  Main->>App: render
  App->>Tauri: load_alice_memory_json
  Tauri-->>App: memory json
  App->>Memory: normalize/upgrade/prune
  App->>App: hydrate runner/autonomy/mind map
  App->>Tauri: get_local_vm_status
  App->>HUD: render snapshots/callbacks
```

## 3. Conversa

```mermaid
sequenceDiagram
  participant HUD
  participant App
  participant Tauri
  participant Gemini
  HUD->>App: start live
  App->>Tauri: create_gemini_live_url
  App->>App: getDisplayMedia/getUserMedia
  App->>Gemini: setup + audio + frames
  Gemini-->>App: audio/transcript/toolCall
  App->>App: route tool queue
  App-->>Gemini: toolResponse
  App-->>HUD: captions/status/debug
```

## 4. Tool call

```mermaid
flowchart TD
  A[Gemini functionCall] --> B[App enqueueToolCalls]
  B --> C{Nome da tool}
  C --> K[knowledgeToolExecutor]
  C --> M[mindMapToolExecutor]
  C --> L[autonomousLearningToolExecutor]
  C --> R[autonomousRunnerToolExecutor]
  K --> T[Tauri invoke]
  L --> T
  R --> T
  M --> Mem[aliceMemory/mind map]
  T --> Resp[Resposta]
  Mem --> Resp
  Resp --> Env[LiveSessionTransport envelope]
  Env --> Gemini[Gemini toolResponse]
```

## 5. Autonomous Task Runner

```mermaid
flowchart TD
  Q[Task na fila] --> N[Normalize/recover]
  N --> S[Scheduler escolhe eligible]
  S --> P[Planner se planned]
  P --> F[Preflight]
  F -->|ok| L[Acquire lease/lock]
  F -->|falha| B[blocked/waiting_retry/failed]
  L --> H[Heartbeat]
  H --> X[Execute step]
  X --> V[Validate criteria]
  V --> E[Save + verify evidence]
  E -->|ok| D[step done/task ready ou done]
  E -->|falha| R[retry/failed/blocked]
  D --> Rel[Release lease]
  R --> Rel
  Rel --> HUD[Memoria + HUD + audit]
```

## 6. VM + guest agent

```mermaid
flowchart LR
  App --> Status[get_local_vm_status]
  Status --> Decide{VM ready?}
  Decide -->|real VM| GuestTask[run_local_vm_guest_task]
  Decide -->|visual| VmVisual[vm_visual.rs]
  VmVisual --> Agent[Guest Agent Python]
  Agent --> Screen[capture_screen]
  Agent --> Input[mouse/keyboard/type]
  Agent --> Bg[background command]
  Decide -->|fallback permitido| Workspace[autonomous_playground]
  Decide -->|nao permitido| Block[blocked]
```

## 7. Evidencias

```mermaid
flowchart TD
  Exec[executionResult] --> Refs[buildRunnerEvidenceFromExecution]
  Refs --> Save[save_runner_evidence]
  Save --> Files[metadata/stdout/stderr/validation]
  Files --> Verify[verify_runner_evidence]
  Verify -->|ok| Attach[attach refs + done allowed]
  Verify -->|falha| Fail[evidence_persistence_failed]
```

## 8. Memoria

```mermaid
flowchart TD
  Load[Tauri load_alice_memory_json] --> Normalize[aliceMemory normalize]
  Normalize --> Ref[aliceMemoryRef]
  Ref --> HUD
  Ref --> LiveSetup
  Ref --> Runner
  Tools --> Commit[commitAliceMemory]
  Runner --> Commit
  MindMap --> Commit
  Commit --> SaveTimer[debounced save]
  SaveTimer --> Save[Tauri save_alice_memory_json]
```

## 9. HUD

```mermaid
flowchart TD
  App[App.jsx snapshots] --> AliceHud
  AliceHud --> Sidebar
  AliceHud --> TopBar
  AliceHud --> LivePage
  AliceHud --> KnowledgePage
  AliceHud --> MindMapPage
  AliceHud --> AutonomyPage
  AliceHud --> LearningPage
  AliceHud --> RunnerPage
  AliceHud --> DebugPage
  TopBar --> AppCallbacks[callbacks App]
  RunnerPage --> AppCallbacks
  MindMapPage --> AppCallbacks
```

## 10. Mind map

```mermaid
flowchart TD
  Memory[aliceMemory.mindMaps] --> Editor[MindMapEditor]
  Tool[update_mind_map] --> Executor[mindMapToolExecutor]
  Executor --> Data[mindMapData normalize/history]
  Editor --> Data
  Data --> Layout[layout dagre]
  Data --> Export[export JSON/Markdown]
  Runner[Runner task/execution] --> Sync[syncMindMapWithRunnerTask/Execution]
  Sync --> Memory
  Data --> Memory
```

## 11. Frontend React x backend Tauri/Rust

```mermaid
flowchart LR
  React[React App] -->|invoke| Commands[Tauri commands]
  Commands --> MemoryFile[alice-memory.json]
  Commands --> Evidence[data/evidence]
  Commands --> WebBridge[127.0.0.1:38947 web knowledge]
  Commands --> LocalVm[Hyper-V/VirtualBox]
  Commands --> HostFiles[host snapshots/rollback]
  Commands --> Sidecar[Python sidecar]
  WebBridge --> Edge[Edge extension]
```

## 12. Dependencias criticas

```mermaid
flowchart TB
  App --> alice
  App --> aliceMemory
  App --> geminiLive
  App --> liveSessionOrchestrator
  App --> knowledgeToolExecutor
  App --> mindMapToolExecutor
  App --> autonomousLearningToolExecutor
  App --> autonomousRunnerToolExecutor
  App --> autonomousTaskRunner
  App --> AliceHud
  autonomousTaskRunner --> autonomousRunnerState
  autonomousTaskRunner --> autonomousRunnerLease
  autonomousTaskRunner --> autonomousRunnerPreflight
  autonomousTaskRunner --> autonomousRunnerExecutor
  autonomousTaskRunner --> autonomousRunnerEvidence
  autonomousTaskRunner --> autonomousRunnerValidation
  TauriLib[src-tauri/src/lib.rs] --> web_knowledge
  TauriLib --> local_vm
  TauriLib --> vm_visual
  TauriLib --> autonomous_playground
  TauriLib --> host_versioning
```
