-- REAPER Assist: Coming from Studio One. Quantize (Q) the selected events to the project grid,
-- straight away (no dialog): notes inside instrument parts, and audio events by their start.
-- studioone_quantize50.lua sets ASSIST_S1_Q = 0.5 (Quantize 50%).
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local strength = ASSIST_S1_Q or 1
local n = reaper.CountSelectedMediaItems(0)
if n == 0 then return reaper.defer(function() end) end
local _, div = reaper.GetSetProjectGrid(0, false)
local grid = (div and div > 0 and div or 0.25) * 4 -- grid in quarter notes
local function snapQN(qn) return qn + (math.floor(qn / grid + 0.5) * grid - qn) * strength end

reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
for i = 0, n - 1 do
  local item = reaper.GetSelectedMediaItem(0, i)
  local take = reaper.GetActiveTake(item)
  if take and reaper.TakeIsMIDI(take) then
    local _, notes = reaper.MIDI_CountEvts(take)
    for j = 0, notes - 1 do
      local _, _, _, sp, ep = reaper.MIDI_GetNote(take, j)
      local qn = reaper.MIDI_GetProjQNFromPPQPos(take, sp)
      local ns = reaper.MIDI_GetPPQPosFromProjQN(take, snapQN(qn))
      reaper.MIDI_SetNote(take, j, nil, nil, ns, ns + (ep - sp), nil, nil, nil, true)
    end
    reaper.MIDI_Sort(take)
  else
    local pos = reaper.GetMediaItemInfo_Value(item, "D_POSITION")
    local qn = reaper.TimeMap2_timeToQN(0, pos)
    reaper.SetMediaItemInfo_Value(item, "D_POSITION", reaper.TimeMap2_QNToTime(0, snapQN(qn)))
  end
end
reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
reaper.Undo_EndBlock(strength < 1 and "Quantize 50%" or "Quantize", -1)
