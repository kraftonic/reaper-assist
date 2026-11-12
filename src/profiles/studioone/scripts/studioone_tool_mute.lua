-- REAPER Assist: Coming from Studio One. The mute tool (see studioone_tools.lua).
ASSIST_S1_TOOL = "mute"
dofile((select(2, reaper.get_action_context())):match("^(.*[/\\])") .. "studioone_tools.lua")
