-- REAPER Assist, "Coming from Cubase": Mute tool click (tool 7). Mutes / unmutes the event under the mouse.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local x, y = reaper.GetMousePosition()
local item = reaper.GetItemFromPoint(x, y, false)
if not item then return reaper.defer(function() end) end
reaper.Undo_BeginBlock()
reaper.SetMediaItemInfo_Value(item, "B_MUTE", reaper.GetMediaItemInfo_Value(item, "B_MUTE") == 1 and 0 or 1)
reaper.UpdateArrange()
reaper.Undo_EndBlock("Mute event", -1)
