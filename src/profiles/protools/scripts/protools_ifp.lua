-- REAPER Assist, "Coming from Pro Tools": Insertion Follows Playback on / off.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
L.flag("ifp", "ifp")
