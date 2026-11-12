-- REAPER Assist, "Coming from Pro Tools": count-off before recording on / off (this project's metronome setting).
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
local _, v = reaper.get_config_var_string("projmetroen")
local n = math.floor(tonumber(v) or 0)
local on = n & 16 == 0
reaper.set_config_var_string("projmetroen", tostring(on and (n | 16) or (n & ~16)), 0)
L.light("countoff", on)
