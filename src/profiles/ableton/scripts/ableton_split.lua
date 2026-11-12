-- Assist "Coming from Ableton Live": Cmd+E. Split at the time selection's edges if it touches a clip,
-- otherwise at the insert marker (edit cursor).
local s, e = reaper.GetSet_LoopTimeRange(false, false, 0, 0, false)
local function overlaps(it)
  local p = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
  return p < e and p + reaper.GetMediaItemInfo_Value(it, "D_LENGTH") > s
end
reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
local area = false
if e > s then
  for i = 0, reaper.CountSelectedMediaItems(0) - 1 do
    if overlaps(reaper.GetSelectedMediaItem(0, i)) then area = true break end
  end
  if not area then
    -- Like Live: a time selection on a track splits the clips under it.
    for t = 0, reaper.CountSelectedTracks(0) - 1 do
      local tr = reaper.GetSelectedTrack(0, t)
      for i = 0, reaper.CountTrackMediaItems(tr) - 1 do
        local it = reaper.GetTrackMediaItem(tr, i)
        if overlaps(it) then reaper.SetMediaItemSelected(it, true) area = true end
      end
    end
  end
end
reaper.Main_OnCommand(area and 40061 or 40757, 0)
reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
reaper.Undo_EndBlock("Split clip", -1)
