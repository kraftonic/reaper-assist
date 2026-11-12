-- Assist "Coming from Ableton Live": Shift+Tab. Switch the Detail View between Clip View (the MIDI
-- editor) and Device View (the selected track's FX chain).
local tr = reaper.GetSelectedTrack(0, 0) or reaper.GetLastTouchedTrack()
local ed = reaper.MIDIEditor_GetActive()
if ed then
  reaper.MIDIEditor_OnCommand(ed, 2)
  if tr then reaper.TrackFX_Show(tr, 0, 1) end
  return
end
if tr and reaper.TrackFX_GetChainVisible(tr) ~= -1 then reaper.TrackFX_Show(tr, 0, 0) end
if reaper.CountSelectedMediaItems(0) == 0 and tr then
  local c, pick = reaper.GetCursorPosition(), nil
  for i = 0, reaper.CountTrackMediaItems(tr) - 1 do
    local it = reaper.GetTrackMediaItem(tr, i)
    local p = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
    if not pick or (p <= c and p + reaper.GetMediaItemInfo_Value(it, "D_LENGTH") > c) then pick = it end
  end
  if pick then reaper.SetMediaItemSelected(pick, true) end
end
if reaper.CountSelectedMediaItems(0) > 0 then reaper.Main_OnCommand(40153, 0) end
