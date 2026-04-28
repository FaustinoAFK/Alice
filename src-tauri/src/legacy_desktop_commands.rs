use crate::python_sidecar;
use crate::{
    normalize_python_sidecar_error, perform_desktop_action, perform_local_action,
    validate_desktop_action, validate_local_action, DesktopAction, DesktopActionResult,
    LocalAction, NativeCommandResult,
};

#[tauri::command]
pub(crate) fn execute_desktop_action(action: DesktopAction) -> Result<DesktopActionResult, String> {
    validate_desktop_action(&action)?;
    let message = perform_desktop_action(&action)?;
    Ok(DesktopActionResult { ok: true, message })
}

#[tauri::command]
pub(crate) fn execute_local_action(action: LocalAction) -> Result<NativeCommandResult, String> {
    validate_local_action(&action)?;
    perform_local_action(&action)
}

#[tauri::command]
pub(crate) fn get_foreground_context() -> Result<NativeCommandResult, String> {
    let response = python_sidecar::get_foreground_context()?;
    if !response.ok {
        return Err(normalize_python_sidecar_error(
            response.error_code.as_deref(),
            &response.message,
        ));
    }

    Ok(NativeCommandResult {
        ok: true,
        message: response.message,
        stdout: response.stdout,
        stderr: response.stderr,
        artifacts: response.artifacts,
    })
}
