-- REAPER Assist, "Coming from Cubase": Play tool click (tool 9). Plays from the click; a
-- click while playing stops.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
if reaper.GetPlayState() & 1 == 1 then
  reaper.Main_OnCommand(1016, 0)
else
  reaper.Main_OnCommand(40514, 0) -- edit cursor to the mouse (no snap)
  reaper.Main_OnCommand(1007, 0)
end
reaper.defer(function() end)
