-- REAPER Assist, "Coming from Pro Tools": MIDI Merge on / off: armed MIDI tracks overdub (merge) or replace.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
local on = L.flag("midimerge", "midimerge", nil)
reaper.Undo_BeginBlock()
for i = 0, reaper.CountTracks(0) - 1 do
  local tr = reaper.GetTrack(0, i)
  local m = reaper.GetMediaTrackInfo_Value(tr, "I_RECMODE")
  if reaper.GetMediaTrackInfo_Value(tr, "I_RECARM") == 1 and (m == 0 or m == 7 or m == 8) then
    reaper.SetMediaTrackInfo_Value(tr, "I_RECMODE", on and 7 or 8)
  end
end
reaper.Undo_EndBlock("MIDI Merge", 1)
