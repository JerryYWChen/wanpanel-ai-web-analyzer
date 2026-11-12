import { SYSTEM_PROMPT_V1 } from "./v1/system-prompt.js";
import {
  renderUserPromptV1,
  USER_PROMPT_TEMPLATE_V1,
  type UserPromptV1Data,
} from "./v1/user-prompt.js";
import { SYSTEM_PROMPT_V2 } from "./v2/system-prompt.js";
import {
  renderUserPromptV2,
  USER_PROMPT_TEMPLATE_V2,
  type UserPromptV2Data,
} from "./v2/user-prompt.js";

export const promptVersions = ["v1", "v2"] as const;

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
  {
    version: "v2",
    system: SYSTEM_PROMPT_V2,
    user: USER_PROMPT_TEMPLATE_V2,
  },
];

export interface RenderedPrompts {
  version: PromptVersion;
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

export function buildPromptV2(data: UserPromptV2Data): RenderedPrompts {
  return {
    version: "v2",
    system: SYSTEM_PROMPT_V2,
    user: renderUserPromptV2(data),
    userTemplate: USER_PROMPT_TEMPLATE_V2,
  };
}

export function buildPrompts(
  version: PromptVersion,
  data: UserPromptV1Data,
): RenderedPrompts {
  return version === "v1" ? buildPromptV1(data) : buildPromptV2(data);
}
