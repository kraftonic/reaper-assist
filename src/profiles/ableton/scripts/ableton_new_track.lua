-- Assist "Coming from Ableton Live": Cmd+T / Cmd+Shift+T. A new audio or MIDI track after the selected
-- one, named and coloured like Live does (our own pastel set). MIDI tracks take all MIDI inputs and arm
-- themselves while selected.
local _, _, _, cmd = reaper.get_action_context()
local midi = (reaper.ReverseNamedCommandLookup(cmd) or ""):find("new_midi", 1, true) ~= nil
local PAL = { 0x8fd9ec, 0xffe08a, 0xb9ef6e, 0xc9b6f7, 0xff9fd2, 0xffb27a, 0x8ff0c4, 0xa9c4ff, 0xf2f27a, 0xffa3a3, 0x9fe6e6, 0xe0c39a }
local idx = reaper.CountTracks(0)
local last = reaper.GetSelectedTrack(0, reaper.CountSelectedTracks(0) - 1)
if last then idx = math.floor(reaper.GetMediaTrackInfo_Value(last, "IP_TRACKNUMBER")) end
reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
reaper.InsertTrackAtIndex(idx, true)
local tr = reaper.GetTrack(0, idx)
reaper.GetSetMediaTrackInfo_String(tr, "P_NAME", (idx + 1) .. (midi and " MIDI" or " Audio"), true)
local c = PAL[idx % #PAL + 1]
reaper.SetTrackColor(tr, reaper.ColorToNative((c >> 16) & 255, (c >> 8) & 255, c & 255))
if midi then
  reaper.SetMediaTrackInfo_Value(tr, "I_RECINPUT", 4096 + (63 << 5))
  reaper.SetMediaTrackInfo_Value(tr, "I_RECMON", 1)
  reaper.SetMediaTrackInfo_Value(tr, "B_AUTO_RECARM", 1)
end
reaper.SetOnlyTrackSelected(tr)
if midi then reaper.SetMediaTrackInfo_Value(tr, "I_RECARM", 1) end
reaper.Main_OnCommand(40914, 0)
reaper.PreventUIRefresh(-1)
reaper.TrackList_AdjustWindows(false)
reaper.Undo_EndBlock(midi and "Insert MIDI track" or "Insert audio track", -1)
