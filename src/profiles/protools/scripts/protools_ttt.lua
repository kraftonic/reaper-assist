-- REAPER Assist, "Coming from Pro Tools": Tab to Transients on / off.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
L.flag("ttt", "ttt")
