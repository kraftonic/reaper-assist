-- Assist "Coming from Ableton Live": 0. Deactivate the selection: the selected clips when the clips
-- have focus, else the selected tracks (Live's track activator = REAPER's mute).
local ctx = reaper.GetCursorContext2(true)
local items, tracks = reaper.CountSelectedMediaItems(0), reaper.CountSelectedTracks(0)
reaper.Undo_BeginBlock()
if (ctx == 1 and items > 0) or (tracks == 0 and items > 0) then
  reaper.Main_OnCommand(40175, 0)
elseif tracks > 0 then
  -- Like Live, a mixed selection follows the first track: all on, or all off.
  local on = reaper.GetMediaTrackInfo_Value(reaper.GetSelectedTrack(0, 0), "B_MUTE") == 0
  for i = 0, tracks - 1 do reaper.SetMediaTrackInfo_Value(reaper.GetSelectedTrack(0, i), "B_MUTE", on and 1 or 0) end
  reaper.TrackList_AdjustWindows(false)
end
reaper.Undo_EndBlock("Deactivate", -1)
