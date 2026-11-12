-- REAPER Assist: Coming from Studio One. Autopunch on/off (I). REAPER punches in over the time
-- selection, so turning it on copies the loop range there when there's no time selection.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local _, _, section, cmd = reaper.get_action_context()
if reaper.GetToggleCommandState(40076) == 1 then
  reaper.Main_OnCommand(40252, 0) -- Record: normal
else
  local s, e = reaper.GetSet_LoopTimeRange(false, false, 0, 0, false)
  if e <= s then
    local ls, le = reaper.GetSet_LoopTimeRange(false, true, 0, 0, false)
    if le > ls then reaper.GetSet_LoopTimeRange(true, false, ls, le, false) end
  end
  reaper.Main_OnCommand(40076, 0) -- Record: time selection auto-punch
end
reaper.SetToggleCommandState(section, cmd, reaper.GetToggleCommandState(40076))
reaper.RefreshToolbar2(section, cmd)
reaper.defer(function() end)
