export const USER_PROMPT_TEMPLATE_V2 = `Analyze the following webpage using the provided source content.

URL: {{url}}

Original Page Title: {{pageTitle}}

Webpage Content:

{{extractedText}}

1. Title

Use the original webpage title if it clearly and accurately represents the main content. Otherwise, generate a concise, descriptive title based on the webpage's central topic.

2. Summary

Write a concise summary in 2–3 sentences focused on the webpage's main topic, purpose, and most important takeaway. Avoid repeating details already covered in Key Findings.

3. Key Findings

Identify approximately 3–7 of the most important factual findings or insights presented in the webpage.

Focus on specific discoveries, results, facts, explanations, or conclusions that provide meaningful information to the reader.

Do not merely describe what topics the webpage covers, repeat the summary, or generate generic statements about the subject.

4. Evidence

For each finding:

1. Identify a meaningful passage containing a significant fact, result, observation, or explanation.
2. Extract the important information from that passage and express it as a clear, specific, and self-contained finding.
3. Provide concise supporting evidence drawn from the source.

The evidence must faithfully represent the source and directly and fully support the finding. Do not fabricate information or add details, conclusions, or interpretations that are not supported by the source.

Prioritize the most informative and distinctive findings. Avoid redundancy, and do not force a minimum count when the source contains limited meaningful information.

5. Entities

Identify approximately 3–5 core topics or concepts that best represent what the webpage is about.

Use concise, meaningful topic labels, similar to section headings, rather than an exhaustive list of named entities.

Prioritize the webpage's central themes over incidental names, organizations, tools, or technical details. Each topic must be clearly supported by the source content.

Do not force a minimum count when fewer topics are meaningful.

6. Dates or Numbers

For this experimental V2 rule, include only explicit, meaningful calendar dates that are directly relevant to the webpage's main content. Calendar dates may be complete dates, month-and-year references, or standalone years when the source explicitly presents them as meaningful dates.

Exclude quantities, percentages, statistics, version numbers, identifiers, time periods, and unrelated or incidental dates.

Include enough source-supported context to make each date understandable on its own.

Do not infer, calculate, or convert dates.

Return an empty array if no relevant explicit calendar dates are present.

7. Missing Information

Identify meaningful content gaps directly related to the webpage's main purpose or important claims.

Prioritize missing supporting evidence, methodology, context, or essential explanations.

Avoid generic or speculative gaps unrelated to the webpage's intended scope. State each missing piece clearly and specifically. Do not suggest solutions, recommendations, or actions.

Return an empty array if no significant content gaps can be identified.

Return the analysis using the required structured JSON schema. Do not include information outside the schema.`;

export interface UserPromptV2Data {
  url: string;
  pageTitle: string | null;
  extractedText: string;
}

export function renderUserPromptV2(data: UserPromptV2Data): string {
  return USER_PROMPT_TEMPLATE_V2.replace("{{url}}", () => data.url)
    .replace("{{pageTitle}}", () => data.pageTitle ?? "")
    .replace("{{extractedText}}", () => data.extractedText);
}
