-- REAPER Assist, "Coming from Cubase": Zoom tool click (tool 6; Alt-click zooms out).
-- Zooms out around the time under the mouse without moving the cursor.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local FACTOR = 2
local cur = reaper.GetCursorPosition()
reaper.PreventUIRefresh(1)
reaper.Main_OnCommand(40514, 0) -- edit cursor to the mouse, to read the time there
local t = reaper.GetCursorPosition()
reaper.SetEditCurPos(cur, false, false)
local s, e = reaper.GetSet_ArrangeView2(0, false, 0, 0)
if e > s then
  local ns = math.max(0, t - (t - s) * FACTOR)
  reaper.GetSet_ArrangeView2(0, true, 0, 0, ns, ns + (e - s) * FACTOR)
end
reaper.PreventUIRefresh(-1)
reaper.defer(function() end)
