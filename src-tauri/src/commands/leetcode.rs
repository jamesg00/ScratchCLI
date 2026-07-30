use crate::error::AppError;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const GRAPHQL_URL: &str = "https://leetcode.com/graphql";
const LIST_CACHE_TTL: Duration = Duration::from_secs(600);
const COMPANY_DATA_URL: &str =
    "https://raw.githubusercontent.com/seanprashad/leetcode-patterns/main/src/data/questions.json";
const COMPANY_CACHE_TTL: Duration = Duration::from_secs(60 * 60 * 12);

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

#[derive(Default)]
struct CompanyCacheEntry {
    fetched_at: Option<Instant>,
    problems: Vec<CompanyProblem>,
}

#[derive(Debug, Clone, Deserialize)]
struct SeanQuestionsFile {
    data: Vec<SeanQuestion>,
}

#[derive(Debug, Clone, Deserialize)]
struct SeanQuestion {
    id: u32,
    title: String,
    slug: String,
    pattern: Vec<String>,
    difficulty: String,
    premium: bool,
    companies: Vec<SeanCompanyRef>,
}

#[derive(Debug, Clone, Deserialize)]
struct SeanCompanyRef {
    name: String,
    slug: String,
    frequency: u32,
}

#[derive(Debug, Clone)]
struct CompanyProblem {
    item: LeetCodeListItem,
    companies: Vec<SeanCompanyRef>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LeetCodeCompanyInfo {
    pub name: String,
    pub slug: String,
    pub question_count: u32,
    pub total_frequency: u32,
}

fn list_cache() -> &'static Mutex<ListCacheEntry> {
    static CACHE: OnceLock<Mutex<ListCacheEntry>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(ListCacheEntry::default()))
}

fn company_cache() -> &'static Mutex<CompanyCacheEntry> {
    static CACHE: OnceLock<Mutex<CompanyCacheEntry>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(CompanyCacheEntry::default()))
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

async fn fetch_company_problems() -> Result<Vec<CompanyProblem>, AppError> {
    if let Ok(cache) = company_cache().lock() {
        if let Some(at) = cache.fetched_at {
            if at.elapsed() < COMPANY_CACHE_TTL {
                return Ok(cache.problems.clone());
            }
        }
    }

    let response = client()?
        .get(COMPANY_DATA_URL)
        .send()
        .await
        .map_err(|error| lc_error(format!("Could not reach company patterns list: {error}"), true))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|_| lc_error("Company patterns list returned an unreadable response.", true))?;
    if !status.is_success() {
        return Err(lc_error(
            format!(
                "Company patterns list HTTP {} — try again in a moment.",
                status.as_u16()
            ),
            true,
        ));
    }
    let parsed: SeanQuestionsFile = serde_json::from_str(&text)
        .map_err(|_| lc_error("Company patterns list returned invalid JSON.", true))?;

    let problems: Vec<CompanyProblem> = parsed
        .data
        .into_iter()
        .map(|question| CompanyProblem {
            item: LeetCodeListItem {
                title: question.title,
                title_slug: question.slug,
                difficulty: question.difficulty,
                paid_only: question.premium,
                frontend_id: question.id.to_string(),
                topic_tags: question.pattern,
            },
            companies: question.companies,
        })
        .collect();

    if let Ok(mut cache) = company_cache().lock() {
        cache.fetched_at = Some(Instant::now());
        cache.problems = problems.clone();
    }
    Ok(problems)
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
pub async fn leetcode_list_companies() -> Result<Vec<LeetCodeCompanyInfo>, AppError> {
    let problems = fetch_company_problems().await?;
    let mut map = std::collections::BTreeMap::<String, LeetCodeCompanyInfo>::new();
    for problem in problems.iter().filter(|problem| !problem.item.paid_only) {
        for company in &problem.companies {
            let entry = map.entry(company.slug.clone()).or_insert(LeetCodeCompanyInfo {
                name: company.name.clone(),
                slug: company.slug.clone(),
                question_count: 0,
                total_frequency: 0,
            });
            entry.question_count += 1;
            entry.total_frequency += company.frequency;
        }
    }
    let mut companies: Vec<_> = map.into_values().collect();
    companies.sort_by(|a, b| {
        b.total_frequency
            .cmp(&a.total_frequency)
            .then_with(|| b.question_count.cmp(&a.question_count))
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(companies)
}

#[tauri::command]
pub async fn leetcode_list_company_problems(
    company_slug: String,
    difficulty: Option<String>,
    limit: Option<u32>,
    skip: Option<u32>,
) -> Result<Vec<LeetCodeListItem>, AppError> {
    let company_slug = company_slug.trim().to_ascii_lowercase();
    if company_slug.is_empty() {
        return Err(lc_error("Choose a company first.", false));
    }
    let difficulty = difficulty.unwrap_or_default().trim().to_ascii_lowercase();
    let limit = limit.unwrap_or(50).clamp(1, 100) as usize;
    let skip = skip.unwrap_or(0) as usize;
    let problems = fetch_company_problems().await?;
    let mut filtered: Vec<(LeetCodeListItem, u32)> = problems
        .into_iter()
        .filter(|problem| !problem.item.paid_only)
        .filter_map(|problem| {
            let freq = problem
                .companies
                .iter()
                .find(|company| company.slug.eq_ignore_ascii_case(&company_slug))
                .map(|company| company.frequency)?;
            if matches!(difficulty.as_str(), "easy" | "medium" | "hard")
                && !problem.item.difficulty.eq_ignore_ascii_case(&difficulty)
            {
                return None;
            }
            Some((problem.item, freq))
        })
        .collect();

    filtered.sort_by(|a, b| {
        b.1.cmp(&a.1)
            .then_with(|| a.0.paid_only.cmp(&b.0.paid_only))
            .then_with(|| a.0.title.cmp(&b.0.title))
    });

    Ok(filtered
        .into_iter()
        .skip(skip)
        .take(limit)
        .map(|(item, _)| item)
        .collect())
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
