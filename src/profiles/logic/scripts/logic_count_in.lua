-- REAPER Assist, "Coming from Logic Pro": Count-in on/off (Shift-K, control-bar button).
-- REAPER has no count-in action: this flips "count-in before recording" in the project's
-- metronome settings (and makes the count-in one bar long if it was zero).
local _, _, sec, cmd = reaper.get_action_context()
local _, v = reaper.get_config_var_string("projmetroen")
local n = math.tointeger(tonumber(v) or 0) or 0
local on = (n & 16) == 0
n = on and (n | 16) or (n & ~16)
reaper.set_config_var_string("projmetroen", tostring(n), 0)
if on then
  local _, bars = reaper.get_config_var_string("projmetrocountin")
  if (tonumber(bars) or 0) <= 0 then reaper.set_config_var_string("projmetrocountin", "1", 0) end
end
reaper.SetToggleCommandState(sec, cmd, on and 1 or 0)
reaper.RefreshToolbar2(sec, cmd)
