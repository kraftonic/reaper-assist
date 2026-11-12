-- REAPER Assist, "Coming from Pro Tools": Repeat (⌥R): duplicate the selection a number of times.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
local ok, txt = reaper.GetUserInputs("Repeat", 1, "Number of repeats:", "1")
local n = ok and math.floor(tonumber(txt) or 0) or 0
if n < 1 then return end
local range = L.hasRazor() or (L.timeSel() and reaper.CountSelectedMediaItems(0) > 0)
reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
for _ = 1, math.min(n, 999) do reaper.Main_OnCommand(range and 41296 or 41295, 0) end
reaper.PreventUIRefresh(-1)
reaper.Undo_EndBlock("Repeat", -1)
