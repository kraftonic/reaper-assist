-- REAPER Assist, "Coming from Cubase": Glue tool click (tool 4). Joins the event under the
-- mouse with the next event on the same track.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local x, y = reaper.GetMousePosition()
local item = reaper.GetItemFromPoint(x, y, false)
if not item then return reaper.defer(function() end) end
local tr = reaper.GetMediaItem_Track(item)
local pos = reaper.GetMediaItemInfo_Value(item, "D_POSITION")
local nextItem, nextPos
for i = 0, reaper.CountTrackMediaItems(tr) - 1 do
  local it = reaper.GetTrackMediaItem(tr, i)
  local p = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
  if it ~= item and p > pos and (not nextPos or p < nextPos) then nextItem, nextPos = it, p end
end
if not nextItem then return reaper.defer(function() end) end
reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
reaper.Main_OnCommand(40289, 0) -- unselect all items
reaper.SetMediaItemSelected(item, true)
reaper.SetMediaItemSelected(nextItem, true)
reaper.Main_OnCommand(40362, 0) -- glue, ignoring the time selection
reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
reaper.Undo_EndBlock("Glue events", -1)
