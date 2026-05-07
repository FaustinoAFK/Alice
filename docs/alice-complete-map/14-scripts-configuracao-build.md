# Scripts, configuracao e build

            ## package.json

            Projeto privado ESM `alice-virtual`. Scripts:

            - `dev`: `vite`
- `dev:open`: `vite --host 127.0.0.1 --port 5174 --strictPort --open`
- `app`: `tauri dev`
- `app:log`: `powershell -NoProfile -ExecutionPolicy Bypass -File ./start-alice.ps1 -LogPath tauri-alice-run.log`
- `app:build`: `tauri build`
- `build`: `vite build`
- `lint`: `eslint .`
- `test`: `vitest run`
- `preview`: `vite preview`
- `audit:alice`: `node scripts/alice-code-auditor.mjs --once`
- `audit:alice:watch`: `node scripts/alice-code-auditor.mjs --watch`
- `runner:harness`: `node scripts/runner-harness.mjs`
- `learning:harness`: `node scripts/learning-planner-harness.mjs`

            ## Dependencias principais

            Runtime: `@tauri-apps/api`, `@xyflow/react`, `dagre`, `html-to-image`, `lucide-react`, `react`, `react-dom`, `uuid`. Dev: Tauri CLI, Vite, Vitest, ESLint, React plugin e globals.

            ## Vite/React

            `vite.config.js` usa React plugin, servidor em `127.0.0.1:5174`, strictPort, ignora `src-tauri/**` no watch e configura Vitest. `index.html` aponta para `src/main.jsx`.

            ## ESLint

            `eslint.config.js` usa `@eslint/js`, hooks, refresh e globals de browser. Ignora builds e backend Tauri.

            ## Tauri/Cargo

            `src-tauri/Cargo.toml` define dependencias Rust e feature `desktop-commands`. `src-tauri/tauri.conf.json` define produto, devUrl, beforeDevCommand, beforeBuildCommand, frontendDist e capabilities. `src-tauri/capabilities/default.json` lista permissoes Tauri.

            ## Scripts e docs existentes

            `start-alice.ps1` inicia app com log. `scripts/alice-code-auditor.mjs` gera auditoria de codigo. `scripts/runner-harness.mjs` e `scripts/learning-planner-harness.mjs` sobem harness via Vite. Docs existentes cobrem Runner hardening, dev harness, handoff de learning e learning planner map.

            ## Variaveis de ambiente mencionadas

            - Gemini: `GEMINI_API_KEY`, `GOOGLE_API_KEY`.
            - VM: `ALICE_LOCAL_VM_PROVIDER`, `ALICE_LOCAL_VM_NAME`, `ALICE_LOCAL_VM_USER`, `ALICE_LOCAL_VM_USERNAME`, `ALICE_LOCAL_VM_PASSWORD`, `ALICE_LOCAL_VM_ENABLE_GUEST_RUN`, `ALICE_VBOXMANAGE_PATH`, `ALICE_VM_GUEST_PYTHON`.
            - Sidecar/guest: `ALICE_PYTHON_SIDECAR_PATH`, `ALICE_PYTHON_BIN`, `ALICE_UI_TARGET`, `ALICE_GUEST_TASKS_DIR`.
            - Internas de execucao guest: `ALICE_VM_GUEST_ARGS_JSON`, `ALICE_VM_GUEST_COMMAND`.

            ## Comandos uteis

            ```powershell
            npm install
            npm run dev
            npm run app
            npm run app:log
            npm test
            npm run lint
            npm run build
            npm run app:build -- --no-bundle
            npm run runner:harness -- verify-safe-state
            npm run learning:harness
            cd src-tauri; cargo test
            ```
