-- REAPER Assist, "Coming from Pro Tools": Space: play / stop. With Insertion Follows Playback on, the edit cursor stays where playback stopped.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
local st = reaper.GetPlayState()
if st & 5 ~= 0 then
  if L.get("ifp", "0") == "1" then reaper.Main_OnCommand(40328, 0) else reaper.Main_OnCommand(1016, 0) end
  if reaper.Master_GetPlayRate(0) ~= 1 then reaper.Main_OnCommand(40521, 0) end
else
  reaper.Main_OnCommand(1007, 0)
end
