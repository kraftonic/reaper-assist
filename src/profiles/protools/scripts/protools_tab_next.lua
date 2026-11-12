-- REAPER Assist, "Coming from Pro Tools": Tab: to the next clip boundary, or the next transient with Tab to Transients on.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
reaper.Main_OnCommand(L.get("ttt", "0") == "1" and 40375 or 41168, 0)
