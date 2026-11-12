-- REAPER Assist: Coming from Studio One. Quantize 50% (Alt+Q): see studioone_quantize.lua.
ASSIST_S1_Q = 0.5
dofile((select(2, reaper.get_action_context())):match("^(.*[/\\])") .. "studioone_quantize.lua")
