-- REAPER Assist, "Coming from Logic Pro": Show/Hide Editor (E, Editors button).
-- Closes an open Piano Roll; otherwise opens the right editor for the selected region
-- (MIDI: Piano Roll, audio: region properties), or the Mixer when nothing is selected.
local ed = reaper.MIDIEditor_GetActive()
if ed then reaper.MIDIEditor_OnCommand(ed, 2) return end
local it = reaper.GetSelectedMediaItem(0, 0)
if not it then reaper.Main_OnCommand(40078, 0) return end
local tk = reaper.GetActiveTake(it)
reaper.Main_OnCommand(tk and reaper.TakeIsMIDI(tk) and 40153 or 40009, 0)
