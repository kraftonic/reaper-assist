-- REAPER Assist, "Coming from Pro Tools": pre-roll on / off (on play and on record together; REAPER has no post-roll).
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
local on = not (reaper.GetToggleCommandState(41818) == 1 and reaper.GetToggleCommandState(41819) == 1)
for _, a in ipairs({ 41818, 41819 }) do
  if (reaper.GetToggleCommandState(a) == 1) ~= on then reaper.Main_OnCommand(a, 0) end
end
L.light("preroll", on)
