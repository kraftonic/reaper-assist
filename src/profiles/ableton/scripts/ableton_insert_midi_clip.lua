-- Assist "Coming from Ableton Live": double-click empty track space, or Cmd+Shift+M. A new empty MIDI
-- clip: the time selection if there is one (keyboard), else one bar where you double-clicked / at the
-- insert marker.
local x, y = reaper.GetMousePosition()
local fromMouse = reaper.GetThingFromPoint(x, y) == "arrange"
local tr
if fromMouse then tr = reaper.GetTrackFromPoint(x, y) end
tr = tr or reaper.GetSelectedTrack(0, 0) or reaper.GetLastTouchedTrack()
if not tr then return end
reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
local s, e = reaper.GetSet_LoopTimeRange(false, false, 0, 0, false)
if fromMouse or e <= s then
  if fromMouse then reaper.Main_OnCommand(40513, 0) end
  local _, bar = reaper.TimeMap2_timeToBeats(0, reaper.GetCursorPosition())
  s = reaper.TimeMap2_beatsToTime(0, 0, bar)
  e = reaper.TimeMap2_beatsToTime(0, 0, bar + 1)
end
local it = reaper.CreateNewMIDIItemInProj(tr, s, e, false)
if it then
  reaper.Main_OnCommand(40289, 0)
  reaper.SetMediaItemSelected(it, true)
  reaper.SetOnlyTrackSelected(tr)
end
reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
reaper.Undo_EndBlock("Insert MIDI clip", -1)
