-- REAPER Assist, "Coming from Cubase": Erase tool click (tool 5). Deletes the event under the mouse.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local x, y = reaper.GetMousePosition()
local item = reaper.GetItemFromPoint(x, y, false)
if not item then return reaper.defer(function() end) end
reaper.Undo_BeginBlock()
reaper.DeleteTrackMediaItem(reaper.GetMediaItem_Track(item), item)
reaper.UpdateArrange()
reaper.Undo_EndBlock("Erase event", -1)
