-- REAPER Assist, "Coming from Cubase": Ctrl/Cmd+Shift+X = Cut Time. Copies the range and
-- removes it, closing the gap. The range is the time selection, or else the razor edit area.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local s, e = reaper.GetSet_LoopTimeRange2(0, false, false, 0, 0, false)
if e <= s then
  for i = 0, reaper.CountTracks(0) - 1 do
    local _, r = reaper.GetSetMediaTrackInfo_String(reaper.GetTrack(0, i), "P_RAZOREDITS", "", false)
    local a, b = (r or ""):match("^(%S+) (%S+)")
    if a then s, e = tonumber(a), tonumber(b) break end
  end
  if not e or e <= s then return reaper.defer(function() end) end
  reaper.GetSet_LoopTimeRange2(0, true, false, s, e, false)
end
reaper.Undo_BeginBlock()
reaper.Main_OnCommand(41383, 0) -- copy within the time selection
reaper.Main_OnCommand(40201, 0) -- remove it, moving later items
reaper.Undo_EndBlock("Cut time", -1)
