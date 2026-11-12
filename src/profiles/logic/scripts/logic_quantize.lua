-- REAPER Assist, "Coming from Logic Pro": Quantize (Q in the Tracks area).
-- MIDI regions: every note in the selected regions moves to the project grid, keeping its length
-- (Logic quantizes whole regions from the Tracks area; Q in the Piano Roll quantizes the selected
-- notes). Audio regions: REAPER's item quantize dialog.
local _, div = reaper.GetSetProjectGrid(0, false)
local g = (div and div > 0) and div * 4 or 1 -- grid in quarter notes
local audio = false
reaper.Undo_BeginBlock()
for i = 0, reaper.CountSelectedMediaItems(0) - 1 do
  local tk = reaper.GetActiveTake(reaper.GetSelectedMediaItem(0, i))
  if tk and reaper.TakeIsMIDI(tk) then
    local _, n = reaper.MIDI_CountEvts(tk)
    for j = 0, n - 1 do
      local _, _, _, s, e = reaper.MIDI_GetNote(tk, j)
      local qn = reaper.TimeMap2_timeToQN(0, reaper.MIDI_GetProjTimeFromPPQPos(tk, s))
      local ns = reaper.MIDI_GetPPQPosFromProjTime(tk, reaper.TimeMap2_QNToTime(0, math.floor(qn / g + 0.5) * g))
      ns = math.floor(ns + 0.5)
      reaper.MIDI_SetNote(tk, j, nil, nil, ns, e + (ns - s), nil, nil, nil, true)
    end
    reaper.MIDI_Sort(tk)
  elseif tk then
    audio = true
  end
end
reaper.Undo_EndBlock("Quantize", -1)
if audio then reaper.Main_OnCommand(40316, 0) end
