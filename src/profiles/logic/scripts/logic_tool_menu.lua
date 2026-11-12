-- REAPER Assist, "Coming from Logic Pro": T opens the Tool menu at the mouse.
local dir = debug.getinfo(1, "S").source:match("^@?(.*[/\\])") or ""
dofile(dir .. "logic_tools.lua").menu()
