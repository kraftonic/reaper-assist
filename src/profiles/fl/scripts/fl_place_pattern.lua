-- REAPER Assist, "Coming from FL Studio": click an empty playlist spot to place the current
-- pattern there (Draw tool). The current pattern is the selected MIDI item, else the last one
-- placed; it is copied as a linked (pooled) copy at the snapped mouse position. With no pattern
-- yet, a new empty one-bar pattern (the next free "Pattern N") is made.

local NS = "assist_fl"
local proj = 0
local x, y = reaper.GetMousePosition()
local track = reaper.GetTrackFromPoint(x, y)
if not track then return reaper.defer(function() end) end

reaper.PreventUIRefresh(1)
reaper.Main_OnCommand(40514, 0) -- View: move edit cursor to mouse cursor (no snapping)
local pos = reaper.SnapToGrid(proj, reaper.GetCursorPosition())

local function isMidi(item)
  local take = item and reaper.GetActiveTake(item)
  return take and reaper.TakeIsMIDI(take)
end

local src = reaper.GetSelectedMediaItem(proj, 0)
if not isMidi(src) then
  src = nil
  local _, guid = reaper.GetProjExtState(proj, NS, "pattern")
  if guid ~= "" then
    for i = 0, reaper.CountMediaItems(proj) - 1 do
      local it = reaper.GetMediaItem(proj, i)
      local _, g = reaper.GetSetMediaItemInfo_String(it, "GUID", "", false)
      if g == guid then src = it break end
    end
  end
end

reaper.Undo_BeginBlock()
local placed
if isMidi(src) then
  local cur = reaper.GetCursorPosition()
  reaper.SelectAllMediaItems(proj, false)
  reaper.SetMediaItemSelected(src, true)
  reaper.Main_OnCommand(40698, 0) -- Edit: copy items
  reaper.SetOnlyTrackSelected(track)
  reaper.Main_OnCommand(40914, 0) -- Track: set first selected track as last touched track
  reaper.SetEditCurPos(pos, false, false)
  reaper.Main_OnCommand(41072, 0) -- Item: paste items/tracks (pooled MIDI)
  for i = 0, reaper.CountSelectedMediaItems(proj) - 1 do
    local it = reaper.GetSelectedMediaItem(proj, i)
    if it ~= src then placed = it end
  end
  if placed then reaper.SetMediaItemSelected(src, false) end
  reaper.SetEditCurPos(cur, false, false)
else
  local _, m = reaper.TimeMap2_timeToBeats(proj, pos)
  local len = reaper.TimeMap2_beatsToTime(proj, 0, m + 1) - reaper.TimeMap2_beatsToTime(proj, 0, m)
  if len < 0.01 then len = 2 end
  placed = reaper.CreateNewMIDIItemInProj(track, pos, pos + len, false)
  if placed then
    local n = 0 -- the next free "Pattern N"
    for i = 0, reaper.CountMediaItems(proj) - 1 do
      local tk = reaper.GetActiveTake(reaper.GetMediaItem(proj, i))
      local name = tk and select(2, reaper.GetSetMediaItemTakeInfo_String(tk, "P_NAME", "", false)) or ""
      n = math.max(n, tonumber(name:match("^Pattern (%d+)$")) or 0)
    end
    n = n + 1
    local take = reaper.GetActiveTake(placed)
    if take then reaper.GetSetMediaItemTakeInfo_String(take, "P_NAME", "Pattern " .. n, true) end
    reaper.SelectAllMediaItems(proj, false)
    reaper.SetMediaItemSelected(placed, true)
  end
end
if placed then
  local _, g = reaper.GetSetMediaItemInfo_String(placed, "GUID", "", false)
  reaper.SetProjExtState(proj, NS, "pattern", g)
end
reaper.Undo_EndBlock("FL: Place pattern", -1)
reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
