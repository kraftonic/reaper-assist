-- REAPER Assist, "Coming from Pro Tools": cycle the edit modes (Shuffle, Slip, Spot, Grid).
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
L.cycle(L.MODE_ORDER, "mode", "slip", L.mode)
