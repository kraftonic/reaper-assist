-- REAPER Assist, "Coming from FL Studio": show the playlist (F5). The playlist is REAPER's
-- arrange view, which is always there; this brings it forward: closes a floating piano roll,
-- hides the mixer if it's showing and puts the keyboard focus on the arrange.

local editor = reaper.MIDIEditor_GetActive()
if editor and reaper.MIDIEditor_GetMode(editor) >= 0 then
  reaper.MIDIEditor_OnCommand(editor, 2) -- File: Close window
end
if reaper.GetToggleCommandState(40078) == 1 then reaper.Main_OnCommand(40078, 0) end -- View: toggle mixer visible
reaper.SetCursorContext(1, nil)
reaper.defer(function() end) -- no undo point
