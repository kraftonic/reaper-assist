-- REAPER Assist, "Coming from Logic Pro": zoom tool (Tracks area or Piano Roll, by section).
local dir = debug.getinfo(1, "S").source:match("^@?(.*[/\\])") or ""
dofile(dir .. "logic_tools.lua").run("zoom")
