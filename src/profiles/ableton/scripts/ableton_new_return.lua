-- Assist "Coming from Ableton Live": Cmd+Opt+T. A return track ("A Return", "B Return"…) at the end,
-- with a send to it from every other track, starting at -inf like Live's send knobs.
local returns = 0
for i = 0, reaper.CountTracks(0) - 1 do
  local _, v = reaper.GetSetMediaTrackInfo_String(reaper.GetTrack(0, i), "P_EXT:assist_return", "", false)
  if v == "1" then returns = returns + 1 end
end
reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
local idx = reaper.CountTracks(0)
reaper.InsertTrackAtIndex(idx, true)
local ret = reaper.GetTrack(0, idx)
reaper.GetSetMediaTrackInfo_String(ret, "P_NAME", string.char(65 + returns % 26) .. " Return", true)
reaper.GetSetMediaTrackInfo_String(ret, "P_EXT:assist_return", "1", true)
reaper.SetTrackColor(ret, reaper.ColorToNative(181, 178, 177))
for i = 0, idx - 1 do
  local src = reaper.GetTrack(0, i)
  local _, v = reaper.GetSetMediaTrackInfo_String(src, "P_EXT:assist_return", "", false)
  if v ~= "1" then
    local s = reaper.CreateTrackSend(src, ret)
    if s >= 0 then
      reaper.SetTrackSendInfo_Value(src, 0, s, "D_VOL", 0)
      reaper.SetTrackSendInfo_Value(src, 0, s, "I_SENDMODE", 0)
    end
  end
end
reaper.SetOnlyTrackSelected(ret)
reaper.PreventUIRefresh(-1)
reaper.TrackList_AdjustWindows(false)
reaper.Undo_EndBlock("Insert return track", -1)
