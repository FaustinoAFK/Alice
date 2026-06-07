use crate::web_knowledge::{KnowledgeSufficiency, PageLink, PageSection, PageSnapshot};

fn tokenize(value: &str) -> Vec<String> {
    value
        .to_lowercase()
        .chars()
        .map(|character| {
            if character.is_alphanumeric() {
                character
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .filter(|token| token.len() > 2)
        .map(|token| token.to_string())
        .collect()
}

fn stop_words() -> &'static [&'static str] {
    &[
        "que",
        "isso",
        "essa",
        "esse",
        "esta",
        "este",
        "pagina",
        "pÃ¡gina",
        "site",
        "fala",
        "sobre",
        "para",
        "com",
        "tem",
        "nos",
        "nas",
        "dos",
        "das",
        "uma",
        "uns",
        "umas",
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
        let heading_score = if section.heading.to_lowercase().contains(term) {
            3
        } else {
            0
        };
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

pub(crate) fn select_matched_sections(
    snapshot: &PageSnapshot,
    question: &str,
    max_sections: usize,
    max_inspect_sections: usize,
) -> Vec<PageSection> {
    let effective_max_sections = max_sections.clamp(1, max_inspect_sections);
    let terms = question_terms(question);

    if !snapshot.selected_text.is_empty()
        && (terms.len() <= 2 || has_contextual_reference(question))
    {
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

pub(crate) fn select_matched_links(
    snapshot: &PageSnapshot,
    question: &str,
    max_links: usize,
) -> Vec<PageLink> {
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

pub(crate) fn determine_sufficiency(
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
            matched_sections.iter().any(|section| {
                format!("{} {}", section.heading, section.content)
                    .to_lowercase()
                    .contains(term.as_str())
            })
        })
        .count();

    if top_score >= 2 || matched_sections.len() >= 2 {
        KnowledgeSufficiency::Sufficient
    } else {
        KnowledgeSufficiency::Partial
    }
}
