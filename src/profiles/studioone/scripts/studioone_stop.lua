-- REAPER Assist: Coming from Studio One. Stop (numpad 0): stop where you are; when already
-- stopped, return to zero.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
if reaper.GetPlayState() ~= 0 then
  local pos = reaper.GetPlayPosition()
  reaper.OnStopButton()
  reaper.SetEditCurPos(pos, false, false)
else
  reaper.SetEditCurPos(0, true, false)
end
reaper.defer(function() end) -- no undo point
