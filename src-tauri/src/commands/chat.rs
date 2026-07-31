//! Provider-neutral streaming chat + local model discovery.

use crate::error::AppError;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

const MAX_BUFFER_CHARS: usize = 8_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChatProvider {
    Ollama,
    Lmstudio,
    Xai,
    Openai,
    Anthropic,
}

impl ChatProvider {
    pub fn parse(raw: &str) -> Result<Self, AppError> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "ollama" => Ok(Self::Ollama),
            "lmstudio" | "lm-studio" | "lm_studio" => Ok(Self::Lmstudio),
            "xai" | "grok" => Ok(Self::Xai),
            "openai" => Ok(Self::Openai),
            "anthropic" | "claude" => Ok(Self::Anthropic),
            other => Err(chat_error(format!("Unknown chat provider: {other}"), false)),
        }
    }

    fn default_base_url(&self) -> &'static str {
        match self {
            Self::Ollama => "http://127.0.0.1:11434",
            Self::Lmstudio => "http://127.0.0.1:1234",
            Self::Xai => "https://api.x.ai",
            Self::Openai => "https://api.openai.com",
            Self::Anthropic => "https://api.anthropic.com",
        }
    }

    fn default_model(&self) -> &'static str {
        match self {
            Self::Ollama => "llama3.2",
            Self::Lmstudio => "local-model",
            Self::Xai => "grok-4-1-fast-non-reasoning",
            Self::Openai => "gpt-4o-mini",
            Self::Anthropic => "claude-sonnet-4-20250514",
        }
    }

    fn needs_key(&self) -> bool {
        matches!(self, Self::Xai | Self::Openai | Self::Anthropic)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
struct OpenAiChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    stream: bool,
}

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    temperature: f32,
    system: String,
    messages: Vec<AnthropicMessage>,
    stream: bool,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct StreamChunk {
    choices: Option<Vec<StreamChoice>>,
    error: Option<ApiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    delta: Option<StreamDelta>,
}

#[derive(Debug, Deserialize)]
struct StreamDelta {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiErrorBody {
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicSseEvent {
    #[serde(rename = "type")]
    event_type: Option<String>,
    delta: Option<AnthropicDelta>,
    error: Option<ApiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct AnthropicDelta {
    #[serde(rename = "type")]
    delta_type: Option<String>,
    text: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatTokenEvent {
    pub text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResult {
    pub reply: String,
    pub model: String,
    pub provider: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatModelInfo {
    pub id: String,
    pub provider: String,
    pub label: String,
}

#[derive(Debug, Deserialize)]
struct OllamaTags {
    models: Option<Vec<OllamaModel>>,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: Option<String>,
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiModelList {
    data: Option<Vec<OpenAiModel>>,
}

#[derive(Debug, Deserialize)]
struct OpenAiModel {
    id: Option<String>,
}

fn chat_error(message: impl Into<String>, retryable: bool) -> AppError {
    AppError {
        code: "CHAT_ERROR",
        message: message.into(),
        retryable,
        details: None,
    }
}

pub fn truncate_buffer(buffer: &str) -> String {
    if buffer.chars().count() <= MAX_BUFFER_CHARS {
        return buffer.to_string();
    }
    let clipped: String = buffer
        .chars()
        .rev()
        .take(MAX_BUFFER_CHARS)
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    format!("…(truncated)\n{clipped}")
}

pub fn numbered_buffer(buffer: &str) -> String {
    buffer
        .lines()
        .enumerate()
        .map(|(i, line)| format!("{:>4}|{}", i + 1, line))
        .collect::<Vec<_>>()
        .join("\n")
}

fn resolve_base_url(provider: &ChatProvider, base_url: Option<&str>) -> String {
    base_url
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| provider.default_base_url())
        .trim_end_matches('/')
        .to_string()
}

async fn stream_openai_compatible(
    url: &str,
    api_key: Option<&str>,
    body: &OpenAiChatRequest,
    on_token: &Channel<ChatTokenEvent>,
) -> Result<String, AppError> {
    let client = reqwest::Client::new();
    let mut request = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream")
        .json(body);
    if let Some(key) = api_key.filter(|value| !value.is_empty()) {
        request = request.bearer_auth(key);
    }

    let response = request
        .send()
        .await
        .map_err(|error| chat_error(format!("Could not reach chat provider: {error}"), true))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        let message = serde_json::from_str::<StreamChunk>(&body)
            .ok()
            .and_then(|parsed| parsed.error)
            .and_then(|error| error.message)
            .unwrap_or_else(|| {
                format!(
                    "Chat provider error ({status}): {}",
                    body.chars().take(240).collect::<String>()
                )
            });
        return Err(chat_error(message, status.is_server_error()));
    }

    let mut byte_stream = response.bytes_stream();
    let mut carry = String::new();
    let mut reply = String::new();
    let mut done = false;

    while !done {
        let Some(item) = byte_stream.next().await else {
            break;
        };
        let chunk = item.map_err(|error| {
            chat_error(
                format!("Lost connection while streaming chat: {error}"),
                true,
            )
        })?;
        carry.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline) = carry.find('\n') {
            let mut line = carry[..newline].to_string();
            carry = carry[newline + 1..].to_string();
            if line.ends_with('\r') {
                line.pop();
            }
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let Some(data) = line.strip_prefix("data:") else {
                continue;
            };
            let data = data.trim();
            if data == "[DONE]" {
                done = true;
                break;
            }

            let parsed: StreamChunk = serde_json::from_str(data).map_err(|_| {
                chat_error(
                    format!(
                        "Unexpected stream chunk: {}",
                        data.chars().take(160).collect::<String>()
                    ),
                    true,
                )
            })?;

            if let Some(error) = parsed.error {
                return Err(chat_error(
                    error
                        .message
                        .unwrap_or_else(|| "Chat stream failed.".into()),
                    true,
                ));
            }

            let Some(text) = parsed
                .choices
                .as_ref()
                .and_then(|choices| choices.first())
                .and_then(|choice| choice.delta.as_ref())
                .and_then(|delta| delta.content.as_ref())
                .filter(|value| !value.is_empty())
            else {
                continue;
            };

            reply.push_str(text);
            let _ = on_token.send(ChatTokenEvent { text: text.clone() });
        }

        let trailing = carry.trim();
        if trailing == "data: [DONE]" || trailing == "data:[DONE]" {
            done = true;
            carry.clear();
        }
    }

    Ok(reply)
}

async fn stream_anthropic(
    url: &str,
    api_key: &str,
    body: &AnthropicRequest,
    on_token: &Channel<ChatTokenEvent>,
) -> Result<String, AppError> {
    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(body)
        .send()
        .await
        .map_err(|error| chat_error(format!("Could not reach Anthropic: {error}"), true))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(chat_error(
            format!(
                "Anthropic error ({status}): {}",
                body.chars().take(240).collect::<String>()
            ),
            status.is_server_error(),
        ));
    }

    let mut byte_stream = response.bytes_stream();
    let mut carry = String::new();
    let mut reply = String::new();
    let mut done = false;

    while !done {
        let Some(item) = byte_stream.next().await else {
            break;
        };
        let chunk = item.map_err(|error| {
            chat_error(
                format!("Lost connection while streaming Anthropic: {error}"),
                true,
            )
        })?;
        carry.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline) = carry.find('\n') {
            let mut line = carry[..newline].to_string();
            carry = carry[newline + 1..].to_string();
            if line.ends_with('\r') {
                line.pop();
            }
            let line = line.trim();
            if line.is_empty() || !line.starts_with("data:") {
                continue;
            }
            let data = line[5..].trim();
            if data == "[DONE]" {
                done = true;
                break;
            }
            let Ok(parsed) = serde_json::from_str::<AnthropicSseEvent>(data) else {
                continue;
            };
            if let Some(error) = parsed.error {
                return Err(chat_error(
                    error
                        .message
                        .unwrap_or_else(|| "Anthropic stream failed.".into()),
                    true,
                ));
            }
            if parsed.event_type.as_deref() == Some("message_stop") {
                done = true;
                break;
            }
            if parsed
                .delta
                .as_ref()
                .and_then(|delta| delta.delta_type.as_deref())
                == Some("text_delta")
            {
                if let Some(text) = parsed
                    .delta
                    .as_ref()
                    .and_then(|delta| delta.text.as_ref())
                    .filter(|value| !value.is_empty())
                {
                    reply.push_str(text);
                    let _ = on_token.send(ChatTokenEvent { text: text.clone() });
                }
            }
        }
    }

    Ok(reply)
}

#[allow(clippy::too_many_arguments)]
pub async fn run_chat(
    provider: ChatProvider,
    model: Option<String>,
    system_prompt: String,
    messages: Vec<ChatMessage>,
    api_key: Option<String>,
    base_url: Option<String>,
    temperature: f32,
    on_token: Channel<ChatTokenEvent>,
) -> Result<ChatResult, AppError> {
    let model = model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| provider.default_model())
        .to_string();
    let base = resolve_base_url(&provider, base_url.as_deref());
    let key = api_key.as_deref().map(str::trim).unwrap_or("");

    if provider.needs_key() && key.is_empty() {
        return Err(chat_error(
            format!(
                "Add an API key for {} in AI providers settings.",
                match provider {
                    ChatProvider::Xai => "xAI",
                    ChatProvider::Openai => "OpenAI",
                    ChatProvider::Anthropic => "Anthropic",
                    _ => "this provider",
                }
            ),
            false,
        ));
    }

    let mut outbound = Vec::with_capacity(messages.len() + 1);
    if !matches!(provider, ChatProvider::Anthropic) {
        outbound.push(ChatMessage {
            role: "system".into(),
            content: system_prompt.clone(),
        });
    }
    for item in messages {
        if item.role == "user" || item.role == "assistant" || item.role == "system" {
            outbound.push(item);
        }
    }

    let reply = match provider {
        ChatProvider::Anthropic => {
            let (system, rest) = {
                let mut system = system_prompt;
                let mut rest = Vec::new();
                for item in outbound {
                    if item.role == "system" && system.is_empty() {
                        system = item.content;
                    } else if item.role == "user" || item.role == "assistant" {
                        rest.push(AnthropicMessage {
                            role: item.role,
                            content: item.content,
                        });
                    }
                }
                (system, rest)
            };
            stream_anthropic(
                &format!("{base}/v1/messages"),
                key,
                &AnthropicRequest {
                    model: model.clone(),
                    max_tokens: 4096,
                    temperature,
                    system,
                    messages: rest,
                    stream: true,
                },
                &on_token,
            )
            .await?
        }
        _ => {
            let url = format!("{base}/v1/chat/completions");
            let auth = if provider.needs_key() {
                Some(key)
            } else if key.is_empty() {
                None
            } else {
                Some(key)
            };
            stream_openai_compatible(
                &url,
                auth,
                &OpenAiChatRequest {
                    model: model.clone(),
                    messages: outbound,
                    temperature,
                    stream: true,
                },
                &on_token,
            )
            .await?
        }
    };

    let reply = reply.trim().to_string();
    if reply.is_empty() {
        return Err(chat_error("Model returned an empty reply.", true));
    }

    Ok(ChatResult {
        reply,
        model,
        provider: match provider {
            ChatProvider::Ollama => "ollama",
            ChatProvider::Lmstudio => "lmstudio",
            ChatProvider::Xai => "xai",
            ChatProvider::Openai => "openai",
            ChatProvider::Anthropic => "anthropic",
        }
        .into(),
    })
}

#[tauri::command]
pub async fn list_local_models(
    provider: String,
    base_url: Option<String>,
) -> Result<Vec<ChatModelInfo>, AppError> {
    let provider = ChatProvider::parse(&provider)?;
    if !matches!(provider, ChatProvider::Ollama | ChatProvider::Lmstudio) {
        return Err(chat_error(
            "Local model discovery only supports ollama and lmstudio.",
            false,
        ));
    }
    let base = resolve_base_url(&provider, base_url.as_deref());
    let client = reqwest::Client::new();

    match provider {
        ChatProvider::Ollama => {
            let response = client
                .get(format!("{base}/api/tags"))
                .send()
                .await
                .map_err(|error| {
                    chat_error(format!("Ollama not reachable at {base}: {error}"), true)
                })?;
            if !response.status().is_success() {
                return Err(chat_error(
                    format!("Ollama error ({})", response.status()),
                    true,
                ));
            }
            let payload: OllamaTags = response
                .json()
                .await
                .map_err(|_| chat_error("Could not parse Ollama model list.", true))?;
            Ok(payload
                .models
                .unwrap_or_default()
                .into_iter()
                .filter_map(|model| {
                    let id = model.name.or(model.model)?.trim().to_string();
                    if id.is_empty() {
                        return None;
                    }
                    Some(ChatModelInfo {
                        label: id.clone(),
                        id,
                        provider: "ollama".into(),
                    })
                })
                .collect())
        }
        ChatProvider::Lmstudio => {
            let response = client
                .get(format!("{base}/v1/models"))
                .send()
                .await
                .map_err(|error| {
                    chat_error(format!("LM Studio not reachable at {base}: {error}"), true)
                })?;
            if !response.status().is_success() {
                return Err(chat_error(
                    format!("LM Studio error ({})", response.status()),
                    true,
                ));
            }
            let payload: OpenAiModelList = response
                .json()
                .await
                .map_err(|_| chat_error("Could not parse LM Studio model list.", true))?;
            Ok(payload
                .data
                .unwrap_or_default()
                .into_iter()
                .filter_map(|model| {
                    let id = model.id?.trim().to_string();
                    if id.is_empty() {
                        return None;
                    }
                    Some(ChatModelInfo {
                        label: id.clone(),
                        id,
                        provider: "lmstudio".into(),
                    })
                })
                .collect())
        }
        _ => unreachable!(),
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn chat_completion(
    provider: String,
    question: String,
    system_prompt: Option<String>,
    language: Option<String>,
    buffer: Option<String>,
    context_override: Option<String>,
    include_context: Option<bool>,
    model: Option<String>,
    api_key: Option<String>,
    base_url: Option<String>,
    history: Option<Vec<ChatMessage>>,
    on_token: Channel<ChatTokenEvent>,
) -> Result<ChatResult, AppError> {
    let provider = ChatProvider::parse(&provider)?;
    let question = question.trim();
    if question.is_empty() {
        return Err(chat_error("Enter a message.", false));
    }

    let system = system_prompt
        .unwrap_or_else(|| {
            "You are ScratchCLI Assistant: a helpful local-first coding assistant for desktop developers. \
Be concise and practical. Prefer clear explanations and small code excerpts. \
When an editor buffer / open file is provided, that open file is what the user is working on - answer about that file. Do not invent a different file or problem. Use the buffer as context; do not dump the whole file unless asked."
                .into()
        });

    let mut messages = Vec::new();
    if let Some(history) = history {
        for item in history.into_iter().take(20) {
            if item.role == "user" || item.role == "assistant" {
                messages.push(item);
            }
        }
    }

    let include_context = include_context.unwrap_or(true);
    let mut user_content = String::new();
    if include_context {
        let override_text = context_override
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if let Some(override_text) = override_text {
            user_content.push_str(override_text);
            if !override_text.ends_with("\n\n") {
                user_content.push_str("\n\n");
            }
        } else {
            let language = language
                .as_deref()
                .unwrap_or("plaintext")
                .trim()
                .to_string();
            let buffer = buffer.as_deref().unwrap_or("").trim();
            if !buffer.is_empty() {
                user_content.push_str(&format!(
                    "Editor language: {language}\n\
Lines are numbered (N|code) for reference.\n\n\
Editor buffer:\n```{language}\n{}\n```\n\n",
                    numbered_buffer(&truncate_buffer(buffer))
                ));
            }
        }
    }
    user_content.push_str(question);
    messages.push(ChatMessage {
        role: "user".into(),
        content: user_content,
    });

    let temperature = if matches!(provider, ChatProvider::Ollama | ChatProvider::Lmstudio) {
        0.2
    } else {
        0.4
    };

    run_chat(
        provider,
        model,
        system,
        messages,
        api_key,
        base_url,
        temperature,
        on_token,
    )
    .await
}

#[tauri::command]
pub async fn which_command(name: String) -> Result<Option<String>, AppError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(chat_error("Command name required.", false));
    }
    #[cfg(windows)]
    {
        let output = tokio::process::Command::new("where.exe")
            .arg(name)
            .output()
            .await
            .map_err(|error| chat_error(format!("Could not search PATH: {error}"), true))?;
        if !output.status.success() {
            return Ok(None);
        }
        let text = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = text
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .collect();
        let preferred = lines
            .iter()
            .find(|line| line.to_ascii_lowercase().ends_with(".exe"))
            .copied()
            .or_else(|| lines.first().copied());
        Ok(preferred.map(str::to_string))
    }
    #[cfg(not(windows))]
    {
        let output = tokio::process::Command::new("which")
            .arg(name)
            .output()
            .await
            .map_err(|error| chat_error(format!("Could not search PATH: {error}"), true))?;
        if !output.status.success() {
            return Ok(None);
        }
        let text = String::from_utf8_lossy(&output.stdout);
        Ok(text
            .lines()
            .map(str::trim)
            .find(|line| !line.is_empty())
            .map(str::to_string))
    }
}
