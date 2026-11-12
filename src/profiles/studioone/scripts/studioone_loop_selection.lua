-- REAPER Assist: Coming from Studio One. Loop selection, snapped (P): the loop range takes the
-- range (razor area), else the time selection, else the selected events; both ends snap to the
-- grid and looping turns on.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local s, e = math.huge, -math.huge
for i = 0, reaper.CountTracks(0) - 1 do
  local _, areas = reaper.GetSetMediaTrackInfo_String(reaper.GetTrack(0, i), "P_RAZOREDITS", "", false)
  for a, b in areas:gmatch("([%d%.%-e]+) ([%d%.%-e]+) \"[^\"]*\"") do
    s, e = math.min(s, tonumber(a)), math.max(e, tonumber(b))
  end
end
if e <= s then
  local ts, te = reaper.GetSet_LoopTimeRange(false, false, 0, 0, false)
  if te > ts then s, e = ts, te end
end
if e <= s then
  for i = 0, reaper.CountSelectedMediaItems(0) - 1 do
    local it = reaper.GetSelectedMediaItem(0, i)
    local p = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
    s, e = math.min(s, p), math.max(e, p + reaper.GetMediaItemInfo_Value(it, "D_LENGTH"))
  end
end
if e <= s then return reaper.defer(function() end) end
reaper.Undo_BeginBlock()
local a, b = reaper.SnapToGrid(0, s), reaper.SnapToGrid(0, e)
if b <= a then a, b = s, e end
reaper.GetSet_LoopTimeRange(true, true, a, b, false)
if reaper.GetToggleCommandState(1068) ~= 1 then reaper.Main_OnCommand(1068, 0) end
reaper.Undo_EndBlock("Loop selection", -1)
