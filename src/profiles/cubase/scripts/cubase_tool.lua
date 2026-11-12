-- REAPER Assist, "Coming from Cubase": the nine Cubase tools (1 Object Selection, 2 Range,
-- 3 Split, 4 Glue, 5 Erase, 6 Zoom, 7 Mute, 8 Draw, 9 Play), plus previous/next tool.
-- One file, registered under several ids (RS_assist_cubase_tool_N, _tool_prev, _tool_next,
-- and RS_assist_cubase_midi_tool_N in the MIDI editor); the id says which tool.
-- Every run writes ABSOLUTE values to every mouse slot a tool uses (the profile's base map for
-- slots the tool leaves alone) and lights exactly one tool button in each section.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts

local BASE = {
  -- context, modifier flag, value (the Object Selection tool = the profile's base map)
  { "MM_CTX_ITEM", 0, "13 m" },                -- drag an event: move
  { "MM_CTX_ITEM_CLK", 0, "3 m" },             -- click an event: select it (the cursor stays)
  { "MM_CTX_ITEM_CLK", 4, "31 m" },            -- Alt-click: split
  { "MM_CTX_TRACK", 0, "9 m" },                -- drag empty space: rubber-band select
  { "MM_CTX_TRACK_CLK", 0, "1 m" },            -- click empty space: deselect, locate
  { "MM_CTX_TRACK_CLK", 4, "3 m" },            -- Alt-click empty space: deselect
  { "MM_CTX_MIDI_NOTE", 0, "1 m" },            -- drag a note: move
  { "MM_CTX_MIDI_NOTE_CLK", 0, "1 m" },        -- click a note: select
  { "MM_CTX_MIDI_PIANOROLL", 0, "7 m" },       -- drag empty piano roll: rubber-band select
  { "MM_CTX_MIDI_PIANOROLL_CLK", 0, "1 m" },   -- click empty piano roll: deselect, locate
}

-- What each tool changes (slot key "CTX|flag" -> value); everything else is BASE.
local TOOLS = {
  [1] = {},
  [2] = { ["MM_CTX_ITEM|0"] = "62 m", ["MM_CTX_TRACK|0"] = "25 m", ["MM_CTX_MIDI_PIANOROLL|0"] = "4 m" },
  [3] = { ["MM_CTX_ITEM_CLK|0"] = "31 m", ["MM_CTX_MIDI_NOTE_CLK|0"] = "40052 c" },
  [4] = { ["MM_CTX_ITEM_CLK|0"] = "_RS_assist_cubase_glue_click" },
  [5] = { ["MM_CTX_ITEM_CLK|0"] = "_RS_assist_cubase_erase_click", ["MM_CTX_MIDI_NOTE_CLK|0"] = "6 m",
          ["MM_CTX_MIDI_NOTE|0"] = "3 m", ["MM_CTX_MIDI_PIANOROLL|0"] = "3 m" },
  [6] = { ["MM_CTX_ITEM|0"] = "48 m", ["MM_CTX_TRACK|0"] = "22 m",
          ["MM_CTX_ITEM_CLK|0"] = "_RS_assist_cubase_zoom_in_click", ["MM_CTX_TRACK_CLK|0"] = "_RS_assist_cubase_zoom_in_click",
          ["MM_CTX_ITEM_CLK|4"] = "_RS_assist_cubase_zoom_out_click", ["MM_CTX_TRACK_CLK|4"] = "_RS_assist_cubase_zoom_out_click" },
  [7] = { ["MM_CTX_ITEM_CLK|0"] = "_RS_assist_cubase_mute_click", ["MM_CTX_MIDI_NOTE_CLK|0"] = "7 m" },
  [8] = { ["MM_CTX_TRACK|0"] = "5 m", ["MM_CTX_MIDI_PIANOROLL|0"] = "14 m", ["MM_CTX_MIDI_PIANOROLL_CLK|0"] = "4 m",
          ["MM_CTX_MIDI_NOTE_CLK|0"] = "6 m" },
  [9] = { ["MM_CTX_ITEM_CLK|0"] = "_RS_assist_cubase_play_click", ["MM_CTX_TRACK_CLK|0"] = "_RS_assist_cubase_play_click" },
}
local NAMES = { "Object Selection", "Range Selection", "Split", "Glue", "Erase", "Zoom", "Mute", "Draw", "Play" }
local NS = "assist_cubase"

local _, _, _, cmd = reaper.get_action_context()
local id = reaper.ReverseNamedCommandLookup(cmd) or ""
local cur = tonumber(reaper.GetExtState(NS, "tool")) or 1
local n = tonumber(id:match("tool_(%d)$"))
if id:match("tool_prev$") then n = (cur + 7) % 9 + 1 end
if id:match("tool_next$") then n = cur % 9 + 1 end
if not n or not TOOLS[n] then n = 1 end

for _, s in ipairs(BASE) do
  local v = TOOLS[n][s[1] .. "|" .. s[2]] or s[3]
  reaper.SetMouseModifier(s[1], s[2], v)
end
reaper.SetExtState(NS, "tool", tostring(n), true)

for i = 1, 9 do
  local main = reaper.NamedCommandLookup("_RS_assist_cubase_tool_" .. i)
  if main ~= 0 then reaper.SetToggleCommandState(0, main, i == n and 1 or 0); reaper.RefreshToolbar2(0, main) end
  local midi = reaper.NamedCommandLookup("_RS_assist_cubase_midi_tool_" .. i)
  if midi ~= 0 then reaper.SetToggleCommandState(32060, midi, i == n and 1 or 0); reaper.RefreshToolbar2(32060, midi) end
end
local x, y = reaper.GetMousePosition()
reaper.TrackCtl_SetToolTip(NAMES[n] .. " tool", x + 16, y + 16, true)
reaper.defer(function() end) -- no undo point
