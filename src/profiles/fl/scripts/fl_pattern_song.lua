-- REAPER Assist, "Coming from FL Studio": Pattern / Song mode (FL's L key, the PAT / SONG switch).
-- Pattern: loop the selected pattern (MIDI item), or the bar under the edit cursor, with repeat on.
-- Song: loop the whole arrangement (rounded out to bars), repeat on.
-- The mode is kept per project; the button is lit in Pattern mode.

local NS = "assist_fl"
local proj = 0
local _, _, sec, cmd = reaper.get_action_context()
local _, cur = reaper.GetProjExtState(proj, NS, "mode")
local mode = cur == "pattern" and "song" or "pattern"

local function bars(a, b)
  local _, m1 = reaper.TimeMap2_timeToBeats(proj, a)
  local _, m2, _, full = reaper.TimeMap2_timeToBeats(proj, b)
  local s = reaper.TimeMap2_beatsToTime(proj, 0, m1)
  local e = reaper.TimeMap2_beatsToTime(proj, 0, m2)
  if e <= b - 1e-9 or e <= s then e = reaper.TimeMap2_beatsToTime(proj, 0, m2 + 1) end
  return s, e
end

local s, e
if mode == "pattern" then
  local item = reaper.GetSelectedMediaItem(proj, 0)
  if item then
    s = reaper.GetMediaItemInfo_Value(item, "D_POSITION")
    e = s + reaper.GetMediaItemInfo_Value(item, "D_LENGTH")
  else
    local p = reaper.GetCursorPosition()
    s, e = bars(p, p)
  end
else
  local last = 0
  for i = 0, reaper.CountMediaItems(proj) - 1 do
    local it = reaper.GetMediaItem(proj, i)
    last = math.max(last, reaper.GetMediaItemInfo_Value(it, "D_POSITION") + reaper.GetMediaItemInfo_Value(it, "D_LENGTH"))
  end
  if last > 0 then s, e = bars(0, last) end
end

reaper.Undo_BeginBlock()
if s and e and e > s then reaper.GetSet_LoopTimeRange2(proj, true, true, s, e, false) end
reaper.GetSetRepeatEx(proj, 1)
reaper.SetProjExtState(proj, NS, "mode", mode)
reaper.Undo_EndBlock(mode == "pattern" and "FL: Pattern mode" or "FL: Song mode", -1)

reaper.SetToggleCommandState(sec, cmd, mode == "pattern" and 1 or 0)
reaper.RefreshToolbar2(sec, cmd)
local x, y = reaper.GetMousePosition()
reaper.TrackCtl_SetToolTip(mode == "pattern" and "PAT: loop the pattern" or "SONG: loop the song", x + 16, y + 16, true)
