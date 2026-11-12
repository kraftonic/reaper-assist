-- REAPER Assist, "Coming from Logic Pro": Input Monitoring on/off for the selected tracks (Ctrl-I).
local n = reaper.CountSelectedTracks(0)
if n == 0 then return end
local anyOff = false
for i = 0, n - 1 do
  if reaper.GetMediaTrackInfo_Value(reaper.GetSelectedTrack(0, i), "I_RECMON") == 0 then anyOff = true end
end
reaper.Undo_BeginBlock()
for i = 0, n - 1 do reaper.SetMediaTrackInfo_Value(reaper.GetSelectedTrack(0, i), "I_RECMON", anyOff and 1 or 0) end
reaper.Undo_EndBlock("Input Monitoring", -1)
