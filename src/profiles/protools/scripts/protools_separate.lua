-- REAPER Assist, "Coming from Pro Tools": Separate clip (⌘E): at the selection edges, or at the insertion point.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
if L.hasRazor() or (L.timeSel() and reaper.CountSelectedMediaItems(0) > 0) then reaper.Main_OnCommand(40061, 0) else reaper.Main_OnCommand(40757, 0) end
