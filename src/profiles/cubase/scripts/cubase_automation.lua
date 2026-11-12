-- REAPER Assist, "Coming from Cubase": automation Read / Write.
-- RS_assist_cubase_write (W): Write on the selected tracks, or back to Read if all write.
-- RS_assist_cubase_read_all / _write_all (Alt+R / Alt+W): read / write for all tracks on or off.
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local _, _, sec, cmd = reaper.get_action_context()
local id = reaper.ReverseNamedCommandLookup(cmd) or ""
if id:match("_all$") then
  local mode = id:match("read_all$") and 1 or 3
  local on = reaper.GetGlobalAutomationOverride() ~= mode
  reaper.SetGlobalAutomationOverride(on and mode or -1)
  for _, other in ipairs({ "read_all", "write_all" }) do
    local c = reaper.NamedCommandLookup("_RS_assist_cubase_" .. other)
    if c ~= 0 then reaper.SetToggleCommandState(0, c, (on and id:match(other .. "$")) and 1 or 0); reaper.RefreshToolbar2(0, c) end
  end
  return reaper.defer(function() end)
end
local n = reaper.CountSelectedTracks(0)
if n == 0 then return reaper.defer(function() end) end
local allWrite = true
for i = 0, n - 1 do
  if reaper.GetMediaTrackInfo_Value(reaper.GetSelectedTrack(0, i), "I_AUTOMODE") ~= 3 then allWrite = false end
end
reaper.Undo_BeginBlock()
reaper.Main_OnCommand(allWrite and 40401 or 40403, 0)
reaper.Undo_EndBlock(allWrite and "Automation: read" or "Automation: write", -1)
