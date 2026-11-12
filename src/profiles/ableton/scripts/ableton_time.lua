-- Assist "Coming from Ableton Live": Cmd+Shift+X / C / V. Cut, copy and paste time across all tracks.
-- One file, registered three times; the action's own id says which.
local _, _, _, cmd = reaper.get_action_context()
local id = reaper.ReverseNamedCommandLookup(cmd) or ""
local NS = "assist_ableton"
reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
local label
if id:find("time_paste", 1, true) then
  label = "Paste time"
  local len = tonumber(reaper.GetExtState(NS, "time_len"))
  if len and len > 0 then
    local c = reaper.GetCursorPosition()
    reaper.GetSet_LoopTimeRange(true, false, c, c + len, false)
    reaper.Main_OnCommand(40200, 0)
    local top = reaper.GetTrack(0, math.floor(tonumber(reaper.GetExtState(NS, "time_top")) or 0))
    if top then
      reaper.SetOnlyTrackSelected(top)
      reaper.Main_OnCommand(40914, 0)
      reaper.SetEditCurPos(c, false, false)
      reaper.Main_OnCommand(42398, 0)
    end
    reaper.GetSet_LoopTimeRange(true, false, c, c + len, false)
  end
else
  local cut = id:find("time_cut", 1, true) ~= nil
  label = cut and "Cut time" or "Copy time"
  local s, e = reaper.GetSet_LoopTimeRange(false, false, 0, 0, false)
  if e > s then
    reaper.Main_OnCommand(40289, 0)
    reaper.Main_OnCommand(40717, 0)
    local top
    for i = 0, reaper.CountSelectedMediaItems(0) - 1 do
      local n = reaper.GetMediaTrackInfo_Value(reaper.GetMediaItem_Track(reaper.GetSelectedMediaItem(0, i)), "IP_TRACKNUMBER") - 1
      if not top or n < top then top = n end
    end
    if top then reaper.Main_OnCommand(40060, 0) end
    reaper.SetExtState(NS, "time_len", tostring(e - s), false)
    reaper.SetExtState(NS, "time_top", tostring(top or 0), false)
    if cut then reaper.Main_OnCommand(40201, 0) end
  end
end
reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
reaper.Undo_EndBlock(label, -1)
