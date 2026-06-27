use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

pub(crate) const MAX_TARGET_CHARS: usize = 120;
pub(crate) const MAX_TYPE_TEXT_CHARS: usize = 10_000;
pub(crate) const MAX_SHELL_OUTPUT_CHARS: usize = 12_000;
pub(crate) const DEFAULT_SHELL_TIMEOUT_MS: u64 = 10_000;
pub(crate) const MAX_SHELL_TIMEOUT_MS: u64 = 600_000;

#[derive(Debug, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DesktopAction {
    OpenApp {
        app: String,
    },
    OpenFolder {
        folder: String,
    },
    MouseMove {
        x: f64,
        y: f64,
        #[serde(rename = "captureWidth")]
        capture_width: Option<i32>,
        #[serde(rename = "captureHeight")]
        capture_height: Option<i32>,
    },
    MouseClick {
        button: String,
        x: Option<f64>,
        y: Option<f64>,
        #[serde(rename = "captureWidth")]
        capture_width: Option<i32>,
        #[serde(rename = "captureHeight")]
        capture_height: Option<i32>,
    },
    ClickTarget {
        target: String,
        button: String,
    },
    TypeText {
        text: String,
    },
    PressHotkey {
        hotkey: String,
    },
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopActionResult {
    pub(crate) ok: bool,
    pub(crate) message: String,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NativeCommandResult {
    pub(crate) ok: bool,
    pub(crate) message: String,
    pub(crate) stdout: Option<String>,
    pub(crate) stderr: Option<String>,
    pub(crate) artifacts: Option<Value>,
}

#[derive(Debug, Deserialize, PartialEq)]
#[serde(tag = "domain", content = "action", rename_all = "snake_case")]
pub enum LocalAction {
    WindowUi(WindowUiAction),
    AppsProcesses(AppsProcessAction),
    Filesystem(FilesystemAction),
    Shell(ShellAction),
}

#[derive(Debug, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum WindowUiAction {
    FocusWindow {
        app: Option<String>,
        #[serde(rename = "windowTitle")]
        window_title: Option<String>,
    },
    ResolveTarget {
        target: String,
    },
    ClickTarget {
        target: String,
        button: Option<String>,
    },
    ClickCoordinates {
        button: Option<String>,
        x: f64,
        y: f64,
        #[serde(rename = "captureWidth")]
        capture_width: Option<i32>,
        #[serde(rename = "captureHeight")]
        capture_height: Option<i32>,
    },
    Scroll {
        #[serde(rename = "deltaX")]
        delta_x: Option<i32>,
        #[serde(rename = "deltaY")]
        delta_y: Option<i32>,
    },
    Hotkey {
        hotkey: String,
    },
    PressKey {
        key: String,
    },
    TypeText {
        text: String,
    },
    ReadVisualContext {},
}

#[derive(Debug, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AppsProcessAction {
    OpenApp {
        app: String,
    },
    FocusApp {
        app: String,
    },
    CloseWindow {
        #[serde(rename = "windowTitle")]
        window_title: Option<String>,
        app: Option<String>,
    },
    CloseApp {
        app: String,
    },
    KillProcess {
        #[serde(rename = "processName")]
        process_name: String,
    },
    ListWindows {},
    ListProcesses {},
}

#[derive(Debug, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum FilesystemAction {
    ResolvePath {
        location: Option<String>,
        path: Option<String>,
        name: Option<String>,
    },
    OpenPath {
        path: String,
    },
    CreateFile {
        path: Option<String>,
        location: Option<String>,
        name: String,
    },
    CreateFolder {
        path: Option<String>,
        location: Option<String>,
        name: String,
    },
    CopyPath {
        #[serde(rename = "sourcePath")]
        source_path: String,
        #[serde(rename = "targetPath")]
        target_path: String,
    },
    MovePath {
        #[serde(rename = "sourcePath")]
        source_path: String,
        #[serde(rename = "targetPath")]
        target_path: String,
    },
    RenamePath {
        path: String,
        #[serde(rename = "targetPath")]
        target_path: String,
    },
    DeletePath {
        path: String,
    },
    WriteFile {
        path: String,
        content: String,
        overwrite: Option<bool>,
    },
    AppendFile {
        path: String,
        content: String,
    },
}

#[derive(Debug, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ShellAction {
    RunShellCommand {
        command: String,
        args: Vec<String>,
        #[serde(rename = "workingDirectory")]
        working_directory: String,
        #[serde(rename = "timeoutMs")]
        timeout_ms: Option<u64>,
        env: Option<HashMap<String, String>>,
    },
}
