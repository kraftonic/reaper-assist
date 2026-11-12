-- REAPER Assist, "Coming from Pro Tools": Zoom Toggle: zoom to the selection on the selected tracks, then back.
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
local on = L.get("zoomed", "0") ~= "1"
if on then
  local s, e = reaper.GetSet_ArrangeView2(0, false, 0, 0)
  local h = {}
  for i = 0, reaper.CountTracks(0) - 1 do h[#h + 1] = tostring(reaper.GetMediaTrackInfo_Value(reaper.GetTrack(0, i), "I_HEIGHTOVERRIDE")) end
  reaper.SetExtState("assist_protools", "zoomview", s .. " " .. e, false)
  reaper.SetExtState("assist_protools", "zoomheights", table.concat(h, " "), false)
  if L.timeSel() then reaper.Main_OnCommand(40031, 0) end
  if reaper.CountSelectedTracks(0) > 0 then reaper.Main_OnCommand(40723, 0) end
else
  local s, e = reaper.GetExtState("assist_protools", "zoomview"):match("(%S+) (%S+)")
  local i = 0
  for v in reaper.GetExtState("assist_protools", "zoomheights"):gmatch("%S+") do
    local tr = reaper.GetTrack(0, i)
    if tr then reaper.SetMediaTrackInfo_Value(tr, "I_HEIGHTOVERRIDE", tonumber(v) or 0) end
    i = i + 1
  end
  reaper.TrackList_AdjustWindows(false)
  if s then reaper.GetSet_ArrangeView2(0, true, 0, 0, tonumber(s), tonumber(e)) end
end
L.put("zoomed", on and "1" or "0")
L.light("zoomtoggle", on)
