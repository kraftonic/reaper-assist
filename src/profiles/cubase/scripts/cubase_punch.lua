-- REAPER Assist, "Coming from Cubase": I / O = Punch In / Out. REAPER has one punch range:
-- turning punch on uses the locators (loop points) as the punch range.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
if reaper.GetToggleCommandState(40076) == 1 then
  reaper.Main_OnCommand(40252, 0) -- normal recording
else
  local s, e = reaper.GetSet_LoopTimeRange2(0, false, true, 0, 0, false)
  if e > s then reaper.GetSet_LoopTimeRange2(0, true, false, s, e, false) end
  reaper.Main_OnCommand(40076, 0) -- auto-punch over the time selection
end
reaper.defer(function() end)
