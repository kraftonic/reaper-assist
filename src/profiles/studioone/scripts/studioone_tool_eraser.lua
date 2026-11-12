-- REAPER Assist: Coming from Studio One. The eraser tool (see studioone_tools.lua).
ASSIST_S1_TOOL = "eraser"
dofile((select(2, reaper.get_action_context())):match("^(.*[/\\])") .. "studioone_tools.lua")
