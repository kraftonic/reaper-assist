-- Assist "Coming from Ableton Live": Cmd+3. Triplet grid on/off (arrangement, or the clip editor's grid).
local _, _, sec, cmd = reaper.get_action_context()
local function isTriplet(div)
  local l = math.log(div, 2)
  return math.abs(l - math.floor(l + 0.5)) > 1e-6
end
local on
reaper.Undo_BeginBlock()
if sec == 32060 then
  local ed = reaper.MIDIEditor_GetActive()
  if ed then
    on = reaper.GetToggleCommandStateEx(32060, 41004) ~= 1
    reaper.MIDIEditor_OnCommand(ed, on and 41004 or 41003)
  end
else
  local _, div, swing, amt = reaper.GetSetProjectGrid(0, false)
  if div and div > 0 then
    on = not isTriplet(div)
    reaper.GetSetProjectGrid(0, true, on and div * 2 / 3 or div * 1.5, swing, amt)
  end
end
if on ~= nil then
  for _, s in ipairs({ { 0, "_RS_assist_ableton_triplet" }, { 32060, "_RS_assist_ableton_triplet_midi" } }) do
    local id = reaper.NamedCommandLookup(s[2])
    if id ~= 0 then reaper.SetToggleCommandState(s[1], id, on and 1 or 0) reaper.RefreshToolbar2(s[1], id) end
  end
end
reaper.Undo_EndBlock("Triplet grid", -1)
