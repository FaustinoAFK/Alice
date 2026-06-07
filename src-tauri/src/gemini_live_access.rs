use serde::Serialize;

const GEMINI_LIVE_WS_ENDPOINT: &str =
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiLiveAccess {
    url: String,
}

pub(crate) fn gemini_api_key_from_env() -> Result<String, String> {
    std::env::var("GEMINI_API_KEY")
        .or_else(|_| std::env::var("GOOGLE_API_KEY"))
        .map_err(|_| {
            "GEMINI_API_KEY nao encontrada nas variaveis de ambiente. Reinicie o VS Code/terminal depois de criar a variavel.".to_string()
        })
}

pub(crate) fn build_gemini_live_url(api_key: &str) -> String {
    format!(
        "{GEMINI_LIVE_WS_ENDPOINT}?key={}",
        urlencoding::encode(api_key)
    )
}

#[tauri::command]
pub fn create_gemini_live_url() -> Result<GeminiLiveAccess, String> {
    Ok(GeminiLiveAccess {
        url: build_gemini_live_url(&gemini_api_key_from_env()?),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn live_url_uses_v1beta_websocket_endpoint_with_encoded_api_key() {
        let url = build_gemini_live_url("key with spaces");

        assert_eq!(
            url,
            "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=key%20with%20spaces"
        );
    }
}
