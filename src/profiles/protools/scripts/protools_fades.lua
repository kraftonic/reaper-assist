-- REAPER Assist, "Coming from Pro Tools": Fades (⌘F): fade in, fade out or crossfade, from where the selection meets the clips.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
local s, e = L.timeSel()
if not s then return end
-- Two touching clips on one track inside the selection: a crossfade.
for i = 0, reaper.CountTracks(0) - 1 do
  local tr, n = reaper.GetTrack(0, i), 0
  for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
    local it = reaper.GetTrackMediaItem(tr, j)
    local p = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
    if reaper.IsMediaItemSelected(it) and p < e and p + reaper.GetMediaItemInfo_Value(it, "D_LENGTH") > s then n = n + 1 end
  end
  if n >= 2 then reaper.Main_OnCommand(40916, 0) return end
end
reaper.Undo_BeginBlock()
for i = 0, reaper.CountSelectedMediaItems(0) - 1 do
  local it = reaper.GetSelectedMediaItem(0, i)
  local p = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
  local q = p + reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
  if s <= p + 1e-9 and e > p then reaper.SetMediaItemInfo_Value(it, "D_FADEINLEN", math.min(e, q) - p)
  elseif e >= q - 1e-9 and s < q then reaper.SetMediaItemInfo_Value(it, "D_FADEOUTLEN", q - math.max(s, p)) end
end
reaper.UpdateArrange()
reaper.Undo_EndBlock("Fades", 4)
