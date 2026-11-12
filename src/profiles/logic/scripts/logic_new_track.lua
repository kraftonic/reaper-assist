-- REAPER Assist, "Coming from Logic Pro": New Audio Track (Opt-Cmd-A) / New Software
-- Instrument Track (Opt-Cmd-S), registered twice. Logic's default colours: audio blue,
-- instruments green. The instrument track gets MIDI input from all devices, input
-- monitoring on and REAPER's own synth so it plays at once.
local _, _, _, cmd = reaper.get_action_context()
local inst = (reaper.ReverseNamedCommandLookup(cmd) or ""):find("instrument") ~= nil
local base = inst and "Inst" or "Audio"
local num = 0
for i = 0, reaper.CountTracks(0) - 1 do
  local _, name = reaper.GetSetMediaTrackInfo_String(reaper.GetTrack(0, i), "P_NAME", "", false)
  local k = tonumber(name:match("^" .. base .. " (%d+)$"))
  if k and k > num then num = k end
end
reaper.Undo_BeginBlock()
local sel = reaper.GetSelectedTrack(0, 0)
local idx = sel and math.floor(reaper.GetMediaTrackInfo_Value(sel, "IP_TRACKNUMBER")) or reaper.CountTracks(0)
reaper.InsertTrackAtIndex(idx, true)
local tr = reaper.GetTrack(0, idx)
reaper.GetSetMediaTrackInfo_String(tr, "P_NAME", base .. " " .. (num + 1), true)
if inst then
  reaper.SetMediaTrackInfo_Value(tr, "I_CUSTOMCOLOR", reaper.ColorToNative(0x1a, 0xa3, 0x31) | 0x1000000)
  reaper.SetMediaTrackInfo_Value(tr, "I_RECINPUT", 4096 + (63 << 5))
  reaper.SetMediaTrackInfo_Value(tr, "I_RECMON", 1)
  reaper.TrackFX_AddByName(tr, "ReaSynth", false, -1)
else
  reaper.SetMediaTrackInfo_Value(tr, "I_CUSTOMCOLOR", reaper.ColorToNative(0x37, 0x6f, 0xab) | 0x1000000)
  reaper.SetMediaTrackInfo_Value(tr, "I_RECINPUT", 0)
  reaper.SetMediaTrackInfo_Value(tr, "I_RECMON", 2)
end
reaper.SetOnlyTrackSelected(tr)
reaper.TrackList_AdjustWindows(false)
reaper.Undo_EndBlock(inst and "New Software Instrument Track" or "New Audio Track", -1)
