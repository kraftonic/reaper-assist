-- Assist "Coming from Ableton Live": Cmd+Shift+G. Ungroup: the selected group (folder) tracks go
-- away and their tracks move out, as when Live deletes the group track.
local folders = {}
for i = 0, reaper.CountSelectedTracks(0) - 1 do
  local tr = reaper.GetSelectedTrack(0, i)
  if reaper.GetMediaTrackInfo_Value(tr, "I_FOLDERDEPTH") == 1 then folders[#folders + 1] = tr end
end
if #folders == 0 then return end
reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
for f = #folders, 1, -1 do
  local folder = folders[f]
  local n = math.floor(reaper.GetMediaTrackInfo_Value(folder, "IP_TRACKNUMBER"))
  local depth, last = 1, nil
  for i = n, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    depth = depth + reaper.GetMediaTrackInfo_Value(tr, "I_FOLDERDEPTH")
    if depth <= 0 then last = tr break end
  end
  reaper.SetMediaTrackInfo_Value(folder, "I_FOLDERDEPTH", 0)
  if last then reaper.SetMediaTrackInfo_Value(last, "I_FOLDERDEPTH", reaper.GetMediaTrackInfo_Value(last, "I_FOLDERDEPTH") + 1) end
  reaper.DeleteTrack(folder)
end
reaper.PreventUIRefresh(-1)
reaper.TrackList_AdjustWindows(false)
reaper.Undo_EndBlock("Ungroup tracks", -1)
