-- REAPER Assist, "Coming from Pro Tools": the grab tool (sets the mouse map).
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
L.tool("grab")
