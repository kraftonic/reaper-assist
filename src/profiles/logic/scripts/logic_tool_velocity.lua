-- REAPER Assist, "Coming from Logic Pro": velocity tool (Tracks area or Piano Roll, by section).
local dir = debug.getinfo(1, "S").source:match("^@?(.*[/\\])") or ""
dofile(dir .. "logic_tools.lua").run("velocity")
