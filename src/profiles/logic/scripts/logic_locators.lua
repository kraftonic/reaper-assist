-- REAPER Assist, "Coming from Logic Pro": Set Locators by Regions and enable Cycle (Cmd-U).
-- A marquee (razor) area wins; otherwise the selected regions. The time selection is left alone.
local function hasRazor()
  for i = 0, reaper.CountTracks(0) - 1 do
    local _, s = reaper.GetSetMediaTrackInfo_String(reaper.GetTrack(0, i), "P_RAZOREDITS", "", false)
    if s ~= "" then return true end
  end
  return false
end
if hasRazor() then
  reaper.Main_OnCommand(42474, 0)
else
  local n = reaper.CountSelectedMediaItems(0)
  if n == 0 then return end
  local a, b = math.huge, -math.huge
  for i = 0, n - 1 do
    local it = reaper.GetSelectedMediaItem(0, i)
    local p = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
    a = math.min(a, p)
    b = math.max(b, p + reaper.GetMediaItemInfo_Value(it, "D_LENGTH"))
  end
  reaper.GetSet_LoopTimeRange(true, true, a, b, false)
end
reaper.GetSetRepeat(1)
reaper.UpdateTimeline()
