-- REAPER Assist, "Coming from Pro Tools": Clear (⌘B): remove the selection without copying it (Shuffle mode closes the gap).
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
if L.hasRazor() then reaper.Main_OnCommand(40697, 0)
elseif L.timeSel() and reaper.CountSelectedMediaItems(0) > 0 then reaper.Main_OnCommand(40312, 0)
else reaper.Main_OnCommand(40697, 0) end
