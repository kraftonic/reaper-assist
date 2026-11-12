-- Assist "Coming from Ableton Live": Cmd+L. The loop brace takes the selection and loop turns on;
-- again on the same selection turns loop off. From the clip editor: selected notes, else its time selection.
local _, _, sec = reaper.get_action_context()
reaper.Undo_BeginBlock()
if sec == 32060 then
  local ed = reaper.MIDIEditor_GetActive()
  local tk = ed and reaper.MIDIEditor_GetTake(ed)
  if tk and reaper.MIDI_EnumSelNotes(tk, -1) >= 0 then
    reaper.MIDIEditor_OnCommand(ed, 40753)
    reaper.GetSetRepeat(1)
  else
    local s, e = reaper.GetSet_LoopTimeRange(false, false, 0, 0, false)
    if e > s then reaper.GetSet_LoopTimeRange(true, true, s, e, false) reaper.GetSetRepeat(1) else reaper.GetSetRepeat(2) end
  end
else
  local s, e = reaper.GetSet_LoopTimeRange(false, false, 0, 0, false)
  local ls, le = reaper.GetSet_LoopTimeRange(false, true, 0, 0, false)
  if e > s then
    if math.abs(ls - s) < 1e-9 and math.abs(le - e) < 1e-9 and reaper.GetSetRepeat(-1) == 1 then
      reaper.GetSetRepeat(0)
    else
      reaper.GetSet_LoopTimeRange(true, true, s, e, false)
      reaper.GetSetRepeat(1)
    end
  elseif reaper.CountSelectedMediaItems(0) > 0 then
    reaper.Main_OnCommand(41039, 0)
    reaper.GetSetRepeat(1)
  else
    reaper.GetSetRepeat(2)
  end
end
reaper.Undo_EndBlock("Loop selection", -1)
