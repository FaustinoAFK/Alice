export const isTauriRuntime = (targetWindow = globalThis.window) =>
  Boolean(
    targetWindow?.__TAURI_INTERNALS__ ||
    targetWindow?.__TAURI__ ||
    targetWindow?.__TAURI_IPC__,
  );
