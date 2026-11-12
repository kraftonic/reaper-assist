import type { ImageRef } from "@shared/types";

/** What goes with a message besides its text. Everything is optional. */
export interface SendInput {
  /** Images already stored with the chat (ConversationStore.addImage). */
  images?: ImageRef[];
  /** A skill picked with a / command: its text goes to the model, the transcript keeps the short form. */
  skill?: { id: string; title: string; body: string };
  /** REAPER context parts the user switched off for this message (ContextChip ids). */
  contextOff?: string[];
  /** Labels of the REAPER context that goes with the message, shown under the user's message. */
  contextLabels?: string[];
  /** Lines for the model only, e.g. what the @-mentions in the text refer to. */
  modelNotes?: string;
}

const attr = (s: string) => s.replace(/[<>"&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "&": "&amp;" })[c]!);

/** The text the model gets for a user message (before the REAPER context is wrapped around it). */
export function composeUserText(text: string, input: SendInput = {}, panelNotes: string | null = null): string {
  const blocks: string[] = [];
  if (panelNotes) blocks.push(`<panel_events>\nSince your last reply, in the Assist panel:\n${panelNotes}\n</panel_events>`);
  if (input.skill) blocks.push(`<skill id="${attr(input.skill.id)}" title="${attr(input.skill.title)}">\n${input.skill.body.trim()}\n</skill>`);
  if (input.modelNotes) blocks.push(input.modelNotes.trim());
  const body = text.trim() || (input.skill ? `Use the ${input.skill.title} skill on my session.` : input.images?.length ? "Take a look at this image." : "");
  return blocks.length ? `${blocks.join("\n\n")}\n\n${body}` : body;
}

/** A short title for a new chat that starts with no text. */
export function fallbackTitle(input: SendInput): string {
  if (input.skill) return input.skill.title;
  if (input.images?.length) return input.images[0]!.name ?? "Image";
  return "New chat";
}
