-- REAPER Assist, "Coming from Pro Tools": shuffle edit mode.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
L.mode("shuffle")
