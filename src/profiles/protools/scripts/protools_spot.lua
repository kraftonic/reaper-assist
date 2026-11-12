-- REAPER Assist, "Coming from Pro Tools": Spot mode: a clip click asks for its new start (in the ruler's units) and moves it there.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
reaper.Main_OnCommand(40528, 0) -- select the item under the mouse
local item = reaper.GetSelectedMediaItem(0, 0)
if not item then return end
local pos = reaper.GetMediaItemInfo_Value(item, "D_POSITION")
local ok, txt = reaper.GetUserInputs("Spot", 1, "Clip start:,extrawidth=80", reaper.format_timestr_pos(pos, "", -1))
if not ok then return end
local delta = reaper.parse_timestr_pos(txt, -1) - pos
if delta == 0 then return end
reaper.Undo_BeginBlock()
for i = 0, reaper.CountSelectedMediaItems(0) - 1 do
  local it = reaper.GetSelectedMediaItem(0, i)
  reaper.SetMediaItemInfo_Value(it, "D_POSITION", reaper.GetMediaItemInfo_Value(it, "D_POSITION") + delta)
end
reaper.UpdateArrange()
reaper.Undo_EndBlock("Spot clip", 4)
