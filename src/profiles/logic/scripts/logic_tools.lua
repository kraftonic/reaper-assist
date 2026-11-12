-- REAPER Assist, "Coming from Logic Pro": the Tool menu's tools (shared by logic_tool_*.lua).
-- Each tool sets ABSOLUTE mouse-modifier values (the Pointer row is the profile's base map),
-- lights its own toolbar button and switches its siblings off. Tracks area and Piano Roll
-- have separate tools, as in Logic.
local L = {}

L.ARRANGE = { "pointer", "pencil", "eraser", "scissors", "mute", "zoom", "marquee" }
L.MIDI = { "pointer", "pencil", "eraser", "mute", "velocity", "brush" }
L.LABEL = { pointer = "Pointer", pencil = "Pencil", eraser = "Eraser", scissors = "Scissors", mute = "Mute",
  zoom = "Zoom", marquee = "Marquee", velocity = "Velocity", brush = "Brush" }

-- context, modifier flag, value per tool
local ARR = {
  { "MM_CTX_ITEM_CLK", 0, { pointer = "3 m", pencil = "3 m", eraser = "_assist_logic_erase_item", scissors = "42575 c", mute = "40175 c", zoom = "3 m", marquee = "3 m" } },
  { "MM_CTX_ITEM", 0, { pointer = "13 m", pencil = "13 m", eraser = "13 m", scissors = "13 m", mute = "13 m", zoom = "48 m", marquee = "62 m" } },
  { "MM_CTX_TRACK", 0, { pointer = "9 m", pencil = "5 m", eraser = "9 m", scissors = "9 m", mute = "9 m", zoom = "22 m", marquee = "25 m" } },
}
local PR = {
  { "MM_CTX_MIDI_NOTE_CLK", 0, { pointer = "1 m", pencil = "1 m", eraser = "6 m", mute = "7 m", velocity = "1 m", brush = "1 m" } },
  { "MM_CTX_MIDI_NOTE", 0, { pointer = "1 m", pencil = "1 m", eraser = "3 m", mute = "1 m", velocity = "9 m", brush = "1 m" } },
  { "MM_CTX_MIDI_PIANOROLL_CLK", 0, { pointer = "3 m", pencil = "4 m", eraser = "3 m", mute = "3 m", velocity = "3 m", brush = "4 m" } },
  { "MM_CTX_MIDI_PIANOROLL", 0, { pointer = "7 m", pencil = "1 m", eraser = "3 m", mute = "7 m", velocity = "7 m", brush = "22 m" } },
}

local NS = "assist_logic"
local MIDI_SECTION = 32060

function L.active(midi)
  local t = reaper.GetExtState(NS, midi and "miditool" or "tool")
  return t ~= "" and t or "pointer"
end

function L.select(tool, midi)
  local map = midi and PR or ARR
  local list = midi and L.MIDI or L.ARRANGE
  if not map[1][3][tool] then tool = "pointer" end
  if not midi then
    -- REAPER's arrange override tools (marquee/razor/comp) would hide ours: clear them.
    for _, id in ipairs({ 42616, 42618, 42620, 42633 }) do
      if reaper.GetToggleCommandState(id) == 1 then reaper.Main_OnCommand(42621, 0) break end
    end
  end
  for _, m in ipairs(map) do reaper.SetMouseModifier(m[1], m[2], m[3][tool]) end
  reaper.SetExtState(NS, midi and "miditool" or "tool", tool, true)
  local sec = midi and MIDI_SECTION or 0
  for _, n in ipairs(list) do
    local cmd = reaper.NamedCommandLookup("_RS_assist_logic_tool_" .. n .. (midi and "_midi" or ""))
    if cmd ~= 0 then
      reaper.SetToggleCommandState(sec, cmd, n == tool and 1 or 0)
      reaper.RefreshToolbar2(sec, cmd)
    end
  end
end

--- Run from a tool script: the section it was started from picks Tracks area or Piano Roll.
function L.run(tool)
  local _, _, sec = reaper.get_action_context()
  L.select(tool, sec == MIDI_SECTION)
end

--- Logic's T menu, at the mouse.
function L.menu()
  local _, _, sec = reaper.get_action_context()
  local midi = sec == MIDI_SECTION
  local list = midi and L.MIDI or L.ARRANGE
  local cur = L.active(midi)
  local items = {}
  for i, n in ipairs(list) do items[i] = (n == cur and "!" or "") .. L.LABEL[n] .. " Tool" end
  local x, y = reaper.GetMousePosition()
  gfx.init("Tools", 0, 0, 0, x, y)
  gfx.x, gfx.y = gfx.screentoclient(x, y)
  local pick = gfx.showmenu(table.concat(items, "|"))
  gfx.quit()
  if pick > 0 then L.select(list[pick], midi) end
end

return L
