-- Assist "Coming from Ableton Live": Cmd+Opt+I / S / M. Show or hide the In/Out, Sends or Mixer part
-- of the track headers (parameters of the Assist Ableton theme). One file, registered three times.
local _, _, sec, cmd = reaper.get_action_context()
local id = reaper.ReverseNamedCommandLookup(cmd) or ""
local want = id:find("show_io", 1, true) and "k_io" or id:find("show_sends", 1, true) and "k_sends" or "k_nomix"
local i = 0
while true do
  local name, _, value = reaper.ThemeLayout_GetParameter(i)
  if not name then break end
  if name == want then
    local v = (value or 0) ~= 0 and 0 or 1
    reaper.ThemeLayout_SetParameter(i, v, true)
    reaper.ThemeLayout_RefreshAll()
    -- The mixer part is shown while k_nomix is 0, so its toggle reads the other way round.
    reaper.SetToggleCommandState(sec, cmd, want == "k_nomix" and 1 - v or v)
    reaper.RefreshToolbar2(sec, cmd)
    break
  end
  i = i + 1
end
