-- REAPER Assist: Coming from Studio One. Listen tool click: solo the track under the mouse and
-- play from the click; click again (or stop) to stop and put the solos back. (Studio One plays
-- while the button is held; native REAPER scripts can't see the mouse button being released.)
-- A second click re-launches this script, which ends the running one (no "already running" prompt).
if reaper.set_action_options then reaper.set_action_options(1) end
local NS = "assist_studioone_listen"

local function restore()
  local saved = reaper.GetExtState(NS, "solo")
  if saved == "" then return end
  reaper.DeleteExtState(NS, "solo", false)
  local want = {}
  for guid, v in saved:gmatch("([^=;]+)=([^;]+)") do want[guid] = tonumber(v) end
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    reaper.SetMediaTrackInfo_Value(tr, "I_SOLO", want[reaper.GetTrackGUID(tr)] or 0)
  end
end

local x, y = reaper.GetMousePosition()
local track = reaper.GetTrackFromPoint(x, y)
if not track then return reaper.defer(function() end) end

local saved = {}
for i = 0, reaper.CountTracks(0) - 1 do
  local tr = reaper.GetTrack(0, i)
  saved[#saved + 1] = reaper.GetTrackGUID(tr) .. "=" .. math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_SOLO"))
end
reaper.SetExtState(NS, "solo", table.concat(saved, ";"), false)
reaper.PreventUIRefresh(1)
for i = 0, reaper.CountTracks(0) - 1 do
  local tr = reaper.GetTrack(0, i)
  reaper.SetMediaTrackInfo_Value(tr, "I_SOLO", tr == track and 2 or 0)
end
reaper.PreventUIRefresh(-1)
reaper.Main_OnCommand(40513, 0) -- View: Move edit cursor to mouse cursor
reaper.OnPlayButton()

-- Ends when playback stops (however it stops) or when the next click re-launches the script.
reaper.atexit(function()
  if reaper.GetPlayState() & 1 == 1 then reaper.OnStopButton() end
  restore()
end)
local function watch()
  if reaper.GetPlayState() & 1 == 0 then return end
  reaper.defer(watch)
end
reaper.defer(watch)
