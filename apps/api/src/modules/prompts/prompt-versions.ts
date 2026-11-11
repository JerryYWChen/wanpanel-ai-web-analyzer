import { SYSTEM_PROMPT_V1 } from "./v1/system-prompt.js";
import {
  renderUserPromptV1,
  USER_PROMPT_TEMPLATE_V1,
  type UserPromptV1Data,
} from "./v1/user-prompt.js";

export const promptVersions = ["v1"] as const;

export type PromptVersion = (typeof promptVersions)[number];

export interface PromptTemplate {
  version: PromptVersion;
  system: string;
  user: string;
}

export const promptTemplates: readonly PromptTemplate[] = [
  {
    version: "v1",
    system: SYSTEM_PROMPT_V1,
    user: USER_PROMPT_TEMPLATE_V1,
  },
];

export interface RenderedPrompts {
  version: "v1";
  system: string;
  user: string;
  userTemplate: string;
}

export function buildPromptV1(data: UserPromptV1Data): RenderedPrompts {
  return {
    version: "v1",
    system: SYSTEM_PROMPT_V1,
    user: renderUserPromptV1(data),
    userTemplate: USER_PROMPT_TEMPLATE_V1,
  };
}
