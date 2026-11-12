-- REAPER Assist, "Coming from Pro Tools": Loop record: loop playback with each pass recorded as a new take.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
local on = L.flag("looprec", "looprec")
if (reaper.GetSetRepeat(-1) == 1) ~= on then reaper.GetSetRepeat(on and 1 or 0) end
if on and reaper.GetToggleCommandState(40114) ~= 1 then reaper.Main_OnCommand(40114, 0) end
if on and not L.timeSel() then
  local s, e = reaper.GetSet_LoopTimeRange(false, true, 0, 0, false)
  if e > s then reaper.GetSet_LoopTimeRange(true, false, s, e, false) end
end
