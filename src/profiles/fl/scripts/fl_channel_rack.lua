-- REAPER Assist, "Coming from FL Studio": the channel rack (F6), a small step sequencer.
-- One row per track: a mute LED, the name (click to select, double-click for the piano roll,
-- wheel to change the row's note) and one pad per 16th of the current pattern's first bar.
-- The current pattern is the selected MIDI item's time, else the bar under the edit cursor.
-- Left-click a pad to set / clear a step, right-click to clear it. A row with no pattern there
-- gets a new one-bar MIDI item when you set its first step. Run again (F6) or Esc to close.
-- Native REAPER API only; the window lives while it is open (a defer loop is essential here).

local NS = "assist_fl"
local proj = 0
if reaper.set_action_options then reaper.set_action_options(1 | 4) end -- re-run closes it; button lit

local C = {
  bg = 0x3f4b55, row = 0x4b555b, name = 0x5f6a70, nameSel = 0x6b757b, text = 0xe7eef2, dim = 0xaab3b8,
  led = 0x8def11, ledOff = 0x2b3338, lime = 0xc3ff5a,
  off = { 0x696f74, 0x7c696a }, on = { 0xaabcc7, 0xd8a6a8 },
}
local NOTE = { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" }
local ROW_H, PAD_W, PAD_H, NAME_W, X0, Y0 = 26, 18, 22, 120, 30, 30

local function col(c, a)
  gfx.set(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, a or 1)
end

local function pitchOf(tr)
  local ok, v = reaper.GetSetMediaTrackInfo_String(tr, "P_EXT:" .. NS .. "_pitch", "", false)
  return ok and tonumber(v) or 60
end

-- The pattern: start and length of its first bar, and how many 16ths fit.
local function pattern()
  local item = reaper.GetSelectedMediaItem(proj, 0)
  local pos = item and reaper.GetMediaItemInfo_Value(item, "D_POSITION") or reaper.GetCursorPosition()
  local _, m = reaper.TimeMap2_timeToBeats(proj, pos)
  local bar = reaper.TimeMap2_beatsToTime(proj, 0, m)
  local start = item and pos or bar
  local len = reaper.TimeMap2_beatsToTime(proj, 0, m + 1) - bar
  local num, den = reaper.TimeMap_GetTimeSigAtTime(proj, start)
  local steps = math.max(1, math.min(32, math.floor(num * 16 / den + 0.5)))
  return start, len, steps
end

-- The MIDI item on a track that covers a time (its active take).
local function takeAt(tr, t)
  for i = 0, reaper.CountTrackMediaItems(tr) - 1 do
    local it = reaper.GetTrackMediaItem(tr, i)
    local p = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
    if t >= p - 1e-6 and t < p + reaper.GetMediaItemInfo_Value(it, "D_LENGTH") - 1e-6 then
      local tk = reaper.GetActiveTake(it)
      if tk and reaper.TakeIsMIDI(tk) then return tk, it end
    end
  end
end

-- The note (index) at a pitch starting inside a step, if any.
local function noteIn(tk, pitch, a, b)
  local p0, p1 = reaper.MIDI_GetPPQPosFromProjTime(tk, a), reaper.MIDI_GetPPQPosFromProjTime(tk, b)
  local _, n = reaper.MIDI_CountEvts(tk)
  for i = 0, n - 1 do
    local _, _, _, s, _, _, p = reaper.MIDI_GetNote(tk, i)
    if p == pitch and s >= p0 - 0.5 and s < p1 - 0.5 then return i end
  end
end

local function toggle(tr, step, clearOnly)
  local start, len, steps = pattern()
  local a = start + len * (step - 1) / steps
  local b = start + len * step / steps
  local pitch = pitchOf(tr)
  local tk, it = takeAt(tr, a)
  local i = tk and noteIn(tk, pitch, a, b)
  if clearOnly and not i then return end
  reaper.Undo_BeginBlock()
  if not tk then
    it = reaper.CreateNewMIDIItemInProj(tr, start, start + len, false)
    tk = it and reaper.GetActiveTake(it)
    if tk then reaper.GetSetMediaItemTakeInfo_String(tk, "P_NAME", "Pattern", true) end
  end
  if tk then
    if i then reaper.MIDI_DeleteNote(tk, i)
    else
      reaper.MIDI_InsertNote(tk, false, false, reaper.MIDI_GetPPQPosFromProjTime(tk, a), reaper.MIDI_GetPPQPosFromProjTime(tk, b), 0, pitch, 100, false)
    end
    reaper.MIDI_Sort(tk)
    reaper.UpdateItemInProject(it)
  end
  reaper.Undo_EndBlock(i and "FL: Clear step" or "FL: Set step", -1)
end

-- Window.
local dock = tonumber(reaper.GetExtState(NS, "rack_dock")) or 0
gfx.init("Channel rack", 620, 300, dock)
gfx.setfont(1, "Arial", 13)
gfx.clear = C.bg
local last, prev, scroll, lastClick = "", 0, 0, { t = 0 }

local function draw()
  local start, len, steps = pattern()
  col(C.bg); gfx.rect(0, 0, gfx.w, gfx.h, 1)
  col(C.dim); gfx.x, gfx.y = X0, 8
  gfx.drawstr(string.format("Pattern at bar %d  -  %d steps", select(2, reaper.TimeMap2_timeToBeats(proj, start)) + 1, steps))
  local rows = {}
  for r = 0, reaper.CountTracks(proj) - 1 do
    local tr = reaper.GetTrack(proj, r)
    local y = Y0 + (r - scroll) * (ROW_H + 2)
    if y > -ROW_H and y < gfx.h then
      rows[#rows + 1] = { tr = tr, y = y }
      col(C.row); gfx.rect(4, y, gfx.w - 8, ROW_H, 1)
      local muted = reaper.GetMediaTrackInfo_Value(tr, "B_MUTE") == 1
      col(muted and C.ledOff or C.led); gfx.circle(16, y + ROW_H / 2, 5, 1, 1)
      local sel = reaper.IsTrackSelected(tr)
      local tc = reaper.GetTrackColor(tr)
      if tc & 0x1000000 ~= 0 then
        local rr, gg, bb = reaper.ColorFromNative(tc & 0xffffff)
        col((rr << 16) | (gg << 8) | bb, 0.9)
      else col(sel and C.nameSel or C.name) end
      gfx.rect(X0, y + 2, NAME_W, ROW_H - 4, 1)
      if sel then col(C.lime); gfx.rect(X0 + NAME_W - 4, y + 2, 4, ROW_H - 4, 1) end
      local _, name = reaper.GetTrackName(tr)
      local p = pitchOf(tr)
      col(C.text); gfx.x, gfx.y = X0 + 6, y + 7
      gfx.drawstr(name:sub(1, 13))
      col(C.dim); gfx.x, gfx.y = X0 + NAME_W - 34, y + 7
      gfx.drawstr(NOTE[p % 12 + 1] .. (p // 12 - 1))
      local tk = takeAt(tr, start)
      for s = 1, steps do
        local g = ((s - 1) // 4) % 2 + 1
        local x = X0 + NAME_W + 10 + (s - 1) * (PAD_W + 2) + ((s - 1) // 4) * 4
        local a, b = start + len * (s - 1) / steps, start + len * s / steps
        local on = tk and noteIn(tk, p, a, b)
        col(on and C.on[g] or C.off[g]); gfx.rect(x, y + (ROW_H - PAD_H) / 2, PAD_W, PAD_H, 1)
        col(0x000000, 0.25); gfx.rect(x, y + (ROW_H - PAD_H) / 2, PAD_W, PAD_H, 0)
      end
    end
  end
  return rows, steps
end

local function hit(rows, steps, mx, my)
  for _, r in ipairs(rows) do
    if my >= r.y and my < r.y + ROW_H then
      if mx < X0 then return r.tr, "led" end
      if mx < X0 + NAME_W then return r.tr, "name" end
      for s = 1, steps do
        local x = X0 + NAME_W + 10 + (s - 1) * (PAD_W + 2) + ((s - 1) // 4) * 4
        if mx >= x and mx < x + PAD_W then return r.tr, "pad", s end
      end
      return r.tr, "row"
    end
  end
end

local rows, steps = {}, 16
local function loop()
  local ch = gfx.getchar()
  if ch < 0 or ch == 27 then return end
  local cap = gfx.mouse_cap
  local down = cap & 1 == 1 and prev & 1 == 0
  local rdown = cap & 2 == 2 and prev & 2 == 0
  prev = cap
  local function key() return table.concat({ reaper.GetProjectStateChangeCount(proj), reaper.GetCursorPosition(), gfx.w, gfx.h }, ",") end
  if down or rdown or gfx.mouse_wheel ~= 0 then
    local tr, what, s = hit(rows, steps, gfx.mouse_x, gfx.mouse_y)
    if tr and gfx.mouse_wheel ~= 0 and what == "name" then
      local p = math.max(0, math.min(127, pitchOf(tr) + (gfx.mouse_wheel > 0 and 1 or -1)))
      reaper.GetSetMediaTrackInfo_String(tr, "P_EXT:" .. NS .. "_pitch", tostring(p), true)
      last = ""
    elseif gfx.mouse_wheel ~= 0 then
      scroll = math.max(0, math.min(reaper.CountTracks(proj) - 1, scroll + (gfx.mouse_wheel > 0 and -1 or 1)))
      last = ""
    elseif tr and what == "pad" then toggle(tr, s, rdown)
    elseif tr and what == "led" and down then
      reaper.Undo_BeginBlock()
      reaper.SetMediaTrackInfo_Value(tr, "B_MUTE", 1 - reaper.GetMediaTrackInfo_Value(tr, "B_MUTE"))
      reaper.Undo_EndBlock("FL: Mute channel", -1)
    elseif tr and what == "name" and down then
      reaper.SetOnlyTrackSelected(tr)
      local now = reaper.time_precise()
      if now - lastClick.t < 0.35 and lastClick.tr == tr then
        local _, it = takeAt(tr, (pattern()))
        if it then
          reaper.SelectAllMediaItems(proj, false)
          reaper.SetMediaItemSelected(it, true)
          reaper.Main_OnCommand(40153, 0) -- Item: open in built-in MIDI editor
        end
      end
      lastClick = { t = now, tr = tr }
    end
    gfx.mouse_wheel = 0
  end
  if key() ~= last or down or rdown then
    rows, steps = draw()
    last = key()
    gfx.update()
  end
  reaper.defer(loop)
end

reaper.atexit(function()
  reaper.SetExtState(NS, "rack_dock", tostring(gfx.dock(-1)), true)
  gfx.quit()
  if reaper.set_action_options then reaper.set_action_options(8) end
end)
loop()
