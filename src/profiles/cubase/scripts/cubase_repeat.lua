-- REAPER Assist, "Coming from Cubase": Ctrl/Cmd+K = Repeat Events (asks how many copies).
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
if reaper.CountSelectedMediaItems(0) == 0 then return reaper.defer(function() end) end
local ok, v = reaper.GetUserInputs("Repeat Events", 1, "Count", "1")
local count = ok and tonumber(v) or nil
if not count or count < 1 then return reaper.defer(function() end) end
reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
for _ = 1, math.min(math.floor(count), 256) do reaper.Main_OnCommand(41295, 0) end
reaper.PreventUIRefresh(-1)
reaper.Undo_EndBlock("Repeat events", -1)
