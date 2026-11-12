-- REAPER Assist, "Coming from Cubase": Space (Start/Stop) and Num 0 (Stop), Cubase style.
-- Stopping leaves the cursor where playback stopped; Stop while stopped goes back to where
-- playback started. Registered as RS_assist_cubase_start_stop and RS_assist_cubase_stop.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local NS = "assist_cubase"
local _, _, _, cmd = reaper.get_action_context()
local id = reaper.ReverseNamedCommandLookup(cmd) or ""
if reaper.GetPlayState() & 7 ~= 0 then
  local start = reaper.GetCursorPosition()
  local p = reaper.GetPlayPosition()
  reaper.SetExtState(NS, "playstart", tostring(start), false)
  reaper.Main_OnCommand(1016, 0)
  reaper.SetEditCurPos(p, false, false)
elseif id:match("start_stop$") then
  reaper.Main_OnCommand(1007, 0)
else
  local start = tonumber(reaper.GetExtState(NS, "playstart"))
  if start then reaper.SetEditCurPos(start, true, false) end
end
reaper.defer(function() end)
