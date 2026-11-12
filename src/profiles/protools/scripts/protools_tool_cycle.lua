-- REAPER Assist, "Coming from Pro Tools": cycle the tools (Esc).
local L = dofile(({ reaper.get_action_context() })[2]:match("^(.*[/\\])") .. "protools_lib.lua")
L.cycle(L.TOOL_ORDER, "tool", "smart", L.tool)
