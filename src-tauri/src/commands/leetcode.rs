use crate::error::AppError;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const GRAPHQL_URL: &str = "https://leetcode.com/graphql";
const LIST_CACHE_TTL: Duration = Duration::from_secs(600);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeetCodeListItem {
    pub title: String,
    pub title_slug: String,
    pub difficulty: String,
    pub paid_only: bool,
    pub frontend_id: String,
    pub topic_tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeetCodeCodeSnippet {
    pub lang: String,
    pub lang_slug: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeetCodeProblem {
    pub title: String,
    pub title_slug: String,
    pub difficulty: String,
    pub frontend_id: String,
    pub content: String,
    pub paid_only: bool,
    pub example_testcase_list: Vec<String>,
    pub code_snippets: Vec<LeetCodeCodeSnippet>,
    pub topic_tags: Vec<String>,
    pub meta_data: Option<String>,
    pub url: String,
}

#[derive(Default)]
struct ListCacheEntry {
    key: String,
    fetched_at: Option<Instant>,
    items: Vec<LeetCodeListItem>,
}

fn list_cache() -> &'static Mutex<ListCacheEntry> {
    static CACHE: OnceLock<Mutex<ListCacheEntry>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(ListCacheEntry::default()))
}

fn lc_error(message: impl Into<String>, retryable: bool) -> AppError {
    AppError {
        code: "LEETCODE_ERROR",
        message: message.into(),
        retryable,
        details: None,
    }
}

fn client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .user_agent("ScratchCLI/1.0 (Amazon OA practice; personal study)")
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|_| lc_error("Could not create HTTP client.", true))
}

async fn graphql(query: &str, variables: Value) -> Result<Value, AppError> {
    let client = client()?;
    let body = json!({ "query": query, "variables": variables });
    let response = client
        .post(GRAPHQL_URL)
        .header("Content-Type", "application/json")
        .header("Referer", "https://leetcode.com")
        .header("Origin", "https://leetcode.com")
        .json(&body)
        .send()
        .await
        .map_err(|_| lc_error("Could not reach LeetCode. Check your network.", true))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|_| lc_error("LeetCode returned an unreadable response.", true))?;

    if !status.is_success() {
        return Err(lc_error(
            format!("LeetCode HTTP {} — try again in a moment.", status.as_u16()),
            true,
        ));
    }

    let parsed: Value = serde_json::from_str(&text)
        .map_err(|_| lc_error("LeetCode returned invalid JSON.", true))?;

    if let Some(errors) = parsed.get("errors").and_then(|e| e.as_array()) {
        if !errors.is_empty() {
            let msg = errors
                .first()
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("GraphQL error");
            return Err(lc_error(format!("LeetCode: {msg}"), true));
        }
    }

    Ok(parsed)
}

fn parse_list_items(data: &Value) -> Vec<LeetCodeListItem> {
    let questions = data
        .pointer("/data/problemsetQuestionList/questions")
        .or_else(|| data.pointer("/data/problemsetQuestionList/data"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    questions
        .iter()
        .filter_map(|q| {
            let title = q.get("title")?.as_str()?.to_string();
            let title_slug = q.get("titleSlug")?.as_str()?.to_string();
            let difficulty = q
                .get("difficulty")
                .and_then(|d| d.as_str())
                .unwrap_or("Unknown")
                .to_string();
            let paid_only = q
                .get("paidOnly")
                .or_else(|| q.get("isPaidOnly"))
                .and_then(|p| p.as_bool())
                .unwrap_or(false);
            let frontend_id = q
                .get("frontendQuestionId")
                .or_else(|| q.get("questionFrontendId"))
                .map(|id| match id {
                    Value::String(s) => s.clone(),
                    Value::Number(n) => n.to_string(),
                    _ => String::new(),
                })
                .unwrap_or_default();
            let topic_tags = q
                .get("topicTags")
                .and_then(|t| t.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|tag| tag.get("name")?.as_str().map(str::to_string))
                        .collect()
                })
                .unwrap_or_default();
            Some(LeetCodeListItem {
                title,
                title_slug,
                difficulty,
                paid_only,
                frontend_id,
                topic_tags,
            })
        })
        .collect()
}

const LIST_QUERY: &str = r#"
query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: $filters
  ) {
    total: totalNum
    questions: data {
      difficulty
      frontendQuestionId: questionFrontendId
      paidOnly: isPaidOnly
      title
      titleSlug
      topicTags { name slug }
    }
  }
}
"#;

const QUESTION_QUERY: &str = r#"
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    title
    titleSlug
    content
    difficulty
    isPaidOnly
    exampleTestcaseList
    metaData
    topicTags { name slug }
    codeSnippets { lang langSlug code }
  }
}
"#;

async fn resolve_slug_from_id(id: &str) -> Result<String, AppError> {
    let variables = json!({
        "categorySlug": "",
        "limit": 20,
        "skip": 0,
        "filters": { "searchKeywords": id },
    });
    let data = graphql(LIST_QUERY, variables).await?;
    let items = parse_list_items(&data);
    if let Some(item) = items
        .into_iter()
        .find(|i| i.frontend_id == id && !i.paid_only)
    {
        return Ok(item.title_slug);
    }

    for page in 0..5 {
        let page_vars = json!({
            "categorySlug": "",
            "limit": 100,
            "skip": page * 100,
            "filters": {},
        });
        let page_data = graphql(LIST_QUERY, page_vars).await?;
        let page_items = parse_list_items(&page_data);
        if let Some(hit) = page_items
            .into_iter()
            .find(|i| i.frontend_id == id && !i.paid_only)
        {
            return Ok(hit.title_slug);
        }
    }

    Err(lc_error(
        format!("No free LeetCode problem found for id {id}."),
        false,
    ))
}

#[tauri::command]
pub async fn leetcode_list_problems(
    difficulty: Option<String>,
    limit: Option<u32>,
    skip: Option<u32>,
) -> Result<Vec<LeetCodeListItem>, AppError> {
    let difficulty = difficulty.unwrap_or_default().trim().to_uppercase();
    let limit = limit.unwrap_or(50).clamp(1, 100);
    let skip = skip.unwrap_or(0);
    let cache_key = format!("{difficulty}:{limit}:{skip}");

    if let Ok(cache) = list_cache().lock() {
        if cache.key == cache_key {
            if let Some(at) = cache.fetched_at {
                if at.elapsed() < LIST_CACHE_TTL {
                    return Ok(cache
                        .items
                        .iter()
                        .filter(|i| !i.paid_only)
                        .cloned()
                        .collect());
                }
            }
        }
    }

    let mut filters = json!({});
    if matches!(difficulty.as_str(), "EASY" | "MEDIUM" | "HARD") {
        filters["difficulty"] = json!(difficulty);
    }

    let variables = json!({
        "categorySlug": "",
        "limit": limit,
        "skip": skip,
        "filters": filters,
    });

    let data = graphql(LIST_QUERY, variables).await?;
    let items = parse_list_items(&data);
    let free: Vec<_> = items.into_iter().filter(|i| !i.paid_only).collect();

    if let Ok(mut cache) = list_cache().lock() {
        cache.key = cache_key;
        cache.fetched_at = Some(Instant::now());
        cache.items = free.clone();
    }

    Ok(free)
}

#[tauri::command]
pub async fn leetcode_get_problem(title_slug: String) -> Result<LeetCodeProblem, AppError> {
    let mut slug = title_slug.trim().to_lowercase();
    if slug.is_empty() {
        return Err(lc_error(
            "Provide a LeetCode title slug or problem id.",
            false,
        ));
    }

    if slug.chars().all(|c| c.is_ascii_digit()) {
        slug = resolve_slug_from_id(&slug).await?;
    }

    let variables = json!({ "titleSlug": slug });
    let data = graphql(QUESTION_QUERY, variables).await?;
    let q = data
        .pointer("/data/question")
        .ok_or_else(|| lc_error(format!("Problem not found: {slug}"), false))?;

    if q.is_null() {
        return Err(lc_error(format!("Problem not found: {slug}"), false));
    }

    let paid_only = q
        .get("isPaidOnly")
        .and_then(|p| p.as_bool())
        .unwrap_or(false);
    if paid_only {
        return Err(lc_error(
            "That problem is premium-only. Pick a free Easy/Medium instead.",
            false,
        ));
    }

    let title = q
        .get("title")
        .and_then(|t| t.as_str())
        .unwrap_or("Untitled")
        .to_string();
    let title_slug = q
        .get("titleSlug")
        .and_then(|t| t.as_str())
        .unwrap_or(&slug)
        .to_string();
    let difficulty = q
        .get("difficulty")
        .and_then(|d| d.as_str())
        .unwrap_or("Unknown")
        .to_string();
    let frontend_id = q
        .get("questionFrontendId")
        .map(|id| match id {
            Value::String(s) => s.clone(),
            Value::Number(n) => n.to_string(),
            _ => String::new(),
        })
        .unwrap_or_default();
    let content = q
        .get("content")
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();
    let example_testcase_list = q
        .get("exampleTestcaseList")
        .and_then(|e| e.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();
    let meta_data = q
        .get("metaData")
        .and_then(|m| m.as_str())
        .map(str::to_string);
    let topic_tags = q
        .get("topicTags")
        .and_then(|t| t.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|tag| tag.get("name")?.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();
    let code_snippets = q
        .get("codeSnippets")
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|snip| {
                    Some(LeetCodeCodeSnippet {
                        lang: snip.get("lang")?.as_str()?.to_string(),
                        lang_slug: snip.get("langSlug")?.as_str()?.to_string(),
                        code: snip.get("code")?.as_str()?.to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(LeetCodeProblem {
        title,
        title_slug: title_slug.clone(),
        difficulty,
        frontend_id,
        content,
        paid_only,
        example_testcase_list,
        code_snippets,
        topic_tags,
        meta_data,
        url: format!("https://leetcode.com/problems/{title_slug}/"),
    })
}
