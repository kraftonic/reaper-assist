-- REAPER Assist, "Coming from FL Studio": next / previous pattern (FL's + and - keys on the
-- number pad). A pattern is a MIDI item name (copies of a pattern share it), patterns in name
-- order; the step selects the next / previous pattern's first placement, moves the edit cursor
-- to it and, in Pattern mode, loops it.
-- Registered twice: RS_assist_fl_next_pattern and RS_assist_fl_prev_pattern.

local proj = 0
local _, _, _, cmd = reaper.get_action_context()
local id = reaper.ReverseNamedCommandLookup(cmd) or ""
local dir = id:match("prev_pattern") and -1 or 1

-- One entry per pattern name, its first placement.
local list, seen = {}, {}
for i = 0, reaper.CountMediaItems(proj) - 1 do
  local it = reaper.GetMediaItem(proj, i)
  local take = reaper.GetActiveTake(it)
  if take and reaper.TakeIsMIDI(take) then
    local _, name = reaper.GetSetMediaItemTakeInfo_String(take, "P_NAME", "", false)
    local key = name ~= "" and name or ("#" .. i)
    local pos = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
    if not seen[key] or pos < reaper.GetMediaItemInfo_Value(seen[key].item, "D_POSITION") then
      if not seen[key] then list[#list + 1] = key end
      seen[key] = { item = it, name = name, pos = pos }
    end
  end
end
if #list == 0 then return reaper.defer(function() end) end
table.sort(list, function(a, b)
  local A, B = seen[a], seen[b]
  if A.name ~= B.name then return A.name < B.name end
  return A.pos < B.pos
end)

local cur = reaper.GetSelectedMediaItem(proj, 0)
local at = 0
for i, key in ipairs(list) do
  local e = seen[key]
  if cur and (e.item == cur) then at = i end
end
if at == 0 and cur then
  local take = reaper.GetActiveTake(cur)
  local name = take and select(2, reaper.GetSetMediaItemTakeInfo_String(take, "P_NAME", "", false)) or ""
  for i, key in ipairs(list) do if seen[key].name == name then at = i end end
end
local nxt = at == 0 and (dir > 0 and 1 or #list) or ((at - 1 + dir) % #list) + 1
local e = seen[list[nxt]]

reaper.Undo_BeginBlock()
reaper.SelectAllMediaItems(proj, false)
reaper.SetMediaItemSelected(e.item, true)
reaper.SetEditCurPos(e.pos, true, false)
local _, mode = reaper.GetProjExtState(proj, "assist_fl", "mode")
if mode == "pattern" then
  reaper.GetSet_LoopTimeRange2(proj, true, true, e.pos, e.pos + reaper.GetMediaItemInfo_Value(e.item, "D_LENGTH"), false)
end
reaper.Undo_EndBlock("FL: Select pattern " .. e.name, -1)
reaper.UpdateArrange()
local x, y = reaper.GetMousePosition()
reaper.TrackCtl_SetToolTip(e.name ~= "" and e.name or ("Pattern " .. nxt), x + 16, y + 16, true)
