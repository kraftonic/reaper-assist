-- Assist "Coming from Ableton Live": Cmd+Opt+Shift+F. Freeze the selected tracks, or unfreeze them
-- if the first one is frozen.
local tr = reaper.GetSelectedTrack(0, 0)
if not tr then return end
local _, chunk = reaper.GetTrackStateChunk(tr, "", false)
reaper.Main_OnCommand(chunk:find("<FREEZE", 1, true) and 41644 or 41223, 0)
