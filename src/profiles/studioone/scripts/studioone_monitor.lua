-- REAPER Assist: Coming from Studio One. Monitor on/off (U) for the selected tracks.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local n = reaper.CountSelectedTracks(0)
if n == 0 then return reaper.defer(function() end) end
local on = false
for i = 0, n - 1 do
  if reaper.GetMediaTrackInfo_Value(reaper.GetSelectedTrack(0, i), "I_RECMON") == 0 then on = true end
end
reaper.Undo_BeginBlock()
for i = 0, n - 1 do reaper.SetMediaTrackInfo_Value(reaper.GetSelectedTrack(0, i), "I_RECMON", on and 1 or 0) end
reaper.Undo_EndBlock(on and "Monitor on" or "Monitor off", 1)
