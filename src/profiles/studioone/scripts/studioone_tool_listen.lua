-- REAPER Assist: Coming from Studio One. The listen tool (see studioone_tools.lua).
ASSIST_S1_TOOL = "listen"
dofile((select(2, reaper.get_action_context())):match("^(.*[/\\])") .. "studioone_tools.lua")
