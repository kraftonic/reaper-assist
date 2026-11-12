-- REAPER Assist, "Coming from Pro Tools": Auto Input / Input Only monitoring (⌥K) for every track.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
local only = L.flag("inputonly", "inputmon", nil)
reaper.Undo_BeginBlock()
for i = 0, reaper.CountTracks(0) - 1 do reaper.SetMediaTrackInfo_Value(reaper.GetTrack(0, i), "I_RECMON", only and 1 or 2) end
reaper.Undo_EndBlock(only and "Input Only monitoring" or "Auto Input monitoring", 1)
