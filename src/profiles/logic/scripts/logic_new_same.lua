-- REAPER Assist, "Coming from Logic Pro": New Track with Duplicate Settings (Cmd-D).
-- Duplicates the selected tracks (plug-ins, sends, colour, volume, pan) without their regions.
if reaper.CountSelectedTracks(0) == 0 then return end
reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
reaper.Main_OnCommand(40062, 0) -- Track: Duplicate tracks (the copies end up selected)
for i = 0, reaper.CountSelectedTracks(0) - 1 do
  local tr = reaper.GetSelectedTrack(0, i)
  for j = reaper.CountTrackMediaItems(tr) - 1, 0, -1 do reaper.DeleteTrackMediaItem(tr, reaper.GetTrackMediaItem(tr, j)) end
end
reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
reaper.Undo_EndBlock("New Track with Duplicate Settings", -1)
