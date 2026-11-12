-- REAPER Assist, "Coming from Cubase": Alt+Space = Play Selection Range.
-- Selected events: plays from the first to the end of the last. Otherwise the range (time
-- selection or razor edit): plays it and stops at its end (watching only while it plays).
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local n = reaper.CountSelectedMediaItems(0)
if n > 0 then
  local s
  for i = 0, n - 1 do
    local p = reaper.GetMediaItemInfo_Value(reaper.GetSelectedMediaItem(0, i), "D_POSITION")
    s = math.min(s or p, p)
  end
  reaper.SetEditCurPos(s, true, false)
  reaper.Main_OnCommand(43355, 0)
  return reaper.defer(function() end)
end
local s, e = reaper.GetSet_LoopTimeRange2(0, false, false, 0, 0, false)
if e <= s then
  for i = 0, reaper.CountTracks(0) - 1 do
    local _, r = reaper.GetSetMediaTrackInfo_String(reaper.GetTrack(0, i), "P_RAZOREDITS", "", false)
    local a, b = (r or ""):match("^(%S+) (%S+)")
    if a then s, e = tonumber(a), tonumber(b) break end
  end
end
if not e or e <= s then return reaper.defer(function() end) end
reaper.SetEditCurPos(s, true, false)
reaper.Main_OnCommand(1007, 0)
local function watch()
  if reaper.GetPlayState() & 1 == 0 then return end
  if reaper.GetPlayPosition() >= e then reaper.Main_OnCommand(1016, 0) return end
  reaper.defer(watch)
end
reaper.defer(watch)
