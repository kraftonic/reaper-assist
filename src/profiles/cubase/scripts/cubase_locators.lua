-- REAPER Assist, "Coming from Cubase": the locators (REAPER's loop points, kept apart from the
-- time selection). Registered as RS_assist_cubase_locators_to_selection (P: Locators to
-- Selection) and RS_assist_cubase_loop_selection (Alt+P: Loop Selection).
if reaper.set_action_options then reaper.set_action_options(1 | 2) end -- a quick repeat re-runs, never prompts
local function selection()
  local s, e
  for i = 0, reaper.CountTracks(0) - 1 do
    local _, r = reaper.GetSetMediaTrackInfo_String(reaper.GetTrack(0, i), "P_RAZOREDITS", "", false)
    local k = 0
    for tok in (r or ""):gmatch("%S+") do
      k = k + 1
      local v = tonumber(tok)
      if k % 3 == 1 and v then s = math.min(s or v, v) end
      if k % 3 == 2 and v then e = math.max(e or v, v) end
    end
  end
  if s and e and e > s then return s, e end
  local ts, te = reaper.GetSet_LoopTimeRange2(0, false, false, 0, 0, false)
  if te > ts then return ts, te end
  for i = 0, reaper.CountSelectedMediaItems(0) - 1 do
    local it = reaper.GetSelectedMediaItem(0, i)
    local p = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
    local l = reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
    s, e = math.min(s or p, p), math.max(e or p + l, p + l)
  end
  if s and e and e > s then return s, e end
end

local _, _, _, cmd = reaper.get_action_context()
local id = reaper.ReverseNamedCommandLookup(cmd) or ""
local s, e = selection()
if s then
  reaper.GetSet_LoopTimeRange2(0, true, true, s, e, false)
  if id:match("loop_selection$") then
    if reaper.GetToggleCommandState(1068) ~= 1 then reaper.Main_OnCommand(1068, 0) end
    reaper.SetEditCurPos(s, true, false)
    reaper.Main_OnCommand(1007, 0)
  end
end
reaper.defer(function() end)
