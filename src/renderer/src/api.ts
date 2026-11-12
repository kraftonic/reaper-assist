import type { AssistApi } from "@shared/types";

declare global {
  interface Window {
    assist: AssistApi;
  }
}

/** The preload bridge. (Undefined outside Electron, e.g. when components are rendered in tests.) */
export const api: AssistApi = typeof window === "undefined" ? ({} as AssistApi) : window.assist;
