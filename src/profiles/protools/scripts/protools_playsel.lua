-- REAPER Assist, "Coming from Pro Tools": play the edit selection once, from its start to its end.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
local s, e = L.timeSel()
if not s then reaper.Main_OnCommand(1007, 0) return end
if reaper.GetPlayState() & 5 ~= 0 then reaper.Main_OnCommand(1016, 0) end
reaper.SetEditCurPos(s, false, false)
reaper.Main_OnCommand(1007, 0)
if reaper.GetSetRepeat(-1) == 1 then return end -- loop playback repeats the selection anyway
local function watch()
  if reaper.GetPlayState() & 1 == 0 then return end
  if reaper.GetPlayPosition() >= e then reaper.Main_OnCommand(1016, 0) return end
  reaper.defer(watch)
end
reaper.defer(watch)
