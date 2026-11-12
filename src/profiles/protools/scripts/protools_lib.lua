-- REAPER Assist, "Coming from Pro Tools": shared code for the protools_*.lua actions.
-- Loaded with dofile() by each action; not an action itself. Native REAPER API only.
local L = {}
local NS = "assist_protools"

local function get(key, default)
  local v = reaper.GetExtState(NS, key)
  if v == "" then return default end
  return v
end
local function put(key, v) reaper.SetExtState(NS, key, tostring(v), true) end
L.get, L.put = get, put

local function cmd(name) return reaper.NamedCommandLookup("_RS_assist_protools_" .. name) end

--- Light (or not) one of our commands on toolbars.
function L.light(name, on)
  local id = cmd(name)
  if id ~= 0 then
    reaper.SetToggleCommandState(0, id, on and 1 or 0)
    reaper.RefreshToolbar2(0, id)
  end
end

-- Mouse map. Every slot a tool or edit mode sets, with the Smart Tool (base) value.
-- -1 = REAPER's own default for that slot. Values are behaviour ids read back from REAPER 7.82.
local SLOTS = {
  "MM_CTX_ITEM", "MM_CTX_ITEMLOWER", "MM_CTX_ITEM_CLK", "MM_CTX_ITEMLOWER_CLK", "MM_CTX_TRACK", "MM_CTX_TRACK_CLK",
  "MM_CTX_ENVLANE", "MM_CTX_ENVSEG", "MM_CTX_MIDI_PIANOROLL", "MM_CTX_MIDI_PIANOROLL_CLK", "MM_CTX_ARRANGE_A",
}
local GRAB_CLICK = "_assist_protools_grab_click"
local BASE = {
  MM_CTX_ITEM = "66 m",                 -- top half: select razor edit area and time (Selector)
  MM_CTX_ITEMLOWER = "1 m",             -- bottom half: move item (Grabber)
  MM_CTX_ITEM_CLK = "1 m",              -- click: select item and move edit cursor
  MM_CTX_ITEMLOWER_CLK = GRAB_CLICK,    -- click bottom half: select the whole clip and its range
  MM_CTX_TRACK = "29 m",                -- empty track: select razor edit area and time
  MM_CTX_TRACK_CLK = "1 m",             -- deselect all items and move edit cursor
  MM_CTX_ENVLANE = -1,
  MM_CTX_ENVSEG = -1,
  MM_CTX_MIDI_PIANOROLL = "7 m",        -- MIDI: marquee select notes
  MM_CTX_MIDI_PIANOROLL_CLK = -1,
  MM_CTX_ARRANGE_A = -1,
}
local TOOLS = {
  smart = {},
  grab = { MM_CTX_ITEM = "1 m", MM_CTX_ITEM_CLK = GRAB_CLICK, MM_CTX_TRACK = "9 m" },
  select = { MM_CTX_ITEMLOWER = "66 m", MM_CTX_ITEMLOWER_CLK = "1 m" },
  trim = { MM_CTX_ITEM = "27 m", MM_CTX_ITEMLOWER = "27 m", MM_CTX_TRACK = "9 m" },
  zoom = { MM_CTX_ITEM = "48 m", MM_CTX_ITEMLOWER = "48 m", MM_CTX_TRACK = "22 m",
           MM_CTX_ITEM_CLK = "1012 c", MM_CTX_ITEMLOWER_CLK = "1012 c", MM_CTX_TRACK_CLK = "1012 c" },
  scrub = { MM_CTX_ARRANGE_A = "10 m" }, -- arrange view override A = scrub audio
  pencil = { MM_CTX_TRACK = "5 m", MM_CTX_ENVLANE = "4 m", MM_CTX_ENVSEG = "10 m",
             MM_CTX_MIDI_PIANOROLL = "1 m", MM_CTX_MIDI_PIANOROLL_CLK = "4 m" },
}
L.TOOL_ORDER = { "smart", "zoom", "trim", "select", "grab", "scrub", "pencil" }
L.MODE_ORDER = { "shuffle", "slip", "spot", "grid" }

--- Set the whole mouse map (absolute values) for the current tool and edit mode, and light the buttons.
function L.apply()
  local tool = get("tool", "smart")
  if not TOOLS[tool] then tool = "smart" end
  local mode = get("mode", "")
  local t = TOOLS[tool]
  for _, ctx in ipairs(SLOTS) do
    local v = t[ctx]
    if v == nil then v = BASE[ctx] end
    if mode == "spot" and (ctx == "MM_CTX_ITEM_CLK" or ctx == "MM_CTX_ITEMLOWER_CLK") then v = "_RS_assist_protools_spot" end
    reaper.SetMouseModifier(ctx, 0, v)
  end
  reaper.Main_OnCommand(tool == "scrub" and 42615 or 42621, 0) -- set override A / clear overrides
  for _, n in ipairs(L.TOOL_ORDER) do L.light("tool_" .. n, n == tool) end
  for _, n in ipairs(L.MODE_ORDER) do L.light("mode_" .. n, n == mode) end
end

function L.tool(name)
  put("tool", name)
  L.apply()
end

--- Edit modes: Shuffle = ripple per track + snap off; Slip = no ripple, no snap; Spot = Slip + a
--- "spot to" dialog on clip clicks; Grid = snap on.
function L.mode(m)
  put("mode", m)
  reaper.Main_OnCommand(m == "shuffle" and 40310 or 40309, 0)
  reaper.Main_OnCommand(m == "grid" and 40754 or 40753, 0)
  L.apply()
end

function L.cycle(list, key, default, f)
  local cur = get(key, default)
  local nxt = list[1]
  for i, n in ipairs(list) do if n == cur then nxt = list[i % #list + 1] end end
  f(nxt)
end

--- A script's own on/off switch kept in ExtState; lights the script's button.
function L.flag(key, name, on)
  if on == nil then on = get(key, "0") ~= "1" end
  put(key, on and "1" or "0")
  L.light(name, on)
  return on
end

function L.hasRazor()
  for i = 0, reaper.CountTracks(0) - 1 do
    local _, r = reaper.GetSetMediaTrackInfo_String(reaper.GetTrack(0, i), "P_RAZOREDITS", "", false)
    if r ~= "" then return true end
  end
  return false
end

function L.timeSel()
  local s, e = reaper.GetSet_LoopTimeRange(false, false, 0, 0, false)
  if e > s then return s, e end
end

return L
