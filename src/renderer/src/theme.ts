import { THEME_TOKENS, type Theme, type ThemeToken } from "@shared/types";
import { WORKFLOWS, findWorkflow, type Workflow, type WorkflowId } from "@profiles";

/**
 * The panel's look follows the DAW profile the user picked ("Coming from…"), so the
 * panel sits next to REAPER in the same colours. With no profile it matches REAPER's
 * own Default 7 theme. There are no other skins.
 */

const SYS = `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif`;

/** REAPER's own Default 7 greys and teal: used until a DAW profile is picked. */
export const REAPER_THEME: Theme = {
  id: "reaper", name: "REAPER", blurb: "Matches REAPER's own theme", scheme: "dark",
  colors: { bg: "#333333", panel: "#424242", panelAlt: "#4b4b4b", border: "#262626", text: "#dcdcdc", textDim: "#9a9a9a", accent: "#339887", accentText: "#06110f", accent2: "#efc852", ok: "#5fbf6a", warn: "#efc852", danger: "#e0524d", userBubble: "#515151", codeBg: "#2b2b2b" },
  radius: 3, fontFamily: SYS, fontSize: 13, density: 1, surface: "flat",
};

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "").slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luma(hex: string): number {
  const rgb = hexToRgb(hex);
  return rgb ? (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 : 0;
}

export function withAlpha(hex: string, a: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
}

const cssName = (t: ThemeToken) => `--${t.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}`;

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const t of THEME_TOKENS) root.style.setProperty(cssName(t), theme.colors[t]);
  root.style.setProperty("--accent-soft", withAlpha(theme.colors.accent, 0.16));
  root.style.setProperty("--accent-glow", withAlpha(theme.colors.accent, 0.35));
  root.style.setProperty("--radius", `${theme.radius}px`);
  root.style.setProperty("--font", theme.fontFamily);
  root.style.setProperty("--fs", `${theme.fontSize}px`);
  root.style.setProperty("--d", String(theme.density));
  root.dataset.surface = theme.surface;
  root.dataset.scheme = theme.scheme;
  root.style.colorScheme = theme.scheme;
}

/** The panel look that goes with a "Coming from…" profile, so the panel matches REAPER. */
export function workflowTheme(w: Workflow): Theme {
  const p = w.panel;
  const light = luma(p.panel) > 0.5;
  return {
    id: `wf-${w.id}`, name: w.daw, blurb: `Matches the ${w.daw} profile`, scheme: light ? "light" : "dark",
    colors: { ...p, ok: light ? "#2f8f3a" : "#5fbf6a", warn: light ? "#a86b00" : "#e8b840", danger: light ? "#c8322b" : "#e0524d", userBubble: p.panelAlt, codeBg: p.border },
    radius: 4, fontFamily: SYS, fontSize: 13, density: 1, surface: "flat",
  };
}

export const WORKFLOW_THEMES = WORKFLOWS.map(workflowTheme);

/** The panel's look for the current profile (or REAPER's own look with none). */
export function themeFor(workflow: WorkflowId | null): Theme {
  const w = findWorkflow(workflow);
  return w ? workflowTheme(w) : REAPER_THEME;
}
