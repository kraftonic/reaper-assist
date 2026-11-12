-- Assist "Coming from Ableton Live": Cmd+Shift+D. Duplicate time: everything in the time selection,
-- on all tracks, is copied right after it, and later material moves right to make room.
local s, e = reaper.GetSet_LoopTimeRange(false, false, 0, 0, false)
if e <= s then return end
local len = e - s
reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
local sel = {}
for t = 0, reaper.CountSelectedTracks(0) - 1 do sel[#sel + 1] = reaper.GetSelectedTrack(0, t) end
reaper.Main_OnCommand(40289, 0)
reaper.Main_OnCommand(40717, 0)
local top
for i = 0, reaper.CountSelectedMediaItems(0) - 1 do
  local tr = reaper.GetMediaItem_Track(reaper.GetSelectedMediaItem(0, i))
  local n = reaper.GetMediaTrackInfo_Value(tr, "IP_TRACKNUMBER")
  if not top or n < reaper.GetMediaTrackInfo_Value(top, "IP_TRACKNUMBER") then top = tr end
end
if top then reaper.Main_OnCommand(40060, 0) end
reaper.GetSet_LoopTimeRange(true, false, e, e + len, false)
reaper.Main_OnCommand(40200, 0)
if top then
  reaper.SetOnlyTrackSelected(top)
  reaper.Main_OnCommand(40914, 0)
  reaper.SetEditCurPos(e, false, false)
  reaper.Main_OnCommand(42398, 0)
  reaper.Main_OnCommand(40297, 0)
  for _, tr in ipairs(sel) do reaper.SetTrackSelected(tr, true) end
end
reaper.GetSet_LoopTimeRange(true, false, e, e + len, false)
reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
reaper.Undo_EndBlock("Duplicate time", -1)
