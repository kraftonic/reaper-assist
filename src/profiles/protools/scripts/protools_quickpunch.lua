-- REAPER Assist, "Coming from Pro Tools": QuickPunch: on = record punches in where you press it (normal record mode); off = punch on the selection.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
local on = L.flag("quickpunch", "quickpunch")
reaper.Main_OnCommand(on and 40252 or 40076, 0)
