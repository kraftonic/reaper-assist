-- REAPER Assist, "Coming from Pro Tools": half-speed playback (Space stops and puts the rate back).
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
if reaper.GetPlayState() & 5 ~= 0 then reaper.Main_OnCommand(1016, 0) end
reaper.CSurf_OnPlayRateChange(0.5)
reaper.Main_OnCommand(1007, 0)
