-- REAPER Assist: Coming from Studio One. Tools 1-8 (arrange) and 1-7 (note editor).
-- Run through studioone_tool_<name>.lua, which sets ASSIST_S1_TOOL. Each tool writes ABSOLUTE
-- mouse-modifier values: the Arrow (base) map for every slot, then its own changes on top.
-- BASE must match the profile's mouse map (src/profiles/studioone/profile.ts); -1 = REAPER's default.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local _, _, section, cmd = reaper.get_action_context()
local midi = section == 32060
local TOOL = ASSIST_S1_TOOL or "arrow"

local BASE_ARRANGE = {
  MM_CTX_ITEM = -1,          -- drag an event: move
  MM_CTX_ITEM_CLK = "3 m",   -- click an event: select (the cursor stays)
  MM_CTX_TRACK = "9 m",      -- drag in empty space: selection rectangle
  MM_CTX_TRACK_CLK = "3 m",  -- click in empty space: deselect (the cursor stays)
  MM_CTX_ENVLANE = -1,
  MM_CTX_ENVSEG = -1,
}
local BASE_MIDI = {
  MM_CTX_MIDI_NOTE = -1,              -- drag a note: move
  MM_CTX_MIDI_NOTE_CLK = "1 m",       -- click a note: select
  MM_CTX_MIDI_PIANOROLL = "7 m",      -- drag in empty space: selection rectangle
  MM_CTX_MIDI_PIANOROLL_CLK = "3 m",  -- click in empty space: deselect
}

local ARRANGE = {
  arrow = {},
  range = { MM_CTX_ITEM = "62 m", MM_CTX_TRACK = "25 m" },                       -- select razor edit area
  split = { MM_CTX_ITEM = "27 m", MM_CTX_ITEM_CLK = "42575 c" },                 -- click splits under the mouse
  eraser = { MM_CTX_ITEM = "27 m", MM_CTX_ITEM_CLK = "_assist_studioone_erase" },
  paint = { MM_CTX_TRACK = "5 m", MM_CTX_ENVLANE = "4 m", MM_CTX_ENVSEG = "10 m" }, -- draw a part, draw automation
  mute = { MM_CTX_ITEM = "27 m", MM_CTX_ITEM_CLK = "_assist_studioone_mute_click" },
  bend = { MM_CTX_ITEM_CLK = "15 m" },                                           -- add a stretch (bend) marker
  listen = { MM_CTX_ITEM = "27 m", MM_CTX_ITEM_CLK = "_RS_assist_studioone_listen", MM_CTX_TRACK_CLK = "_RS_assist_studioone_listen" },
}
local MIDI = {
  arrow = {},
  range = { MM_CTX_MIDI_PIANOROLL = "10 m" },                                    -- marquee notes and time
  split = { MM_CTX_MIDI_NOTE_CLK = "40052 c" },                                  -- split notes at the mouse
  eraser = { MM_CTX_MIDI_NOTE_CLK = "6 m", MM_CTX_MIDI_NOTE = "3 m", MM_CTX_MIDI_PIANOROLL = "3 m" },
  paint = { MM_CTX_MIDI_PIANOROLL = "22 m", MM_CTX_MIDI_PIANOROLL_CLK = "4 m" },   -- paint notes, click inserts
  mute = { MM_CTX_MIDI_NOTE_CLK = "7 m" },                                       -- click toggles note mute
  listen = { MM_CTX_MIDI_PIANOROLL = "16 m" },                                   -- drag to scrub-preview
}
local ORDER_ARRANGE = { "arrow", "range", "split", "eraser", "paint", "mute", "bend", "listen" }
local ORDER_MIDI = { "arrow", "range", "split", "eraser", "paint", "mute", "listen" }

local base, tools, order = BASE_ARRANGE, ARRANGE, ORDER_ARRANGE
if midi then base, tools, order = BASE_MIDI, MIDI, ORDER_MIDI end
local this = tools[TOOL] or {}
for ctx, v in pairs(base) do
  local want = this[ctx]
  if want == nil then want = v end
  reaper.SetMouseModifier(ctx, 0, want)
end

for _, name in ipairs(order) do
  local id = reaper.NamedCommandLookup("_RS_assist_studioone_tool_" .. name .. (midi and "_midi" or ""))
  if id ~= 0 then
    reaper.SetToggleCommandState(section, id, name == TOOL and 1 or 0)
    reaper.RefreshToolbar2(section, id)
  end
end
reaper.SetExtState("assist_studioone", midi and "midi_tool" or "tool", TOOL, false) -- not persisted: nothing left behind after Restore
reaper.defer(function() end) -- no undo point: switching tools doesn't change the project
