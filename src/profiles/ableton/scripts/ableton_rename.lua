-- Assist "Coming from Ableton Live": Cmd+R. Rename the selected clips when clips have focus,
-- else the track.
local items = reaper.CountSelectedMediaItems(0)
if reaper.GetCursorContext2(true) == 1 and items > 0 then
  local tk = reaper.GetActiveTake(reaper.GetSelectedMediaItem(0, 0))
  local name = tk and reaper.GetTakeName(tk) or ""
  local ok, new = reaper.GetUserInputs("Rename clip", 1, "Name:,extrawidth=160", name)
  if not ok then return end
  reaper.Undo_BeginBlock()
  for i = 0, items - 1 do
    local t = reaper.GetActiveTake(reaper.GetSelectedMediaItem(0, i))
    if t then reaper.GetSetMediaItemTakeInfo_String(t, "P_NAME", new, true) end
  end
  reaper.UpdateArrange()
  reaper.Undo_EndBlock("Rename clip", -1)
else
  reaper.Main_OnCommand(40696, 0)
end
