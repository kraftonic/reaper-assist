-- Assist "Coming from Ableton Live": Cmd+D. With a time selection: duplicate that stretch of the
-- clips right after it and move the selection onto the copy. Otherwise duplicate the selected clips.
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
  if not area and reaper.CountSelectedTracks(0) > 0 then
    reaper.Main_OnCommand(40289, 0)
    for t = 0, reaper.CountSelectedTracks(0) - 1 do
      local tr = reaper.GetSelectedTrack(0, t)
      for i = 0, reaper.CountTrackMediaItems(tr) - 1 do
        local it = reaper.GetTrackMediaItem(tr, i)
        if overlaps(it) then reaper.SetMediaItemSelected(it, true) area = true end
      end
    end
  end
end
if area then
  reaper.Main_OnCommand(41296, 0)
  reaper.GetSet_LoopTimeRange(true, false, e, e + (e - s), false)
else
  reaper.Main_OnCommand(41295, 0)
end
reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
reaper.Undo_EndBlock("Duplicate", -1)
