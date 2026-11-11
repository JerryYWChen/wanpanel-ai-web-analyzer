export const USER_PROMPT_TEMPLATE_V1 = `Analyze the following webpage content.

URL: {{url}}

Page Title: {{pageTitle}}

Webpage Content:

{{extractedText}}

Generate:

1. A concise title and summary.

2. Key findings with supporting evidence.

3. Important entities.

4. Dates or numerical information.

5. Important missing information.

Use the required structured output format.`;

export interface UserPromptV1Data {
  url: string;
  pageTitle: string | null;
  extractedText: string;
}

export function renderUserPromptV1(data: UserPromptV1Data): string {
  return USER_PROMPT_TEMPLATE_V1.replace("{{url}}", () => data.url)
    .replace("{{pageTitle}}", () => data.pageTitle ?? "")
    .replace("{{extractedText}}", () => data.extractedText);
}
