-- REAPER Assist, "Coming from Pro Tools": Duplicate (⌘D): the selected range, or the selected clips.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
if L.hasRazor() or (L.timeSel() and reaper.CountSelectedMediaItems(0) > 0) then reaper.Main_OnCommand(41296, 0) else reaper.Main_OnCommand(41295, 0) end
