-- REAPER Assist, "Coming from Cubase": Q = Quantize.
-- MIDI parts: note starts move to the grid (lengths kept); only the selected notes if any are
-- selected. Audio events: the event (its snap point) moves to the grid.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local function gridQN()
  local _, div = reaper.GetSetProjectGrid(0, false)
  return (div and div > 0) and div * 4 or 1
end
local G = gridQN()
local function snap(t)
  local _, meas = reaper.TimeMap2_timeToBeats(0, t)
  local _, qnStart = reaper.TimeMap_GetMeasureInfo(0, meas)
  local qn = reaper.TimeMap2_timeToQN(0, t)
  return reaper.TimeMap2_QNToTime(0, qnStart + math.floor((qn - qnStart) / G + 0.5) * G)
end

local n = reaper.CountSelectedMediaItems(0)
if n == 0 then return reaper.defer(function() end) end
reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
for i = 0, n - 1 do
  local item = reaper.GetSelectedMediaItem(0, i)
  local take = reaper.GetActiveTake(item)
  if take and reaper.TakeIsMIDI(take) then
    local _, notes = reaper.MIDI_CountEvts(take)
    local anySel = false
    for j = 0, notes - 1 do
      local _, sel = reaper.MIDI_GetNote(take, j)
      if sel then anySel = true break end
    end
    for j = 0, notes - 1 do
      local _, sel, _, sppq, eppq = reaper.MIDI_GetNote(take, j)
      if sel or not anySel then
        local ns = reaper.MIDI_GetPPQPosFromProjTime(take, snap(reaper.MIDI_GetProjTimeFromPPQPos(take, sppq)))
        reaper.MIDI_SetNote(take, j, nil, nil, ns, eppq + (ns - sppq), nil, nil, nil, true)
      end
    end
    reaper.MIDI_Sort(take)
  else
    local pos = reaper.GetMediaItemInfo_Value(item, "D_POSITION")
    local off = reaper.GetMediaItemInfo_Value(item, "D_SNAPOFFSET")
    reaper.SetMediaItemInfo_Value(item, "D_POSITION", snap(pos + off) - off)
  end
end
reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
reaper.Undo_EndBlock("Quantize", -1)
