-- REAPER Assist, "Coming from FL Studio": count-in before recording on / off (FL's
-- "Countdown before recording", Ctrl+P). REAPER has no action for it, so this flips the
-- project's count-in-before-record bit (projmetroen 16) and makes sure the count-in is at
-- least one bar long (projmetrocountin). Needs REAPER 7.74+ (set_config_var_string).

local _, _, sec, cmd = reaper.get_action_context()
if not reaper.set_config_var_string then
  reaper.Main_OnCommand(40363, 0) -- Options: Show metronome/pre-roll settings
  return
end
local ok, cur = reaper.get_config_var_string("projmetroen")
local v = ok and math.tointeger(tonumber(cur) or 0) or 0
local on = v & 16 == 0
v = on and (v | 16) or (v & ~16)
reaper.Undo_BeginBlock()
reaper.set_config_var_string("projmetroen", tostring(v), 0)
local okb, bars = reaper.get_config_var_string("projmetrocountin")
if on and okb and (tonumber(bars) or 0) < 1 then reaper.set_config_var_string("projmetrocountin", "1", 0) end
reaper.Undo_EndBlock("FL: Count-in " .. (on and "on" or "off"), -1)
reaper.SetToggleCommandState(sec, cmd, on and 1 or 0)
reaper.RefreshToolbar2(sec, cmd)
local x, y = reaper.GetMousePosition()
reaper.TrackCtl_SetToolTip("Count-in " .. (on and "on" or "off"), x + 16, y + 16, true)
