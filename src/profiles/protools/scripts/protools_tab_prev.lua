-- REAPER Assist, "Coming from Pro Tools": ⌥Tab: back to the previous clip boundary or transient.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
reaper.Main_OnCommand(L.get("ttt", "0") == "1" and 40376 or 41167, 0)
