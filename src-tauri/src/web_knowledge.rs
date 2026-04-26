use crate::NativeCommandResult;
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::io::{Cursor, Read};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::State;
use tiny_http::{Header, Method, Response, Server, StatusCode};
use url::Url;

const WEB_KNOWLEDGE_BRIDGE_PORT: u16 = 38947;
const MAX_SEARCH_RESULTS: usize = 10;
const MAX_INSPECT_SECTIONS: usize = 8;
const MAX_PAGE_SECTIONS: usize = 40;
const MAX_PAGE_LINKS: usize = 30;
const HTTP_TIMEOUT_SECS: u64 = 10;
const MAX_NAVIGATION_CONTEXT_AGE_MS: u64 = 15_000;
const MAX_PAGE_SNAPSHOT_AGE_MS: u64 = 15_000;
const DEFAULT_REFRESH_TIMEOUT_MS: u64 = 2_000;
const MAX_REFRESH_TIMEOUT_MS: u64 = 10_000;
const CAPTURE_WAIT_POLL_MS: u64 = 50;
const CAPTURE_EVENT_HEARTBEAT_MS: u64 = 5_000;
const CAPTURE_EVENT_RETRY_MS: u64 = 1_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum KnowledgeSufficiency {
    Sufficient,
    Partial,
    Insufficient,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NavigationContext {
    pub url: String,
    pub domain: String,
    pub title: String,
    pub selection_text: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PageLink {
    pub text: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PageSection {
    pub id: String,
    pub kind: String,
    pub heading: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PageSnapshot {
    pub url: String,
    pub title: String,
    pub meta_description: String,
    pub document_language: String,
    pub selected_text: String,
    pub interactive_labels: Vec<String>,
    pub sections: Vec<PageSection>,
    pub links: Vec<PageLink>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserPageStatePayload {
    request_id: Option<String>,
    transport: Option<String>,
    navigation_context: NavigationContextPayload,
    snapshot: Option<PageSnapshotPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NavigationContextPayload {
    url: String,
    domain: Option<String>,
    title: Option<String>,
    selection_text: Option<String>,
    selected_text: Option<String>,
    timestamp: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageSnapshotPayload {
    url: Option<String>,
    title: Option<String>,
    meta_description: Option<String>,
    document_language: Option<String>,
    selected_text: Option<String>,
    interactive_labels: Option<Vec<String>>,
    sections: Option<Vec<PageSectionPayload>>,
    links: Option<Vec<PageLinkPayload>>,
    timestamp: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageSectionPayload {
    id: Option<String>,
    kind: Option<String>,
    heading: Option<String>,
    content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageLinkPayload {
    text: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct BrowserKnowledgeRuntimeState {
    navigation_context: Option<NavigationContext>,
    page_snapshot: Option<PageSnapshot>,
    pending_capture: Option<PendingCaptureRequest>,
    last_completed_capture_request_id: Option<String>,
    last_capture_transport: Option<String>,
    last_extension_seen_at: Option<u64>,
    capture_event_subscribers: Vec<mpsc::Sender<Vec<u8>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct PendingCaptureRequest {
    request_id: String,
    requested_at: u64,
    expires_at: u64,
    reason: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct CaptureRequestEventPayload {
    request_id: String,
    reason: String,
    requested_at: u64,
    expires_at: u64,
}

struct CaptureEventStream {
    receiver: mpsc::Receiver<Vec<u8>>,
    pending: Cursor<Vec<u8>>,
    heartbeat_interval_ms: u64,
}

type HttpResponse = Response<Box<dyn Read + Send>>;

#[derive(Clone, Default)]
pub struct WebKnowledgeState {
    inner: Arc<Mutex<BrowserKnowledgeRuntimeState>>,
}

impl CaptureEventStream {
    fn new(receiver: mpsc::Receiver<Vec<u8>>) -> Self {
        Self::new_with_heartbeat(receiver, CAPTURE_EVENT_HEARTBEAT_MS)
    }

    fn new_with_heartbeat(receiver: mpsc::Receiver<Vec<u8>>, heartbeat_interval_ms: u64) -> Self {
        Self {
            receiver,
            pending: Cursor::new(Vec::new()),
            heartbeat_interval_ms,
        }
    }
}

impl Read for CaptureEventStream {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        if buf.is_empty() {
            return Ok(0);
        }

        loop {
            let position = self.pending.position() as usize;
            let inner = self.pending.get_ref();
            if position < inner.len() {
                return self.pending.read(buf);
            }

            match self
                .receiver
                .recv_timeout(Duration::from_millis(self.heartbeat_interval_ms))
            {
                Ok(chunk) => {
                    self.pending = Cursor::new(chunk);
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    self.pending = Cursor::new(build_sse_event(
                        "heartbeat",
                        json!({
                            "ts": current_timestamp_ms(),
                        }),
                    ));
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => return Ok(0),
            }
        }
    }
}

impl WebKnowledgeState {
    fn normalize_pending_capture(
        pending_capture: &mut Option<PendingCaptureRequest>,
        now: u64,
    ) -> Option<PendingCaptureRequest> {
        let is_expired = pending_capture
            .as_ref()
            .map(|request| request.expires_at <= now)
            .unwrap_or(false);
        if is_expired {
            *pending_capture = None;
            return None;
        }

        pending_capture.clone()
    }

    fn fresh_snapshot(&self) -> BrowserKnowledgeRuntimeState {
        let now = current_timestamp_ms();
        let mut guard = self
            .inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        Self::normalize_pending_capture(&mut guard.pending_capture, now);

        let navigation_is_fresh = guard
            .navigation_context
            .as_ref()
            .map(|context| is_timestamp_fresh(context.timestamp, now, MAX_NAVIGATION_CONTEXT_AGE_MS))
            .unwrap_or(false);

        if !navigation_is_fresh {
            guard.navigation_context = None;
            guard.page_snapshot = None;
            return guard.clone();
        }

        let snapshot_is_fresh = guard
            .page_snapshot
            .as_ref()
            .map(|snapshot| {
                is_timestamp_fresh(snapshot.timestamp, now, MAX_PAGE_SNAPSHOT_AGE_MS)
                    && guard
                        .navigation_context
                        .as_ref()
                        .map(|context| snapshot.url == context.url)
                        .unwrap_or(false)
            })
            .unwrap_or(false);

        if !snapshot_is_fresh {
            guard.page_snapshot = None;
        }

        guard.clone()
    }

    fn pending_capture_request(&self) -> Option<PendingCaptureRequest> {
        let now = current_timestamp_ms();
        let mut guard = self
            .inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        Self::normalize_pending_capture(&mut guard.pending_capture, now)
    }

    fn subscribe_capture_events(&self) -> mpsc::Receiver<Vec<u8>> {
        let (sender, receiver) = mpsc::channel::<Vec<u8>>();
        let pending_request = {
            let now = current_timestamp_ms();
            let mut guard = self
                .inner
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let pending_request = Self::normalize_pending_capture(&mut guard.pending_capture, now);
            guard.capture_event_subscribers.push(sender.clone());
            pending_request
        };

        let _ = sender.send(build_sse_event(
            "connected",
            json!({
                "ok": true,
                "retryMs": CAPTURE_EVENT_RETRY_MS,
            }),
        ));

        if let Some(request) = pending_request {
            let _ = sender.send(build_capture_request_event(&request));
        }

        receiver
    }

    fn begin_capture_request(&self, timeout_ms: u64, reason: &str) -> PendingCaptureRequest {
        let now = current_timestamp_ms();
        let normalized_timeout = timeout_ms.clamp(1, MAX_REFRESH_TIMEOUT_MS);
        let request = PendingCaptureRequest {
            request_id: format!("capture-{}-{normalized_timeout}", now),
            requested_at: now,
            expires_at: now.saturating_add(normalized_timeout),
            reason: reason.to_string(),
        };

        let mut guard = self
            .inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        guard.last_completed_capture_request_id = None;
        guard.last_capture_transport = None;
        guard.pending_capture = Some(request.clone());
        drop(guard);

        self.broadcast_capture_event(build_capture_request_event(&request));
        request
    }

    fn apply_page_state(
        &self,
        navigation_context: NavigationContext,
        page_snapshot: Option<PageSnapshot>,
        request_id: Option<&str>,
        transport: Option<&str>,
    ) {
        let now = current_timestamp_ms();
        let mut guard = self
            .inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        Self::normalize_pending_capture(&mut guard.pending_capture, now);
        guard.navigation_context = Some(navigation_context);
        guard.last_extension_seen_at = Some(now);
        if let Some(snapshot) = page_snapshot {
            guard.page_snapshot = Some(snapshot);
        }

        if let (Some(pending), Some(request_id)) = (&guard.pending_capture, request_id) {
            if pending.request_id == request_id {
                guard.last_completed_capture_request_id = Some(request_id.to_string());
                guard.last_capture_transport = transport
                    .map(|value| value.trim())
                    .filter(|value| !value.is_empty())
                    .map(|value| value.to_string());
                guard.pending_capture = None;
            }
        }
    }

    fn broadcast_capture_event(&self, payload: Vec<u8>) {
        let mut guard = self
            .inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        guard
            .capture_event_subscribers
            .retain(|sender| sender.send(payload.clone()).is_ok());
    }

    fn has_completed_capture_request(&self, request_id: &str) -> bool {
        let guard = self
            .inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        guard
            .last_completed_capture_request_id
            .as_deref()
            .map(|current| current == request_id)
            .unwrap_or(false)
    }
}

fn content_type_header() -> Header {
    Header::from_bytes(&b"Content-Type"[..], &b"application/json; charset=utf-8"[..]).unwrap()
}

fn cors_header() -> Header {
    Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap()
}

fn sse_content_type_header() -> Header {
    Header::from_bytes(&b"Content-Type"[..], &b"text/event-stream; charset=utf-8"[..]).unwrap()
}

fn no_cache_header() -> Header {
    Header::from_bytes(&b"Cache-Control"[..], &b"no-cache"[..]).unwrap()
}

fn connection_keep_alive_header() -> Header {
    Header::from_bytes(&b"Connection"[..], &b"keep-alive"[..]).unwrap()
}

fn build_sse_event(event: &str, payload: Value) -> Vec<u8> {
    let data = serde_json::to_string(&payload).unwrap_or_else(|_| "{\"ok\":false}".to_string());
    format!("event: {event}\ndata: {data}\n\n").into_bytes()
}

fn build_capture_request_event(request: &PendingCaptureRequest) -> Vec<u8> {
    build_sse_event(
        "capture_request",
        json!(CaptureRequestEventPayload {
            request_id: request.request_id.clone(),
            reason: request.reason.clone(),
            requested_at: request.requested_at,
            expires_at: request.expires_at,
        }),
    )
}

fn json_response(status: u16, payload: Value) -> HttpResponse {
    let body = serde_json::to_vec(&payload).unwrap_or_else(|_| b"{\"ok\":false}".to_vec());
    let body_len = body.len();
    Response::new(
        StatusCode(status),
        vec![content_type_header(), cors_header()],
        Box::new(Cursor::new(body)),
        Some(body_len),
        None,
    )
}

fn sse_response(stream: CaptureEventStream) -> HttpResponse {
    Response::new(
        StatusCode(200),
        vec![
            sse_content_type_header(),
            cors_header(),
            no_cache_header(),
            connection_keep_alive_header(),
        ],
        Box::new(stream),
        None,
        None,
    )
}

pub fn start_browser_knowledge_bridge(state: WebKnowledgeState) -> Result<(), String> {
    let server = Server::http(("127.0.0.1", WEB_KNOWLEDGE_BRIDGE_PORT))
        .map_err(|error| format!("Falha ao iniciar a ponte local de conhecimento web: {error}"))?;

    thread::spawn(move || {
        for mut request in server.incoming_requests() {
            let response = match (request.method(), request.url()) {
                (&Method::Get, "/health") => json_response(
                    200,
                    json!({
                        "ok": true,
                        "message": "bridge_alive",
                    }),
                ),
                (&Method::Get, "/v1/capture-request") => {
                    let pending_request = state.pending_capture_request();
                    json_response(
                        200,
                        json!({
                            "ok": true,
                            "pendingRequest": pending_request,
                        }),
                    )
                }
                (&Method::Get, "/v1/capture-events") => {
                    let stream = CaptureEventStream::new(state.subscribe_capture_events());
                    sse_response(stream)
                }
                (&Method::Post, "/v1/page-state") => {
                    let mut body = String::new();
                    let parse_result = request.as_reader().read_to_string(&mut body);
                    match parse_result {
                        Ok(_) => match serde_json::from_str::<BrowserPageStatePayload>(&body) {
                            Ok(payload) => match normalize_browser_page_state(payload) {
                                Ok((request_id, transport, context, snapshot)) => {
                                    state.apply_page_state(
                                        context,
                                        snapshot,
                                        request_id.as_deref(),
                                        transport.as_deref(),
                                    );
                                    json_response(
                                        200,
                                        json!({
                                            "ok": true,
                                            "message": "page_state_updated",
                                        }),
                                    )
                                }
                                Err(error) => json_response(
                                    400,
                                    json!({
                                        "ok": false,
                                        "message": error,
                                    }),
                                ),
                            },
                            Err(error) => json_response(
                                400,
                                json!({
                                    "ok": false,
                                    "message": format!("Payload invalido da extensao: {error}"),
                                }),
                            ),
                        },
                        Err(error) => json_response(
                            500,
                            json!({
                                "ok": false,
                                "message": format!("Falha ao ler payload da extensao: {error}"),
                            }),
                        ),
                    }
                }
                (&Method::Options, _) => json_response(
                    204,
                    json!({
                        "ok": true,
                    }),
                )
                .with_header(Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, POST, OPTIONS"[..]).unwrap())
                .with_header(Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type"[..]).unwrap()),
                _ => json_response(
                    404,
                    json!({
                        "ok": false,
                        "message": "route_not_found",
                    }),
                ),
            };

            let _ = request.respond(response);
        }
    });

    Ok(())
}

fn normalize_browser_page_state(
    payload: BrowserPageStatePayload,
) -> Result<
    (
        Option<String>,
        Option<String>,
        NavigationContext,
        Option<PageSnapshot>,
    ),
    String,
> {
    let url = normalize_url(&payload.navigation_context.url)
        .ok_or_else(|| "URL da pagina atual invalida.".to_string())?;
    let domain = resolve_domain(
        Some(payload.navigation_context.domain.as_deref().unwrap_or("")),
        &url,
    )
    .ok_or_else(|| "Nao consegui resolver o dominio da pagina atual.".to_string())?;
    let title = normalize_text(payload.navigation_context.title.as_deref().unwrap_or(""));
    let selection_text = normalize_text(
        payload
            .navigation_context
            .selection_text
            .as_deref()
            .or(payload.navigation_context.selected_text.as_deref())
            .unwrap_or(""),
    );
    let timestamp = payload.navigation_context.timestamp.unwrap_or(0);

    let navigation_context = NavigationContext {
        url: url.clone(),
        domain,
        title,
        selection_text: selection_text.clone(),
        timestamp,
    };

    let snapshot = payload
        .snapshot
        .map(|snapshot| normalize_page_snapshot(snapshot, &navigation_context))
        .transpose()?;

    Ok((
        payload
            .request_id
            .map(|request_id| normalize_text(&request_id))
            .filter(|request_id| !request_id.is_empty()),
        payload
            .transport
            .map(|transport| normalize_text(&transport))
            .filter(|transport| !transport.is_empty()),
        navigation_context,
        snapshot,
    ))
}

fn normalize_page_snapshot(
    payload: PageSnapshotPayload,
    context: &NavigationContext,
) -> Result<PageSnapshot, String> {
    let url = normalize_url(payload.url.as_deref().unwrap_or(&context.url))
        .ok_or_else(|| "URL do snapshot da pagina invalida.".to_string())?;
    let title = normalize_text(payload.title.as_deref().unwrap_or(&context.title));
    let meta_description = normalize_text(payload.meta_description.as_deref().unwrap_or(""));
    let document_language = normalize_text(payload.document_language.as_deref().unwrap_or(""));
    let selected_text = normalize_text(payload.selected_text.as_deref().unwrap_or(&context.selection_text));
    let interactive_labels = payload
        .interactive_labels
        .unwrap_or_default()
        .into_iter()
        .map(|item| normalize_text(&item))
        .filter(|item| !item.is_empty())
        .take(40)
        .collect::<Vec<_>>();
    let sections = payload
        .sections
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .filter_map(|(index, section)| normalize_page_section(section, index))
        .take(MAX_PAGE_SECTIONS)
        .collect::<Vec<_>>();
    let links = payload
        .links
        .unwrap_or_default()
        .into_iter()
        .filter_map(normalize_page_link)
        .take(MAX_PAGE_LINKS)
        .collect::<Vec<_>>();
    let timestamp = payload.timestamp.unwrap_or(context.timestamp);

    Ok(PageSnapshot {
        url,
        title,
        meta_description,
        document_language,
        selected_text,
        interactive_labels,
        sections,
        links,
        timestamp,
    })
}

fn normalize_page_section(section: PageSectionPayload, index: usize) -> Option<PageSection> {
    let heading = normalize_text(section.heading.as_deref().unwrap_or(""));
    let content = normalize_text(section.content.as_deref().unwrap_or(""));
    if heading.is_empty() && content.is_empty() {
        return None;
    }

    Some(PageSection {
        id: normalize_text(section.id.as_deref().unwrap_or(&format!("section-{index}"))),
        kind: normalize_text(section.kind.as_deref().unwrap_or("text")),
        heading,
        content,
    })
}

fn normalize_page_link(link: PageLinkPayload) -> Option<PageLink> {
    let text = normalize_text(link.text.as_deref().unwrap_or(""));
    let url = normalize_url(link.url.as_deref().unwrap_or(""))?;
    if text.is_empty() && url.is_empty() {
        return None;
    }

    Some(PageLink { text, url })
}

fn normalize_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ").trim().to_string()
}

fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn is_timestamp_fresh(timestamp: u64, now: u64, max_age_ms: u64) -> bool {
    timestamp > 0 && now.saturating_sub(timestamp) <= max_age_ms
}

fn normalize_url(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    Url::parse(trimmed)
        .ok()
        .map(|mut parsed| {
            parsed.set_fragment(None);
            parsed.to_string()
        })
}

fn resolve_domain(explicit_domain: Option<&str>, url: &str) -> Option<String> {
    let explicit = normalize_text(explicit_domain.unwrap_or(""));
    if !explicit.is_empty() {
        return Some(explicit);
    }

    Url::parse(url)
        .ok()
        .and_then(|parsed| parsed.domain().map(|domain| domain.to_string()))
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .user_agent("AliceVirtual/0.1")
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|error| format!("Falha ao criar cliente HTTP da Alice: {error}"))
}

fn duckduckgo_search(query: &str, max_results: usize) -> Result<Vec<SearchResult>, String> {
    let client = http_client()?;
    let response = client
        .get("https://duckduckgo.com/html/")
        .query(&[("q", query)])
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|error| format!("Falha ao pesquisar na web: {error}"))?;

    let html = response
        .text()
        .map_err(|error| format!("Falha ao ler resposta da busca web: {error}"))?;

    Ok(parse_duckduckgo_results(&html, max_results))
}

fn parse_duckduckgo_results(html: &str, max_results: usize) -> Vec<SearchResult> {
    let document = Html::parse_document(html);
    let result_selector = Selector::parse(".result").unwrap();
    let title_selector = Selector::parse(".result__title a, a.result__a").unwrap();
    let snippet_selector = Selector::parse(".result__snippet").unwrap();
    let mut unique_urls = HashSet::new();
    let mut results = Vec::new();

    for result in document.select(&result_selector) {
        let Some(link) = result.select(&title_selector).next() else {
            continue;
        };
        let title = normalize_text(&link.text().collect::<Vec<_>>().join(" "));
        let raw_url = link.value().attr("href").unwrap_or("");
        let Some(url) = resolve_search_result_url(raw_url) else {
            continue;
        };
        let canonical_url = canonicalize_url(&url);
        if !unique_urls.insert(canonical_url) {
            continue;
        }
        let snippet = result
            .select(&snippet_selector)
            .next()
            .map(|item| normalize_text(&item.text().collect::<Vec<_>>().join(" ")))
            .unwrap_or_default();

        results.push(SearchResult { title, url, snippet });
        if results.len() >= max_results {
            break;
        }
    }

    results
}

fn resolve_search_result_url(value: &str) -> Option<String> {
    let normalized = normalize_url(value)?;
    let parsed = Url::parse(&normalized).ok()?;
    if parsed.domain().unwrap_or_default().contains("duckduckgo.com") {
        for (key, value) in parsed.query_pairs() {
            if key == "uddg" {
                return normalize_url(&value);
            }
        }
    }
    Some(parsed.to_string())
}

fn canonicalize_url(value: &str) -> String {
    match Url::parse(value) {
        Ok(mut parsed) => {
            parsed.set_fragment(None);
            parsed.to_string()
        }
        Err(_) => value.to_string(),
    }
}

fn fetch_and_extract_page(url: &str) -> Result<PageSnapshot, String> {
    let normalized_url =
        normalize_url(url).ok_or_else(|| "URL invalida para leitura da pagina.".to_string())?;
    let client = http_client()?;
    let response = client
        .get(&normalized_url)
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|error| format!("Falha ao ler pagina web: {error}"))?;

    let final_url = response.url().to_string();
    let html = response
        .text()
        .map_err(|error| format!("Falha ao ler HTML da pagina web: {error}"))?;

    extract_page_snapshot_from_html(&final_url, &html)
}

fn extract_page_snapshot_from_html(url: &str, html: &str) -> Result<PageSnapshot, String> {
    let normalized_url =
        normalize_url(url).ok_or_else(|| "URL final da pagina web invalida.".to_string())?;
    let document = Html::parse_document(html);
    let title_selector = Selector::parse("title").unwrap();
    let meta_description_selector = Selector::parse("meta[name='description']").unwrap();
    let html_selector = Selector::parse("html").unwrap();
    let link_selector = Selector::parse("a[href]").unwrap();
    let heading_selector = Selector::parse("h1, h2, h3, h4, h5, h6").unwrap();
    let text_block_selector = Selector::parse("main p, article p, section p, p, blockquote, pre").unwrap();
    let list_selector = Selector::parse("ul, ol").unwrap();
    let list_item_selector = Selector::parse("li").unwrap();
    let table_selector = Selector::parse("table").unwrap();
    let row_selector = Selector::parse("tr").unwrap();
    let cell_selector = Selector::parse("th, td").unwrap();
    let interactive_selector = Selector::parse("button, label, [role='button']").unwrap();

    let title = document
        .select(&title_selector)
        .next()
        .map(|item| normalize_text(&item.text().collect::<Vec<_>>().join(" ")))
        .unwrap_or_default();
    let meta_description = document
        .select(&meta_description_selector)
        .next()
        .and_then(|item| item.value().attr("content"))
        .map(normalize_text)
        .unwrap_or_default();
    let document_language = document
        .select(&html_selector)
        .next()
        .and_then(|item| item.value().attr("lang"))
        .map(normalize_text)
        .unwrap_or_default();

    let mut sections = Vec::new();
    let mut seen_section_keys = HashSet::new();

    for (index, element) in document.select(&heading_selector).enumerate() {
        let text = normalize_text(&element.text().collect::<Vec<_>>().join(" "));
        if text.is_empty() {
            continue;
        }
        let key = format!("heading:{text}");
        if seen_section_keys.insert(key) {
            sections.push(PageSection {
                id: format!("heading-{index}"),
                kind: element.value().name().to_string(),
                heading: text.clone(),
                content: text,
            });
        }
        if sections.len() >= MAX_PAGE_SECTIONS {
            break;
        }
    }

    if sections.len() < MAX_PAGE_SECTIONS {
        for element in document.select(&text_block_selector) {
            let content = normalize_text(&element.text().collect::<Vec<_>>().join(" "));
            if content.len() < 40 {
                continue;
            }
            let key = format!("text:{content}");
            if !seen_section_keys.insert(key) {
                continue;
            }
            sections.push(PageSection {
                id: format!("section-{}", sections.len() + 1),
                kind: element.value().name().to_string(),
                heading: String::new(),
                content,
            });
            if sections.len() >= MAX_PAGE_SECTIONS {
                break;
            }
        }
    }

    if sections.len() < MAX_PAGE_SECTIONS {
        for list in document.select(&list_selector) {
            let items = list
                .select(&list_item_selector)
                .map(|item| normalize_text(&item.text().collect::<Vec<_>>().join(" ")))
                .filter(|item| item.len() >= 3)
                .take(8)
                .collect::<Vec<_>>();
            if items.is_empty() {
                continue;
            }
            let content = items.join(" | ");
            let key = format!("list:{content}");
            if !seen_section_keys.insert(key) {
                continue;
            }
            sections.push(PageSection {
                id: format!("section-{}", sections.len() + 1),
                kind: "list".to_string(),
                heading: String::new(),
                content,
            });
            if sections.len() >= MAX_PAGE_SECTIONS {
                break;
            }
        }
    }

    if sections.len() < MAX_PAGE_SECTIONS {
        for table in document.select(&table_selector) {
            let rows = table
                .select(&row_selector)
                .map(|row| {
                    row.select(&cell_selector)
                        .map(|cell| normalize_text(&cell.text().collect::<Vec<_>>().join(" ")))
                        .filter(|cell| !cell.is_empty())
                        .collect::<Vec<_>>()
                })
                .filter(|row| !row.is_empty())
                .take(6)
                .collect::<Vec<_>>();
            if rows.is_empty() {
                continue;
            }
            let content = rows
                .into_iter()
                .map(|row| row.join(" | "))
                .collect::<Vec<_>>()
                .join(" || ");
            let key = format!("table:{content}");
            if !seen_section_keys.insert(key) {
                continue;
            }
            sections.push(PageSection {
                id: format!("section-{}", sections.len() + 1),
                kind: "table".to_string(),
                heading: String::new(),
                content,
            });
            if sections.len() >= MAX_PAGE_SECTIONS {
                break;
            }
        }
    }

    let links = document
        .select(&link_selector)
        .filter_map(|item| {
            let text = normalize_text(&item.text().collect::<Vec<_>>().join(" "));
            let href = item.value().attr("href").unwrap_or("");
            let resolved = resolve_relative_url(&normalized_url, href)?;
            if text.is_empty() {
                return None;
            }
            Some(PageLink { text, url: resolved })
        })
        .take(MAX_PAGE_LINKS)
        .collect::<Vec<_>>();

    let interactive_labels = document
        .select(&interactive_selector)
        .map(|item| normalize_text(&item.text().collect::<Vec<_>>().join(" ")))
        .filter(|label| !label.is_empty())
        .take(30)
        .collect::<Vec<_>>();

    Ok(PageSnapshot {
        url: normalized_url,
        title,
        meta_description,
        document_language,
        selected_text: String::new(),
        interactive_labels,
        sections,
        links,
        timestamp: 0,
    })
}

fn resolve_relative_url(base_url: &str, href: &str) -> Option<String> {
    let base = Url::parse(base_url).ok()?;
    let joined = base.join(href).ok()?;
    Some(canonicalize_url(joined.as_str()))
}

fn tokenize(value: &str) -> Vec<String> {
    value
        .to_lowercase()
        .chars()
        .map(|character| if character.is_alphanumeric() { character } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .filter(|token| token.len() > 2)
        .map(|token| token.to_string())
        .collect()
}

fn stop_words() -> &'static [&'static str] {
    &[
        "que", "isso", "essa", "esse", "esta", "este", "pagina", "página", "site", "fala",
        "sobre", "para", "com", "tem", "nos", "nas", "dos", "das", "uma", "uns", "umas",
    ]
}

fn question_terms(question: &str) -> Vec<String> {
    tokenize(question)
        .into_iter()
        .filter(|token| !stop_words().contains(&token.as_str()))
        .collect()
}

fn is_summary_like_question(question: &str) -> bool {
    let lower = question.to_lowercase();
    lower.contains("resume")
        || lower.contains("resumir")
        || lower.contains("o que isso significa")
        || lower.contains("do que se trata")
        || lower.contains("sobre o que")
}

fn has_contextual_reference(question: &str) -> bool {
    let lower = question.to_lowercase();
    lower.contains("isso")
        || lower.contains("essa")
        || lower.contains("esse")
        || lower.contains("esta")
        || lower.contains("este")
        || lower.contains("aqui")
}

fn score_section(section: &PageSection, terms: &[String]) -> usize {
    let haystack = format!("{} {}", section.heading, section.content).to_lowercase();
    terms.iter().fold(0, |score, term| {
        let heading_score = if section.heading.to_lowercase().contains(term) { 3 } else { 0 };
        let content_score = if haystack.contains(term) { 1 } else { 0 };
        score + heading_score + content_score
    })
}

fn score_link(link: &PageLink, terms: &[String]) -> usize {
    let haystack = format!("{} {}", link.text, link.url).to_lowercase();
    terms.iter().fold(0, |score, term| {
        score + if haystack.contains(term) { 1 } else { 0 }
    })
}

fn select_matched_sections(
    snapshot: &PageSnapshot,
    question: &str,
    max_sections: usize,
) -> Vec<PageSection> {
    let effective_max_sections = max_sections.clamp(1, MAX_INSPECT_SECTIONS);
    let terms = question_terms(question);

    if !snapshot.selected_text.is_empty() && (terms.len() <= 2 || has_contextual_reference(question)) {
        return vec![PageSection {
            id: "selected-text".to_string(),
            kind: "selection".to_string(),
            heading: "Selecao atual".to_string(),
            content: snapshot.selected_text.clone(),
        }];
    }

    if is_summary_like_question(question) {
        return snapshot
            .sections
            .iter()
            .take(effective_max_sections)
            .cloned()
            .collect();
    }

    let mut scored = snapshot
        .sections
        .iter()
        .cloned()
        .map(|section| (score_section(&section, &terms), section))
        .filter(|(score, _)| *score > 0)
        .collect::<Vec<_>>();
    scored.sort_by(|left, right| right.0.cmp(&left.0));
    scored
        .into_iter()
        .take(effective_max_sections)
        .map(|(_, section)| section)
        .collect()
}

fn select_matched_links(snapshot: &PageSnapshot, question: &str, max_links: usize) -> Vec<PageLink> {
    let terms = question_terms(question);
    let mut scored = snapshot
        .links
        .iter()
        .cloned()
        .map(|link| (score_link(&link, &terms), link))
        .filter(|(score, _)| *score > 0)
        .collect::<Vec<_>>();
    scored.sort_by(|left, right| right.0.cmp(&left.0));
    scored
        .into_iter()
        .take(max_links)
        .map(|(_, link)| link)
        .collect()
}

fn determine_sufficiency(
    snapshot: &PageSnapshot,
    question: &str,
    matched_sections: &[PageSection],
) -> KnowledgeSufficiency {
    if matched_sections.is_empty() {
        return if snapshot.sections.is_empty() {
            KnowledgeSufficiency::Insufficient
        } else {
            KnowledgeSufficiency::Partial
        };
    }

    if !snapshot.selected_text.is_empty() {
        return KnowledgeSufficiency::Sufficient;
    }

    if is_summary_like_question(question) && !snapshot.sections.is_empty() {
        return KnowledgeSufficiency::Sufficient;
    }

    let terms = question_terms(question);
    let top_score = terms
        .iter()
        .filter(|term| {
            matched_sections
                .iter()
                .any(|section| format!("{} {}", section.heading, section.content).to_lowercase().contains(term.as_str()))
        })
        .count();

    if top_score >= 2 || matched_sections.len() >= 2 {
        KnowledgeSufficiency::Sufficient
    } else {
        KnowledgeSufficiency::Partial
    }
}

fn native_ok(message: impl Into<String>, artifacts: Value) -> NativeCommandResult {
    NativeCommandResult {
        ok: true,
        message: message.into(),
        stdout: None,
        stderr: None,
        artifacts: Some(artifacts),
    }
}

fn native_fail(message: impl Into<String>) -> NativeCommandResult {
    NativeCommandResult {
        ok: false,
        message: message.into(),
        stdout: None,
        stderr: None,
        artifacts: None,
    }
}

fn refresh_current_page_snapshot_impl(
    timeout_ms: Option<u64>,
    state: &WebKnowledgeState,
) -> NativeCommandResult {
    let started_at = current_timestamp_ms();
    let requested_timeout = timeout_ms.unwrap_or(DEFAULT_REFRESH_TIMEOUT_MS);
    let request = state.begin_capture_request(requested_timeout, "inspect_current_page");
    let deadline = request.expires_at;

    while current_timestamp_ms() < deadline {
        if state.has_completed_capture_request(&request.request_id) {
            let runtime = state.fresh_snapshot();
            if let (Some(context), Some(page)) = (runtime.navigation_context, runtime.page_snapshot) {
                return native_ok(
                    "Snapshot da pagina atual atualizado sob demanda.",
                    json!({
                        "requestId": request.request_id,
                        "context": context,
                        "page": page,
                        "refreshMode": runtime.last_capture_transport.unwrap_or_else(|| "reactive_sse".to_string()),
                        "refreshLatencyMs": current_timestamp_ms().saturating_sub(started_at),
                        "extensionSeenAt": runtime.last_extension_seen_at,
                    }),
                );
            }
        }

        thread::sleep(Duration::from_millis(CAPTURE_WAIT_POLL_MS));
    }

    let runtime = state.fresh_snapshot();
    if let (Some(context), Some(page)) = (runtime.navigation_context, runtime.page_snapshot) {
        if context.url == page.url {
            return native_ok(
                "Refresh sob demanda expirou, usando snapshot fresco em cache.",
                json!({
                    "requestId": request.request_id,
                    "context": context,
                    "page": page,
                    "refreshMode": "cached_fallback",
                    "refreshLatencyMs": current_timestamp_ms().saturating_sub(started_at),
                    "extensionSeenAt": runtime.last_extension_seen_at,
                    "fallbackReason": "used_fresh_cached_snapshot_after_refresh_timeout",
                }),
            );
        }
    }

    native_fail(
        "Nao consegui atualizar a pagina atual a tempo e nao havia snapshot fresco compativel.",
    )
}

#[tauri::command]
pub fn refresh_current_page_snapshot(
    timeout_ms: Option<u64>,
    state: State<'_, WebKnowledgeState>,
) -> Result<NativeCommandResult, String> {
    Ok(refresh_current_page_snapshot_impl(timeout_ms, state.inner()))
}

#[tauri::command]
pub fn get_navigation_context(
    state: State<'_, WebKnowledgeState>,
) -> Result<NativeCommandResult, String> {
    let snapshot = state.fresh_snapshot();
    match snapshot.navigation_context {
        Some(context) => Ok(native_ok(
            "Contexto de navegacao disponivel.",
            json!({
                "context": context,
            }),
        )),
        None => Ok(native_fail(
            "Ainda nao recebi contexto de navegacao da extensao do Edge.",
        )),
    }
}

#[tauri::command]
pub fn inspect_current_page(
    question: String,
    max_sections: Option<usize>,
    state: State<'_, WebKnowledgeState>,
) -> Result<NativeCommandResult, String> {
    let runtime = state.fresh_snapshot();
    let Some(context) = runtime.navigation_context else {
        return Ok(native_fail(
            "Nao encontrei contexto da pagina atual. Abra a extensao do Edge e deixe a pagina ativa.",
        ));
    };
    let Some(snapshot) = runtime.page_snapshot else {
        return Ok(native_fail(
            "Ainda nao recebi um snapshot profundo da pagina atual.",
        ));
    };

    let matched_sections = select_matched_sections(
        &snapshot,
        &question,
        max_sections.unwrap_or(4),
    );
    let matched_links = select_matched_links(&snapshot, &question, 5);
    let sufficiency = determine_sufficiency(&snapshot, &question, &matched_sections);

    Ok(native_ok(
        "Pagina atual inspecionada com sucesso.",
        json!({
            "context": context,
            "page": snapshot,
            "matchedSections": matched_sections,
            "matchedLinks": matched_links,
            "sufficiency": sufficiency,
        }),
    ))
}

#[tauri::command]
pub fn search_same_domain(
    query: String,
    domain: String,
    max_results: Option<usize>,
) -> Result<NativeCommandResult, String> {
    let normalized_domain = normalize_text(&domain);
    if normalized_domain.is_empty() {
        return Ok(native_fail("Dominio obrigatorio para search_same_domain."));
    }

    let search_query = format!("site:{normalized_domain} {}", normalize_text(&query));
    let results = duckduckgo_search(&search_query, max_results.unwrap_or(5).clamp(1, MAX_SEARCH_RESULTS))?;
    Ok(native_ok(
        "Busca no mesmo dominio concluida.",
        json!({
            "results": results,
            "domain": normalized_domain,
            "query": query,
        }),
    ))
}

#[tauri::command]
pub fn search_web(query: String, max_results: Option<usize>) -> Result<NativeCommandResult, String> {
    let results = duckduckgo_search(&normalize_text(&query), max_results.unwrap_or(5).clamp(1, MAX_SEARCH_RESULTS))?;
    Ok(native_ok(
        "Busca web concluida.",
        json!({
            "results": results,
            "query": query,
        }),
    ))
}

#[tauri::command]
pub fn fetch_web_page(url: String) -> Result<NativeCommandResult, String> {
    let page = fetch_and_extract_page(&url)?;
    Ok(native_ok(
        "Pagina lida com sucesso.",
        json!({
            "page": page,
        }),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    const TECHNICAL_DOCS_HTML: &str =
        include_str!("../tests/fixtures/web_knowledge/technical_docs.html");
    const LONG_ARTICLE_HTML: &str =
        include_str!("../tests/fixtures/web_knowledge/long_article.html");
    const THIN_LANDING_PAGE_HTML: &str =
        include_str!("../tests/fixtures/web_knowledge/thin_landing_page.html");
    const TABLES_AND_LISTS_HTML: &str =
        include_str!("../tests/fixtures/web_knowledge/tables_and_lists.html");
    const SELECTED_TEXT_PAGE_HTML: &str =
        include_str!("../tests/fixtures/web_knowledge/selected_text_page.html");
    const NOISY_NAVIGATION_LINKS_HTML: &str =
        include_str!("../tests/fixtures/web_knowledge/noisy_navigation_links.html");

    const DDG_HTML: &str = r#"
    <html>
      <body>
        <div class="result">
          <h2 class="result__title">
            <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdocs">Example Docs</a>
          </h2>
          <a class="result__snippet">Documentation about AI integration.</a>
        </div>
        <div class="result">
          <h2 class="result__title">
            <a class="result__a" href="https://example.com/guide">Example Guide</a>
          </h2>
          <a class="result__snippet">Guide with practical steps.</a>
        </div>
      </body>
    </html>
    "#;

    #[test]
    fn parse_duckduckgo_results_extracts_titles_links_and_snippets() {
        let results = parse_duckduckgo_results(DDG_HTML, 5);

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].title, "Example Docs");
        assert_eq!(results[0].url, "https://example.com/docs");
        assert!(results[0].snippet.contains("AI integration"));
    }

    #[test]
    fn normalize_browser_page_state_uses_context_and_snapshot() {
        let payload = BrowserPageStatePayload {
            request_id: Some("capture-1".to_string()),
            transport: Some("reactive_sse".to_string()),
            navigation_context: NavigationContextPayload {
                url: "https://example.com/docs".to_string(),
                domain: Some("example.com".to_string()),
                title: Some("Docs".to_string()),
                selection_text: Some("trecho".to_string()),
                selected_text: None,
                timestamp: Some(42),
            },
            snapshot: Some(PageSnapshotPayload {
                url: None,
                title: Some("Docs".to_string()),
                meta_description: Some("Descricao".to_string()),
                document_language: Some("pt-BR".to_string()),
                selected_text: Some("trecho".to_string()),
                interactive_labels: Some(vec!["Buscar".to_string()]),
                sections: Some(vec![PageSectionPayload {
                    id: Some("section-1".to_string()),
                    kind: Some("paragraph".to_string()),
                    heading: Some("Introducao".to_string()),
                    content: Some("Texto principal sobre IA.".to_string()),
                }]),
                links: Some(vec![PageLinkPayload {
                    text: Some("Saiba mais".to_string()),
                    url: Some("https://example.com/more".to_string()),
                }]),
                timestamp: Some(42),
            }),
        };

        let (request_id, transport, context, snapshot) = normalize_browser_page_state(payload).unwrap();

        assert_eq!(request_id.as_deref(), Some("capture-1"));
        assert_eq!(transport.as_deref(), Some("reactive_sse"));
        assert_eq!(context.domain, "example.com");
        assert_eq!(snapshot.unwrap().sections[0].heading, "Introducao");
    }

    #[test]
    fn extract_page_snapshot_from_html_collects_structured_sections() {
        let html = r#"
        <html lang="pt-BR">
          <head>
            <title>Pagina de teste</title>
            <meta name="description" content="Resumo da pagina" />
          </head>
          <body>
            <main>
              <h1>Introducao</h1>
              <p>Esta pagina fala sobre inteligencia artificial e integracoes praticas.</p>
              <ul>
                <li>Primeiro ponto</li>
                <li>Segundo ponto</li>
              </ul>
              <a href="/docs">Leia a documentacao</a>
            </main>
          </body>
        </html>
        "#;

        let snapshot = extract_page_snapshot_from_html("https://example.com/start", html).unwrap();

        assert_eq!(snapshot.title, "Pagina de teste");
        assert_eq!(snapshot.document_language, "pt-BR");
        assert!(snapshot.sections.iter().any(|section| section.content.contains("inteligencia artificial")));
        assert!(snapshot.links.iter().any(|link| link.url == "https://example.com/docs"));
    }

    #[test]
    fn inspect_matching_prefers_selected_text_for_short_contextual_questions() {
        let snapshot = PageSnapshot {
            url: "https://example.com/docs".to_string(),
            title: "Docs".to_string(),
            meta_description: String::new(),
            document_language: "pt-BR".to_string(),
            selected_text: "Trecho sobre agentes autonomos".to_string(),
            interactive_labels: vec![],
            sections: vec![PageSection {
                id: "section-1".to_string(),
                kind: "paragraph".to_string(),
                heading: "Introducao".to_string(),
                content: "Texto principal".to_string(),
            }],
            links: vec![],
            timestamp: 1,
        };

        let matched = select_matched_sections(&snapshot, "o que isso significa?", 4);

        assert_eq!(matched[0].kind, "selection");
    }

    #[test]
    fn determine_sufficiency_marks_summary_requests_as_sufficient_when_page_has_content() {
        let snapshot = PageSnapshot {
            url: "https://example.com/docs".to_string(),
            title: "Docs".to_string(),
            meta_description: String::new(),
            document_language: "pt-BR".to_string(),
            selected_text: String::new(),
            interactive_labels: vec![],
            sections: vec![PageSection {
                id: "section-1".to_string(),
                kind: "paragraph".to_string(),
                heading: String::new(),
                content: "Texto principal suficiente para um resumo.".to_string(),
            }],
            links: vec![],
            timestamp: 1,
        };

        let matched = select_matched_sections(&snapshot, "resume isso pra mim", 3);
        let sufficiency = determine_sufficiency(&snapshot, "resume isso pra mim", &matched);

        assert_eq!(sufficiency, KnowledgeSufficiency::Sufficient);
    }

    #[test]
    fn search_result_url_resolution_unwraps_duckduckgo_redirects() {
        let resolved = resolve_search_result_url(
            "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fguide",
        );

        assert_eq!(resolved.as_deref(), Some("https://example.com/guide"));
    }

    #[test]
    fn fresh_snapshot_drops_stale_navigation_context_and_snapshot() {
        let state = WebKnowledgeState::default();
        let stale_timestamp = current_timestamp_ms().saturating_sub(MAX_NAVIGATION_CONTEXT_AGE_MS + 1_000);

        state.apply_page_state(
            NavigationContext {
                url: "https://example.com/page".to_string(),
                domain: "example.com".to_string(),
                title: "Example".to_string(),
                selection_text: String::new(),
                timestamp: stale_timestamp,
            },
            Some(PageSnapshot {
                url: "https://example.com/page".to_string(),
                title: "Example".to_string(),
                meta_description: String::new(),
                document_language: "pt-BR".to_string(),
                selected_text: String::new(),
                interactive_labels: Vec::new(),
                sections: vec![PageSection {
                    id: "section-1".to_string(),
                    kind: "paragraph".to_string(),
                    heading: String::new(),
                    content: "Conteudo".to_string(),
                }],
                links: Vec::new(),
                timestamp: stale_timestamp,
            }),
            None,
            None,
        );

        let runtime = state.fresh_snapshot();

        assert!(runtime.navigation_context.is_none());
        assert!(runtime.page_snapshot.is_none());
    }

    #[test]
    fn pending_capture_request_is_exposed_until_it_expires() {
        let state = WebKnowledgeState::default();
        let request = state.begin_capture_request(500, "inspect_current_page");

        let pending = state.pending_capture_request().unwrap();

        assert_eq!(pending.request_id, request.request_id);
        assert_eq!(pending.reason, "inspect_current_page");
    }

    #[test]
    fn subscribe_capture_events_receives_connected_and_pending_request_events() {
        let state = WebKnowledgeState::default();
        let request = state.begin_capture_request(500, "inspect_current_page");

        let receiver = state.subscribe_capture_events();
        let connected = receiver.recv_timeout(Duration::from_millis(100)).unwrap();
        let connected_text = String::from_utf8(connected).unwrap();
        assert!(connected_text.contains("event: connected"));
        assert!(connected_text.contains("\"retryMs\":1000"));

        let capture_event = receiver.recv_timeout(Duration::from_millis(100)).unwrap();
        let capture_text = String::from_utf8(capture_event).unwrap();
        assert!(capture_text.contains("event: capture_request"));
        assert!(capture_text.contains(&request.request_id));
    }

    #[test]
    fn capture_event_stream_emits_heartbeat_while_idle() {
        let (_sender, receiver) = mpsc::channel::<Vec<u8>>();
        let mut stream = CaptureEventStream::new_with_heartbeat(receiver, 1);
        let mut buffer = vec![0_u8; 256];

        let bytes_read = stream.read(&mut buffer).unwrap();
        let event = String::from_utf8(buffer[..bytes_read].to_vec()).unwrap();

        assert!(event.contains("event: heartbeat"));
        assert!(event.contains("\"ts\""));
    }

    #[test]
    fn apply_page_state_resolves_matching_pending_capture_request() {
        let state = WebKnowledgeState::default();
        let request = state.begin_capture_request(500, "inspect_current_page");

        state.apply_page_state(
            NavigationContext {
                url: "https://example.com/page".to_string(),
                domain: "example.com".to_string(),
                title: "Example".to_string(),
                selection_text: String::new(),
                timestamp: current_timestamp_ms(),
            },
            Some(PageSnapshot {
                url: "https://example.com/page".to_string(),
                title: "Example".to_string(),
                meta_description: String::new(),
                document_language: "pt-BR".to_string(),
                selected_text: String::new(),
                interactive_labels: Vec::new(),
                sections: vec![PageSection {
                    id: "section-1".to_string(),
                    kind: "paragraph".to_string(),
                    heading: String::new(),
                    content: "Conteudo".to_string(),
                }],
                links: Vec::new(),
                timestamp: current_timestamp_ms(),
            }),
            Some(&request.request_id),
            Some("reactive_sse"),
        );

        assert!(state.has_completed_capture_request(&request.request_id));
        assert!(state.pending_capture_request().is_none());
        let runtime = state.fresh_snapshot();
        assert_eq!(runtime.last_capture_transport.as_deref(), Some("reactive_sse"));
        assert!(runtime.last_extension_seen_at.is_some());
    }

    #[test]
    fn refresh_current_page_snapshot_uses_fresh_cached_snapshot_as_fallback() {
        let state = WebKnowledgeState::default();
        let now = current_timestamp_ms();
        state.apply_page_state(
            NavigationContext {
                url: "https://example.com/page".to_string(),
                domain: "example.com".to_string(),
                title: "Example".to_string(),
                selection_text: String::new(),
                timestamp: now,
            },
            Some(PageSnapshot {
                url: "https://example.com/page".to_string(),
                title: "Example".to_string(),
                meta_description: String::new(),
                document_language: "pt-BR".to_string(),
                selected_text: String::new(),
                interactive_labels: Vec::new(),
                sections: vec![PageSection {
                    id: "section-1".to_string(),
                    kind: "paragraph".to_string(),
                    heading: String::new(),
                    content: "Conteudo".to_string(),
                }],
                links: Vec::new(),
                timestamp: now,
            }),
            None,
            None,
        );

        let result = refresh_current_page_snapshot_impl(Some(1), &state);

        assert!(result.ok);
        assert_eq!(
            result
                .artifacts
                .as_ref()
                .and_then(|value| value.get("fallbackReason"))
                .and_then(|value| value.as_str()),
            Some("used_fresh_cached_snapshot_after_refresh_timeout")
        );
        assert_eq!(
            result
                .artifacts
                .as_ref()
                .and_then(|value| value.get("refreshMode"))
                .and_then(|value| value.as_str()),
            Some("cached_fallback")
        );
    }

    #[test]
    fn refresh_current_page_snapshot_resolves_with_reactive_transport_when_request_is_completed() {
        let state = WebKnowledgeState::default();
        let receiver = state.subscribe_capture_events();
        let state_for_thread = state.clone();

        thread::spawn(move || {
            let _ = receiver.recv_timeout(Duration::from_millis(100));
            let capture_event = receiver.recv_timeout(Duration::from_millis(100)).unwrap();
            let capture_text = String::from_utf8(capture_event).unwrap();
            let request_id = capture_text
                .split("\"requestId\":\"")
                .nth(1)
                .and_then(|segment| segment.split('"').next())
                .unwrap()
                .to_string();

            state_for_thread.apply_page_state(
                NavigationContext {
                    url: "https://example.com/page".to_string(),
                    domain: "example.com".to_string(),
                    title: "Example".to_string(),
                    selection_text: String::new(),
                    timestamp: current_timestamp_ms(),
                },
                Some(PageSnapshot {
                    url: "https://example.com/page".to_string(),
                    title: "Example".to_string(),
                    meta_description: String::new(),
                    document_language: "pt-BR".to_string(),
                    selected_text: String::new(),
                    interactive_labels: Vec::new(),
                    sections: vec![PageSection {
                        id: "section-1".to_string(),
                        kind: "paragraph".to_string(),
                        heading: String::new(),
                        content: "Conteudo".to_string(),
                    }],
                    links: Vec::new(),
                    timestamp: current_timestamp_ms(),
                }),
                Some(&request_id),
                Some("reactive_sse"),
            );
        });

        let result = refresh_current_page_snapshot_impl(Some(250), &state);

        assert!(result.ok);
        assert_eq!(
            result
                .artifacts
                .as_ref()
                .and_then(|value| value.get("refreshMode"))
                .and_then(|value| value.as_str()),
            Some("reactive_sse")
        );
    }

    #[test]
    fn refresh_current_page_snapshot_fails_without_fresh_cache_or_request_resolution() {
        let state = WebKnowledgeState::default();

        let result = refresh_current_page_snapshot_impl(Some(1), &state);

        assert!(!result.ok);
        assert!(result.message.contains("Nao consegui atualizar a pagina atual a tempo"));
    }

    #[test]
    fn fixtures_extract_expected_structures() {
        let docs = extract_page_snapshot_from_html("https://example.com/docs", TECHNICAL_DOCS_HTML)
            .unwrap();
        let article =
            extract_page_snapshot_from_html("https://example.com/article", LONG_ARTICLE_HTML)
                .unwrap();
        let thin =
            extract_page_snapshot_from_html("https://example.com/landing", THIN_LANDING_PAGE_HTML)
                .unwrap();
        let tables =
            extract_page_snapshot_from_html("https://example.com/plans", TABLES_AND_LISTS_HTML)
                .unwrap();
        let selected = extract_page_snapshot_from_html(
            "https://example.com/terms",
            SELECTED_TEXT_PAGE_HTML,
        )
        .unwrap();
        let noisy = extract_page_snapshot_from_html(
            "https://example.com/portal",
            NOISY_NAVIGATION_LINKS_HTML,
        )
        .unwrap();

        assert!(docs.links.iter().any(|link| link.url == "https://example.com/docs/oauth"));
        assert!(article.sections.iter().any(|section| section.content.contains("RAG")));
        assert!(thin.links.iter().any(|link| link.url == "https://example.com/login"));
        assert!(tables.sections.iter().any(|section| section.kind == "table"));
        assert!(selected.sections.iter().any(|section| section.content.contains("callbacks assinados")));
        assert!(noisy.links.iter().any(|link| link.url == "https://example.com/docs/authentication"));
    }
}
