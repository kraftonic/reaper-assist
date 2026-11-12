-- REAPER Assist, "Coming from Pro Tools": the trim tool (sets the mouse map).
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
L.tool("trim")
