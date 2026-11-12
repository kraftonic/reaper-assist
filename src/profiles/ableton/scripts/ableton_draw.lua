-- Assist "Coming from Ableton Live": B. Draw mode: drag paints notes, a click adds a note and a click
-- on a note deletes it; in the arrangement a drag draws a MIDI clip or automation. B again goes back.
-- The values are absolute: the profile's own map when off (-1 = REAPER's default for that slot).
local ON = {
  { "MM_CTX_TRACK", 0, "5 m" }, { "MM_CTX_ENVLANE", 0, "4 m" }, { "MM_CTX_ENVSEG", 0, "10 m" },
  { "MM_CTX_MIDI_PIANOROLL", 0, "22 m" }, { "MM_CTX_MIDI_PIANOROLL_CLK", 0, "4 m" }, { "MM_CTX_MIDI_NOTE_CLK", 0, "6 m" },
}
local OFF = {
  { "MM_CTX_TRACK", 0, "7 m" }, { "MM_CTX_ENVLANE", 0, -1 }, { "MM_CTX_ENVSEG", 0, -1 },
  { "MM_CTX_MIDI_PIANOROLL", 0, "10 m" }, { "MM_CTX_MIDI_PIANOROLL_CLK", 0, "1 m" }, { "MM_CTX_MIDI_NOTE_CLK", 0, "1 m" },
}
-- The current state is read from the mouse map itself, so it is right after a restart too.
local on = reaper.GetMouseModifier("MM_CTX_MIDI_PIANOROLL", 0) ~= "22 m"
for _, m in ipairs(on and ON or OFF) do reaper.SetMouseModifier(m[1], m[2], m[3]) end
for _, s in ipairs({ { 0, "_RS_assist_ableton_draw" }, { 32060, "_RS_assist_ableton_draw_midi" } }) do
  local id = reaper.NamedCommandLookup(s[2])
  if id ~= 0 then reaper.SetToggleCommandState(s[1], id, on and 1 or 0) reaper.RefreshToolbar2(s[1], id) end
end
local x, y = reaper.GetMousePosition()
reaper.TrackCtl_SetToolTip(on and "Draw mode on" or "Draw mode off", x + 12, y + 12, true)
