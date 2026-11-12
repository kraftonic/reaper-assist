-- REAPER Assist, "Coming from FL Studio": the playlist / piano-roll tools
-- (P Draw, B Paint, D Delete, T Mute, C Slice, E Select).
-- One file, registered under RS_assist_fl_tool_<name> (main) and RS_assist_fl_tool_<name>_midi
-- (MIDI editor); the command id says which tool. Every run writes ABSOLUTE values to every mouse
-- slot a tool uses (the Draw tool = the profile's base map) and lights exactly one tool button in
-- each section.

local SLOTS = {
  "MM_CTX_TRACK_CLK", "MM_CTX_TRACK", "MM_CTX_ITEM", "MM_CTX_ITEM_CLK",
  "MM_CTX_MIDI_PIANOROLL_CLK", "MM_CTX_MIDI_PIANOROLL", "MM_CTX_MIDI_NOTE", "MM_CTX_MIDI_NOTE_CLK",
}

-- Values per tool, in SLOTS order (modifier flag 0 only).
local TOOLS = {
  -- Draw: click places the pattern / a note, drag draws a linked copy / a note.
  draw = { "_RS_assist_fl_place_pattern", "16 m", "13 m", "3 m", "4 m", "12 m", "1 m", "1 m" },
  -- Paint: drag paints a run of pattern copies / notes.
  paint = { "_RS_assist_fl_place_pattern", "16 m", "13 m", "3 m", "4 m", "22 m", "1 m", "1 m" },
  -- Delete: click a clip or note to delete it, drag over notes to erase.
  delete = { "1 m", "9 m", "13 m", "_assist_fl_delete_item", "3 m", "3 m", "3 m", "6 m" },
  -- Mute: click a clip or note to mute / unmute it.
  mute = { "1 m", "9 m", "13 m", "_assist_fl_mute_item", "3 m", "7 m", "1 m", "7 m" },
  -- Slice: click a clip to cut it at the mouse; click a note to split it.
  slice = { "1 m", "9 m", "13 m", "31 m", "3 m", "7 m", "1 m", "40052 c" },
  -- Select: drag a selection rectangle.
  select = { "1 m", "9 m", "13 m", "3 m", "1 m", "7 m", "1 m", "1 m" },
}
local ORDER = { "draw", "paint", "delete", "mute", "slice", "select" }
local LABEL = { draw = "Draw", paint = "Paint", delete = "Delete", mute = "Mute", slice = "Slice", select = "Select" }

local _, _, _, cmd = reaper.get_action_context()
local id = reaper.ReverseNamedCommandLookup(cmd) or ""
local tool = id:match("fl_tool_(%a+)")
if not TOOLS[tool] then tool = "draw" end

for i, ctx in ipairs(SLOTS) do reaper.SetMouseModifier(ctx, 0, TOOLS[tool][i]) end
reaper.SetExtState("assist_fl", "tool", tool, true)

for _, t in ipairs(ORDER) do
  local state = t == tool and 1 or 0
  local main = reaper.NamedCommandLookup("_RS_assist_fl_tool_" .. t)
  if main ~= 0 then reaper.SetToggleCommandState(0, main, state); reaper.RefreshToolbar2(0, main) end
  local midi = reaper.NamedCommandLookup("_RS_assist_fl_tool_" .. t .. "_midi")
  if midi ~= 0 then reaper.SetToggleCommandState(32060, midi, state); reaper.RefreshToolbar2(32060, midi) end
end
local x, y = reaper.GetMousePosition()
reaper.TrackCtl_SetToolTip(LABEL[tool] .. " tool", x + 16, y + 16, true)
reaper.defer(function() end) -- no undo point
