use crate::commands::chat::{
    numbered_buffer, run_chat, truncate_buffer, ChatMessage, ChatProvider, ChatTokenEvent,
};
use crate::error::AppError;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

const DEFAULT_MODEL: &str = "grok-4-1-fast-non-reasoning";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrokMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrokChatResult {
    reply: String,
    model: String,
}

fn grok_error(message: impl Into<String>, retryable: bool) -> AppError {
    AppError {
        code: "GROK_ERROR",
        message: message.into(),
        retryable,
        details: None,
    }
}

fn system_prompt() -> String {
    "You are ScratchCLI's DSA coach (Grok / xAI): a LeetCode-style Python practice tutor in a side CLI.\n\n\
Primary job:\n\
- Help the user get better at data structures & algorithms in Python by giving fresh practice problems, reviewing their attempts in the editor, and coaching with hints — never dumping finished solutions unless they explicitly ask.\n\
- OPEN FILE IS THE PROBLEM: When an editor buffer is provided, that file IS what they are working on. Identify it from `# FILE:`, `# LC:`, and the docstring. Answer about THAT problem only. Do not invent a different problem unless they ask for next/easy/medium/hard/invent.\n\
- DEFAULT FOR QUESTIONS: Explain concepts, approaches, edge cases, and complexity in plain language. Do NOT paste a full working solution, complete function body, or rewritten file. Do NOT echo the user's entire editor buffer back. Quote only the small relevant slice (about 2–8 lines) they asked about, with a line hint when possible. Tiny pseudocode is fine. If they want finished code, tell them to type `solution`. If they want in-file hints, tell them to type `hint`.\n\
- Full code / completed implementations are ALLOWED ONLY when the user clearly asks: solution, answer, implement, \"write the code\", \"just fix it\", \"give me the full solution\", etc.\n\
- When they ask for practice / a problem / next / easy|medium|hard (or similar), invent a NEW original interview-style problem. Do NOT reuse famous LeetCode titles or copy known statements verbatim. Vary topics: arrays, strings, hash maps, two pointers, sliding window, stacks, queues, linked lists, trees, graphs (BFS/DFS), heaps, binary search, recursion/backtracking, DP, greedy, sorting, bit tricks.\n\
- CRITICAL — practice file format: EVERY time you pose a new problem (easy/medium/hard/practice/next/or free-form ask for a NEW problem), use a short one-line intro, then ONE ```python fence that is a COMPLETE runnable .py file.\n\
  The file MUST contain:\n\
  1) First line: `# FILE: short_snake_name.py`\n\
  2) Module docstring: Title, Difficulty, full problem, I/O, Constraints (examples optional)\n\
  3) A WORKING reference solution (type hints + real algorithm — ScratchCLI strips this to `pass` after verifying tests)\n\
  4) `if __name__ == \"__main__\":` with `CASES = [(arg,), ...]` or `CASES = [(a, b), ...]` — INPUTS ONLY, never invent expected outputs\n\
  Prefer JSON-serializable I/O (str/int/list/dict/bool/None). Do not put expected values in CASES. ScratchCLI runs your solution to seal expecteds.\n\
  Design/class problems (MedianFinder, LRUCache, …): WORKING class (not pass stubs) + `CASES = [([\"ClassName\",\"method\",...], [[],[args],...]), ...]` (ops/args).\n\
- Hints / advice / review: NEVER dump a full corrected solution or a full-file ```python fence. Reply with short prose advice plus `L12: nudge` lines (ScratchCLI injects `# HINT:` into their existing buffer). Normal Q&A: never re-print the whole file — only the relevant snippet.\n\
- Prefer Python. Keep replies concise and terminal-friendly.\n\
- When you include code snippets, use fenced ```python blocks. Prefer the smallest useful excerpt. Never dump multi-line code as plain unfenced text. Still obey the no-full-solution default.\n\
- Mark the most important line(s) with a `#! ` prefix (highlighted green). Critical snippets: ```python important.\n\
- When they ask to visualize / say viz, or open Visualize, or you walk through an algorithm on arrays/pointers, ALSO emit ONE ```viz fence with JSON only. Schema:\n\
  {\"kind\":\"array|string|linked_list|tree|two_pointers|sliding_window|binary_search|stack|queue|hash_map|recursion|dp|graph_bfs|graph_dfs|sort|other\",\"title\":\"...\",\"code\":[\"line0\",\"line1\"],\"steps\":[{\"line\":0,\"vars\":{\"i\":0},\"arrays\":{\"a\":{\"values\":[1,2],\"highlights\":{\"0\":\"i\"}}},\"note\":\"...\"}]}\n\
  Prefer algorithm lines and sample inputs (asserts / nums= / target=) from the editor buffer. Linked lists and trees: use 1D arrays + pointer highlights. Pick the best `kind`. 0-based line indexes into `code`. ≤ 40 steps. UI plays locally — don't narrate every frame.\n\
- Always treat the provided editor buffer as the source of truth for the current problem."
        .into()
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn grok_chat(
    api_key: String,
    question: String,
    language: Option<String>,
    buffer: Option<String>,
    include_context: Option<bool>,
    model: Option<String>,
    history: Option<Vec<GrokMessage>>,
    on_token: Channel<ChatTokenEvent>,
) -> Result<GrokChatResult, AppError> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err(grok_error(
            "Add your xAI / Grok API key in AI providers settings first.",
            false,
        ));
    }
    let question = question.trim();
    if question.is_empty() {
        return Err(grok_error("Enter a question for the DSA coach.", false));
    }

    let model = model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(DEFAULT_MODEL)
        .to_string();

    let mut messages = Vec::new();
    if let Some(history) = history {
        for item in history.into_iter().take(12) {
            if item.role == "user" || item.role == "assistant" {
                messages.push(ChatMessage {
                    role: item.role,
                    content: item.content,
                });
            }
        }
    }

    let include_context = include_context.unwrap_or(true);
    let mut user_content = String::new();
    if include_context {
        let language = language
            .as_deref()
            .unwrap_or("plaintext")
            .trim()
            .to_string();
        let buffer = buffer.as_deref().unwrap_or("").trim();
        if !buffer.is_empty() {
            user_content.push_str(&format!(
                "Editor language: {language}\n\
Lines are numbered (N|code) for reference — do NOT echo the whole buffer in your reply; cite only the relevant lines.\n\n\
Editor buffer:\n```{language}\n{}\n```\n\n",
                numbered_buffer(&truncate_buffer(buffer))
            ));
        }
    }
    user_content.push_str(question);
    messages.push(ChatMessage {
        role: "user".into(),
        content: user_content,
    });

    let result = run_chat(
        ChatProvider::Xai,
        Some(model),
        system_prompt(),
        messages,
        Some(api_key.to_string()),
        None,
        0.4,
        on_token,
    )
    .await
    .map_err(|error| AppError {
        code: "GROK_ERROR",
        message: error.message,
        retryable: error.retryable,
        details: error.details,
    })?;

    Ok(GrokChatResult {
        reply: result.reply,
        model: result.model,
    })
}
