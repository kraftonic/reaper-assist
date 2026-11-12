-- REAPER Assist, "Coming from Pro Tools": re-apply the edit mode, tool and the toolbar lights (run at REAPER start).
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
L.apply()
L.light("ifp", L.get("ifp", "0") == "1")
L.light("ttt", L.get("ttt", "0") == "1")
