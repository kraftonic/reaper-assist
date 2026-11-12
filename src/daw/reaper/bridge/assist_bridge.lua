-- REAPER Assist — REAPER bridge
--
-- Runs inside REAPER as a deferred ReaScript (on REAPER's main/UI thread,
-- never on the audio thread) and executes Assist commands that arrive as
-- JSON files. There is deliberately no way to run code sent by the app: every
-- request names a command from the fixed handler table below, and arguments
-- are validated again here.
--
-- Transport (all inside the bridge directory):
--   tmp/        the app writes <id>.json here first, then renames it into inbox/
--   inbox/      complete requests waiting to be claimed
--   processing/ a request is renamed here (claimed) before it runs; leftovers
--               at startup were interrupted and are answered as INTERRUPTED,
--               never re-run
--   outbox/     responses, written to tmp/ and renamed in (atomic)
--   events/     push-to-talk events from assist_talk.lua
--   status.json heartbeat: session id, sequence number, project, play state
--   journal.log ids of answered requests, so a duplicate is never re-run,
--               even after REAPER restarts
--
-- Bridge directory: $REAPER_ASSIST_BRIDGE_DIR, otherwise
-- <REAPER resource path>/ReaperAssist/bridge

local BRIDGE_VERSION = "0.5.0"
local PROTOCOL = "1.0"

local K = { version = BRIDGE_VERSION, protocol = PROTOCOL }

------------------------------------------------------------------------------
-- JSON (small, strict, no code evaluation)
------------------------------------------------------------------------------
local json = {}
K.json = json
json.null = setmetatable({}, { __tostring = function() return "null" end })
local ARRAY_MT = { __jsonarray = true }
function json.array(t) return setmetatable(t or {}, ARRAY_MT) end
function json.is_array(t) return getmetatable(t) == ARRAY_MT end

local ESC = { ['"'] = '\\"', ['\\'] = '\\\\', ['\b'] = '\\b', ['\f'] = '\\f', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t' }

local function encode_string(s)
  local out = s:gsub('[%c"\\]', function(c) return ESC[c] or string.format("\\u%04x", c:byte()) end)
  return '"' .. out .. '"'
end

local function encode_number(n)
  if n ~= n or n == math.huge or n == -math.huge then return "null" end
  if math.type(n) == "integer" then return string.format("%d", n) end
  if n == math.floor(n) and math.abs(n) < 2 ^ 53 then return string.format("%d", math.floor(n)) end
  local s = string.format("%.15g", n):gsub(",", ".")
  return s
end

local function is_sequence(t)
  local n = 0
  for k in pairs(t) do
    if math.type(k) ~= "integer" or k < 1 then return false end
    n = n + 1
  end
  for i = 1, n do if t[i] == nil then return false end end
  return true, n
end

local function encode_value(v, depth)
  if depth > 64 then error("json: nesting too deep") end
  local tv = type(v)
  if v == nil or v == json.null then return "null"
  elseif tv == "boolean" then return v and "true" or "false"
  elseif tv == "number" then return encode_number(v)
  elseif tv == "string" then return encode_string(v)
  elseif tv == "table" then
    local seq, n = is_sequence(v)
    if json.is_array(v) or (seq and n > 0) then
      local parts = {}
      for i = 1, #v do parts[i] = encode_value(v[i], depth + 1) end
      return "[" .. table.concat(parts, ",") .. "]"
    end
    local keys = {}
    for k in pairs(v) do
      if type(k) ~= "string" then error("json: object keys must be strings") end
      keys[#keys + 1] = k
    end
    table.sort(keys)
    local parts = {}
    for i, k in ipairs(keys) do parts[i] = encode_string(k) .. ":" .. encode_value(v[k], depth + 1) end
    return "{" .. table.concat(parts, ",") .. "}"
  end
  error("json: cannot encode " .. tv)
end

function json.encode(v) return encode_value(v, 0) end

local MAX_JSON = 8 * 1024 * 1024

function json.decode(s)
  if type(s) ~= "string" then error("json: expected string") end
  if #s > MAX_JSON then error("json: document too large") end
  local pos = 1
  local function err(msg) error(string.format("json: %s at %d", msg, pos), 0) end
  local function ws()
    pos = s:find("[^ \t\r\n]", pos) or (#s + 1)
  end
  local parse_value
  local function utf8char(cp)
    if cp < 0 or cp > 0x10FFFF then err("bad code point") end
    return utf8.char(cp)
  end
  local function parse_string()
    pos = pos + 1 -- opening quote
    local buf = {}
    while true do
      local c = s:sub(pos, pos)
      if c == "" then err("unterminated string") end
      if c == '"' then pos = pos + 1; break end
      if c == "\\" then
        local e = s:sub(pos + 1, pos + 1)
        local map = { ['"'] = '"', ["\\"] = "\\", ["/"] = "/", b = "\b", f = "\f", n = "\n", r = "\r", t = "\t" }
        if map[e] then
          buf[#buf + 1] = map[e]; pos = pos + 2
        elseif e == "u" then
          local hex = s:sub(pos + 2, pos + 5)
          if not hex:match("^%x%x%x%x$") then err("bad \\u escape") end
          local cp = tonumber(hex, 16)
          pos = pos + 6
          if cp >= 0xD800 and cp <= 0xDBFF then
            local lo = s:match("^\\u(%x%x%x%x)", pos)
            if not lo then err("lone surrogate") end
            local lcp = tonumber(lo, 16)
            if lcp < 0xDC00 or lcp > 0xDFFF then err("bad surrogate pair") end
            cp = 0x10000 + (cp - 0xD800) * 0x400 + (lcp - 0xDC00)
            pos = pos + 6
          elseif cp >= 0xDC00 and cp <= 0xDFFF then
            err("lone surrogate")
          end
          buf[#buf + 1] = utf8char(cp)
        else
          err("bad escape")
        end
      else
        if c:byte() < 0x20 then err("control character in string") end
        local stop = s:find('[%c"\\]', pos) or (#s + 1)
        buf[#buf + 1] = s:sub(pos, stop - 1)
        pos = stop
      end
    end
    return table.concat(buf)
  end
  local function parse_number()
    local num = s:match("^-?%d+%.?%d*[eE]?[-+]?%d*", pos)
    if not num or num == "" or num == "-" then err("bad number") end
    if not num:match("^-?0[%.eE]") and num:match("^-?0%d") then err("leading zero") end
    if not num:match("^-?%d+$") and not num:match("^-?%d+%.%d+$") and not num:match("^-?%d+[eE][-+]?%d+$")
      and not num:match("^-?%d+%.%d+[eE][-+]?%d+$") then
      err("bad number")
    end
    local v = tonumber(num)
    if v == nil then err("bad number") end
    pos = pos + #num
    return v
  end
  local depth = 0
  function parse_value()
    ws()
    local c = s:sub(pos, pos)
    if c == "{" then
      depth = depth + 1
      if depth > 64 then err("nesting too deep") end
      pos = pos + 1
      local obj = {}
      ws()
      if s:sub(pos, pos) == "}" then pos = pos + 1; depth = depth - 1; return obj end
      while true do
        ws()
        if s:sub(pos, pos) ~= '"' then err("expected key") end
        local k = parse_string()
        ws()
        if s:sub(pos, pos) ~= ":" then err("expected ':'") end
        pos = pos + 1
        local v = parse_value()
        if v ~= json.null then obj[k] = v end
        ws()
        local d = s:sub(pos, pos)
        pos = pos + 1
        if d == "}" then break end
        if d ~= "," then err("expected ',' or '}'") end
      end
      depth = depth - 1
      return obj
    elseif c == "[" then
      depth = depth + 1
      if depth > 64 then err("nesting too deep") end
      pos = pos + 1
      local arr = json.array({})
      ws()
      if s:sub(pos, pos) == "]" then pos = pos + 1; depth = depth - 1; return arr end
      while true do
        arr[#arr + 1] = parse_value()
        ws()
        local d = s:sub(pos, pos)
        pos = pos + 1
        if d == "]" then break end
        if d ~= "," then err("expected ',' or ']'") end
      end
      depth = depth - 1
      return arr
    elseif c == '"' then
      return parse_string()
    elseif c == "-" or c:match("%d") then
      return parse_number()
    elseif s:sub(pos, pos + 3) == "true" then pos = pos + 4; return true
    elseif s:sub(pos, pos + 4) == "false" then pos = pos + 5; return false
    elseif s:sub(pos, pos + 3) == "null" then pos = pos + 4; return json.null
    end
    err("unexpected character")
  end
  local v = parse_value()
  ws()
  if pos <= #s then err("trailing characters") end
  return v
end

------------------------------------------------------------------------------
-- Errors and small helpers
------------------------------------------------------------------------------
local FAIL_MT = {}
local function fail(code, message, hint, details)
  error(setmetatable({ code = code, message = message, hint = hint, details = details }, FAIL_MT), 0)
end
K.fail = fail

local function is_fail(e) return getmetatable(e) == FAIL_MT end

local function round(x, digits)
  local m = 10 ^ (digits or 0)
  return math.floor(x * m + 0.5) / m
end

local function gain_to_db(g)
  if not g or g <= 0 then return nil end
  return round(20 * math.log(g, 10), 2)
end

local function db_to_gain(db)
  if db <= -150 then return 0 end
  return 10 ^ (db / 20)
end

local function trim(s) return (s:gsub("^%s+", ""):gsub("%s+$", "")) end

local function lower(s) return string.lower(s or "") end

------------------------------------------------------------------------------
-- Argument checks (defence in depth: the app validates with strict schemas)
------------------------------------------------------------------------------
local function arg_table(v, name)
  if type(v) ~= "table" then fail("INVALID_ARGS", name .. " must be an object") end
  return v
end
local function arg_string(v, name, max)
  if type(v) ~= "string" or #v == 0 or #v > (max or 256) then fail("INVALID_ARGS", name .. " must be a non-empty string") end
  return v
end
local function arg_number(v, name, lo, hi)
  if type(v) ~= "number" or v ~= v or v < lo or v > hi then
    fail("INVALID_ARGS", string.format("%s must be a number between %s and %s", name, tostring(lo), tostring(hi)))
  end
  return v
end
local function arg_int(v, name, lo, hi)
  arg_number(v, name, lo, hi)
  if math.floor(v) ~= v then fail("INVALID_ARGS", name .. " must be a whole number") end
  return math.floor(v)
end
local function arg_bool(v, name)
  if type(v) ~= "boolean" then fail("INVALID_ARGS", name .. " must be true or false") end
  return v
end
local function opt(v, f, ...) if v == nil then return nil end return f(v, ...) end

------------------------------------------------------------------------------
-- Clock: epoch milliseconds (os.time() has 1 s resolution; refine it with
-- time_precise once the second boundary has been observed)
------------------------------------------------------------------------------
local clock = { base_os = nil, base_tp = nil, last_os = nil }
function K.epoch_ms()
  local now_os = os.time()
  local tp = reaper.time_precise()
  if not clock.base_os then
    if clock.last_os and now_os ~= clock.last_os then
      clock.base_os, clock.base_tp = now_os, tp
    end
    clock.last_os = now_os
    if not clock.base_os then return now_os * 1000 end
  end
  return math.floor((clock.base_os + (tp - clock.base_tp)) * 1000)
end

------------------------------------------------------------------------------
-- File system
------------------------------------------------------------------------------
local SEP = package.config:sub(1, 1)
local function join(...) return table.concat({ ... }, SEP) end
local IS_WINDOWS = SEP == "\\"

local function read_file(path)
  local f = io.open(path, "rb")
  if not f then return nil end
  local data = f:read("a")
  f:close()
  return data
end

local function file_exists(path)
  if not path or path == "" then return false end
  local f = io.open(path, "rb")
  if f then f:close(); return true end
  return false
end

local tmp_counter = 0
local function write_atomic(dir_tmp, final_path, data)
  tmp_counter = tmp_counter + 1
  local tmp = join(dir_tmp, string.format("%s-%d-%d.tmp", K.session or "boot", tmp_counter, math.random(0, 1e9)))
  local f, e = io.open(tmp, "wb")
  if not f then return false, e end
  f:write(data)
  f:close()
  local ok, err = os.rename(tmp, final_path)
  if not ok and IS_WINDOWS then
    os.remove(final_path)
    ok, err = os.rename(tmp, final_path)
  end
  if not ok then os.remove(tmp) end
  return ok, err
end

local function list_files(dir)
  reaper.EnumerateFiles(dir, -1) -- force a re-read of the directory
  local out, i = {}, 0
  while true do
    local name = reaper.EnumerateFiles(dir, i)
    if not name then break end
    out[#out + 1] = name
    i = i + 1
  end
  table.sort(out)
  return out
end

------------------------------------------------------------------------------
-- REAPER helpers
------------------------------------------------------------------------------
local ACTIONS = {
  play = 1007, pause = 1008, record = 1013, stop = 1016, toggle_repeat = 1068,
  stop_save_recorded = 40667, save_project = 40026,
  metronome_toggle = 40364, metronome_on = 41745, metronome_off = 41746,
  recmode_normal = 40252, recmode_timesel_punch = 40076, recmode_item_punch = 40253,
  newrec_takes = 41330, newrec_tape = 41186, newrec_item_layers = 42677,
  newrec_lanes_layers = 43151, newrec_lanes_exclusive = 43152, newrec_no_lanes = 43153,
}
K.ACTIONS = ACTIONS

local function toggle(id) return reaper.GetToggleCommandState(id) end

local function cfg_int(name)
  local ok, v = reaper.get_config_var_string(name)
  if not ok then return nil end
  return math.tointeger(tonumber(v)) or math.floor(tonumber(v) or 0)
end
local function cfg_num(name)
  local ok, v = reaper.get_config_var_string(name)
  if not ok then return nil end
  return tonumber(v)
end
local function fmt_num(n)
  if n == math.floor(n) then return string.format("%d", math.floor(n)) end
  return (string.format("%.6f", n):gsub(",", "."))
end

local function track_guid(tr) return reaper.GetTrackGUID(tr) end
local function track_name(tr)
  local _, name = reaper.GetSetMediaTrackInfo_String(tr, "P_NAME", "", false)
  return name or ""
end
local function track_number(tr) return math.floor(reaper.GetMediaTrackInfo_Value(tr, "IP_TRACKNUMBER")) end
local function track_label(tr)
  local n = track_name(tr)
  if n == "" then return "Track " .. track_number(tr) end
  return n
end
local function item_guid(item)
  local _, g = reaper.GetSetMediaItemInfo_String(item, "GUID", "", false)
  return g
end

-- Per-request context: results of earlier commands in the same batch.
local batch_results = nil

local function find_track(ref, what)
  what = what or "track"
  arg_table(ref, what)
  if ref.by == "id" then
    local id = arg_string(ref.id, what .. ".id", 128)
    for i = 0, reaper.CountTracks(0) - 1 do
      local tr = reaper.GetTrack(0, i)
      if track_guid(tr) == id then return tr end
    end
    fail("TRACK_NOT_FOUND", "The track no longer exists (it may have been deleted, or the project changed).", "Refresh and choose the track again.")
  elseif ref.by == "index" then
    local idx = arg_int(ref.index, what .. ".index", 1, 10000)
    local tr = reaper.GetTrack(0, idx - 1)
    if not tr then fail("TRACK_NOT_FOUND", string.format("There is no track %d (the project has %d).", idx, reaper.CountTracks(0))) end
    return tr
  elseif ref.by == "batch" then
    local n = arg_int(ref.step, what .. ".step", 1, 500)
    local r = batch_results and batch_results[n]
    local id = r and r.data and r.data.trackId
    if not id then fail("TRACK_NOT_FOUND", string.format("Step %d of this batch did not produce a track.", n)) end
    return find_track({ by = "id", id = id }, what)
  end
  fail("INVALID_ARGS", what .. " reference must be resolved to an id before it reaches REAPER")
end

local function find_item(id)
  arg_string(id, "clip id", 128)
  for i = 0, reaper.CountMediaItems(0) - 1 do
    local it = reaper.GetMediaItem(0, i)
    if item_guid(it) == id then return it end
  end
  return nil
end

local function find_clip(ref)
  arg_table(ref, "clip")
  local id = ref.id
  if ref.by == "batch" then
    local r = batch_results and batch_results[arg_int(ref.step, "clip.step", 1, 500)]
    id = r and r.data and r.data.clipId
  elseif ref.by ~= "id" then
    fail("INVALID_ARGS", "clip reference must be resolved to an id")
  end
  local item = id and find_item(id)
  if not item then fail("CLIP_NOT_FOUND", "The MIDI clip no longer exists.") end
  local take = reaper.GetActiveTake(item)
  if not take or not reaper.TakeIsMIDI(take) then fail("CLIP_NOT_FOUND", "That item is not a MIDI clip.") end
  return item, take
end

local function bar_of(t)
  local s = reaper.format_timestr_pos(t, "", 2) -- "16.1.00" (measures.beats as the ruler shows them)
  local bar, beat, frac = s:match("^(%-?%d+)%.(%d+)%.(%d+)")
  if not bar then return json.null end
  return { bar = tonumber(bar), beat = tonumber(beat) + tonumber(frac) / 100 }
end

local function position_to_time(p, what)
  arg_table(p, what or "position")
  if p.seconds ~= nil then return arg_number(p.seconds, "seconds", 0, 7 * 24 * 3600) end
  if p.bar ~= nil then
    local bar = arg_int(p.bar, "bar", 1, 100000)
    local beat = opt(p.beat, arg_number, "beat", 1, 64) or 1
    local whole = math.floor(beat)
    local hundredths = math.floor((beat - whole) * 100 + 0.5)
    local t = reaper.parse_timestr_pos(string.format("%d.%d.%02d", bar, whole, hundredths), 2)
    -- Cross-check against the ruler so a misparse can never move the cursor somewhere unexpected.
    local back = bar_of(t)
    if back == json.null or back.bar ~= bar then
      fail("INVALID_ARGS", string.format("Could not place bar %d on this project's timeline.", bar))
    end
    return t
  end
  fail("INVALID_ARGS", "position must give bar/beat or seconds (markers are resolved by Assist)")
end

local function describe_input(v)
  v = math.floor(v)
  if v < 0 then return { type = "none", label = "No input" } end
  if v & 4096 ~= 0 then
    local chan = v & 31
    local dev = (v >> 5) & 63
    local label = (dev == 63 and "All MIDI inputs" or (dev == 62 and "Virtual MIDI keyboard" or ("MIDI device " .. dev)))
      .. (chan == 0 and ", all channels" or (", channel " .. chan))
    return { type = "midi", device = dev == 63 and "all" or dev, channel = chan, label = label }
  end
  local start = v & 1023
  if v & 2048 ~= 0 then return { type = "other", raw = v, label = "Multichannel input " .. (start + 1) } end
  local stereo = v & 1024 ~= 0
  local n1 = reaper.GetInputChannelName(start) or ("Input " .. (start + 1))
  if stereo then
    local n2 = reaper.GetInputChannelName(start + 1) or ("Input " .. (start + 2))
    return { type = "audio", channel = start + 1, stereo = true, label = string.format("In %d/%d (%s / %s)", start + 1, start + 2, n1, n2) }
  end
  return { type = "audio", channel = start + 1, stereo = false, label = string.format("In %d (%s)", start + 1, n1) }
end

-- I_RECMODE values, measured on REAPER 7.82 by running each "Track: Set track record mode" action.
local RECMODES = {
  [0] = "input", [1] = "output-stereo", [2] = "none", [3] = "output-stereo-latcomp", [4] = "midi-output",
  [5] = "output-mono", [6] = "output-mono-latcomp", [7] = "midi-overdub", [8] = "midi-replace",
  [9] = "midi-touch-replace", [10] = "output-multichannel", [11] = "output-multichannel-latcomp", [16] = "midi-latch-replace",
}
-- Record modes that replace existing MIDI when recording over it.
local DESTRUCTIVE_RECMODES = { [8] = true, [9] = true, [16] = true }
K.DESTRUCTIVE_RECMODES = DESTRUCTIVE_RECMODES

local MONITOR = { [0] = "off", [1] = "on", [2] = "auto" }

local function send_mode_name(m)
  m = math.floor(m)
  if m == 0 then return "post-fader" elseif m == 1 then return "pre-fx" elseif m == 3 or m == 2 then return "pre-fader" end
  return tostring(m)
end

local function track_sends(tr)
  local out = json.array({})
  for s = 0, reaper.GetTrackNumSends(tr, 0) - 1 do
    local dest = reaper.GetTrackSendInfo_Value(tr, 0, s, "P_DESTTRACK")
    local dest_id, dest_name = json.null, json.null
    if type(dest) == "userdata" then
      dest_id = track_guid(dest)
      dest_name = track_label(dest)
    end
    local src = math.floor(reaper.GetTrackSendInfo_Value(tr, 0, s, "I_SRCCHAN"))
    local dst = math.floor(reaper.GetTrackSendInfo_Value(tr, 0, s, "I_DSTCHAN"))
    out[#out + 1] = {
      index = s,
      destId = dest_id,
      destName = dest_name,
      volumeDb = gain_to_db(reaper.GetTrackSendInfo_Value(tr, 0, s, "D_VOL")) or json.null,
      sourceChannel = src >= 0 and ((src & 1023) + 1) or json.null,
      destChannel = (dst & 1023) + 1,
      mode = send_mode_name(reaper.GetTrackSendInfo_Value(tr, 0, s, "I_SENDMODE")),
    }
  end
  return out
end

local function track_fx(tr)
  local out = json.array({})
  for f = 0, reaper.TrackFX_GetCount(tr) - 1 do
    local _, name = reaper.TrackFX_GetFXName(tr, f)
    out[#out + 1] = { index = f, name = name or "", enabled = reaper.TrackFX_GetEnabled(tr, f) }
  end
  return out
end

local function track_state(tr)
  local recmode = math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_RECMODE"))
  return {
    id = track_guid(tr),
    index = track_number(tr),
    name = track_name(tr),
    selected = reaper.GetMediaTrackInfo_Value(tr, "I_SELECTED") ~= 0,
    armed = reaper.GetMediaTrackInfo_Value(tr, "I_RECARM") ~= 0,
    input = describe_input(reaper.GetMediaTrackInfo_Value(tr, "I_RECINPUT")),
    monitoring = MONITOR[math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_RECMON"))] or "on",
    recordMode = RECMODES[recmode] or ("mode-" .. recmode),
    volumeDb = gain_to_db(reaper.GetMediaTrackInfo_Value(tr, "D_VOL")) or -150,
    pan = round(reaper.GetMediaTrackInfo_Value(tr, "D_PAN"), 3),
    muted = reaper.GetMediaTrackInfo_Value(tr, "B_MUTE") ~= 0,
    soloed = reaper.GetMediaTrackInfo_Value(tr, "I_SOLO") ~= 0,
    channels = math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_NCHAN")),
    itemCount = reaper.CountTrackMediaItems(tr),
    isFolder = reaper.GetMediaTrackInfo_Value(tr, "I_FOLDERDEPTH") == 1,
    fx = track_fx(tr),
    sends = track_sends(tr),
  }
end

local function tape_mode() return toggle(ACTIONS.newrec_tape) == 1 end

local function new_take_mode()
  if tape_mode() then return "tape" end
  if toggle(ACTIONS.newrec_item_layers) == 1 or toggle(ACTIONS.newrec_lanes_layers) == 1 or toggle(ACTIONS.newrec_lanes_exclusive) == 1 then
    return "lanes"
  end
  if toggle(ACTIONS.newrec_takes) == 1 then return "takes" end
  local ax = cfg_int("autoxfade")
  if ax then
    if ax & 4 ~= 0 then return "tape" end
    if ax & 8 ~= 0 then return "lanes" end
    return "takes"
  end
  return "unknown"
end

local function record_mode()
  if toggle(ACTIONS.recmode_normal) == 1 then return "normal" end
  if toggle(ACTIONS.recmode_timesel_punch) == 1 then return "time-selection-punch" end
  if toggle(ACTIONS.recmode_item_punch) == 1 then return "item-punch" end
  return "unknown"
end

local function count_in_state()
  local en = cfg_int("projmetroen")
  local bars = cfg_num("projmetrocountin")
  if not en or not bars then return json.null end
  return { enabled = en & 16 ~= 0, bars = bars }
end

local function time_sig_at(t)
  local num, den, bpm = reaper.TimeMap_GetTimeSigAtTime(0, t or 0)
  return num, den, bpm
end

local function transport_name(ps)
  if ps & 4 ~= 0 then return (ps & 2 ~= 0) and "recording-paused" or "recording" end
  if ps & 2 ~= 0 then return "paused" end
  if ps & 1 ~= 0 then return "playing" end
  return "stopped"
end

local function project_key()
  local proj, path = reaper.EnumProjects(-1)
  return tostring(proj):gsub("^userdata: ", "") .. "|" .. (path or "")
end
K.project_key = project_key

-- A tempo map is "simple" when it has no markers, or only one at time 0.
local function simple_tempo_map()
  local n = reaper.CountTempoTimeSigMarkers(0)
  if n == 0 then return true, nil end
  if n == 1 then
    local ok, tpos = reaper.GetTempoTimeSigMarker(0, 0)
    if ok and tpos == 0 then return true, 0 end
  end
  return false, nil
end

local function base_project_state()
  local _, path = reaper.EnumProjects(-1)
  path = path or ""
  local ps = reaper.GetPlayState()
  local cursor = reaper.GetCursorPosition()
  local pos = (ps & 1 ~= 0 or ps & 4 ~= 0) and reaper.GetPlayPosition() or cursor
  local num, den, bpm = time_sig_at(cursor)
  local ls, le = reaper.GetSet_LoopTimeRange2(0, false, true, 0, 0, false)
  local ts, te = reaper.GetSet_LoopTimeRange2(0, false, false, 0, 0, false)
  local en = cfg_int("projmetroen")

  local markers = json.array({})
  local _, nm, nr = reaper.CountProjectMarkers(0)
  for i = 0, nm + nr - 1 do
    local ok, isrgn, mpos, rgnend, name, idx = reaper.EnumProjectMarkers3(0, i)
    if ok and ok > 0 then
      markers[#markers + 1] = {
        id = idx, name = name or "", position = mpos, bar = bar_of(mpos), isRegion = isrgn,
        ["end"] = isrgn and rgnend or json.null,
      }
    end
  end

  local tracks = json.array({})
  for i = 0, reaper.CountTracks(0) - 1 do tracks[#tracks + 1] = track_state(reaper.GetTrack(0, i)) end

  local inputs = json.array({})
  for c = 0, math.min(reaper.GetNumAudioInputs(), 256) - 1 do
    inputs[#inputs + 1] = { channel = c + 1, name = reaper.GetInputChannelName(c) or ("Input " .. (c + 1)) }
  end

  local pname = reaper.GetProjectName(0)
  return {
    daw = { adapter = "reaper", name = "REAPER", version = reaper.GetAppVersion(), simulated = false },
    project = {
      key = project_key(),
      name = (pname ~= "" and pname) or "Untitled project",
      path = path ~= "" and path or json.null,
      saved = path ~= "",
      dirty = reaper.IsProjectDirty(0) ~= 0,
      recordPath = reaper.GetProjectPathEx(0) or json.null,
      lengthSeconds = reaper.GetProjectLength(0),
    },
    tempo = { bpm = round(bpm, 3), numerator = num, denominator = den, hasTempoMap = not simple_tempo_map() },
    transport = {
      state = transport_name(ps), position = pos, positionBar = bar_of(pos), cursor = cursor, cursorBar = bar_of(cursor),
      ["repeat"] = reaper.GetSetRepeat(-1) == 1,
    },
    loop = (le > ls) and { start = ls, ["end"] = le } or json.null,
    timeSelection = (te > ts) and { start = ts, ["end"] = te } or json.null,
    recording = {
      countIn = count_in_state(),
      metronome = (en == nil) and json.null or (en & 1 ~= 0),
      newTakeMode = new_take_mode(),
      recordMode = record_mode(),
    },
    markers = markers,
    tracks = tracks,
    audioInputs = inputs,
  }
end
local augment_state -- 0.4: selection, sections and per-track extras (set further down)
local function project_state()
  local st = base_project_state()
  if augment_state then st = augment_state(st) end
  return st
end
K.project_state = project_state

local function take_info(take, active_take)
  local src = reaper.GetMediaItemTake_Source(take)
  local file = src and reaper.GetMediaSourceFileName(src) or ""
  local markers = json.array({})
  for m = 0, reaper.GetNumTakeMarkers(take) - 1 do
    local _, mname = reaper.GetTakeMarker(take, m)
    markers[#markers + 1] = mname or ""
  end
  local _, name = reaper.GetSetMediaItemTakeInfo_String(take, "P_NAME", "", false)
  local is_midi = reaper.TakeIsMIDI(take)
  return {
    name = name or "",
    active = take == active_take,
    isMidi = is_midi,
    file = (file ~= "" and file) or json.null,
    fileExists = (file ~= "" and file_exists(file)) or (is_midi and json.null or false),
    markers = markers,
  }
end

local function item_info(item, tr)
  local takes = json.array({})
  local active = reaper.GetActiveTake(item)
  for t = 0, reaper.CountTakes(item) - 1 do
    local take = reaper.GetTake(item, t)
    if take then
      local ti = take_info(take, active)
      ti.index = t
      takes[#takes + 1] = ti
    else
      takes[#takes + 1] = { index = t, name = "", active = false, isMidi = false, file = json.null, fileExists = json.null, empty = true }
    end
  end
  local lane = reaper.GetMediaItemInfo_Value(item, "I_FIXEDLANE")
  return {
    id = item_guid(item),
    trackId = track_guid(tr),
    position = reaper.GetMediaItemInfo_Value(item, "D_POSITION"),
    length = reaper.GetMediaItemInfo_Value(item, "D_LENGTH"),
    lane = lane and math.floor(lane) or json.null,
    takes = takes,
  }
end

------------------------------------------------------------------------------
-- Recording bookkeeping: snapshot armed tracks before a pass, diff after it
------------------------------------------------------------------------------
local recording = { snapshot = nil, last_report = nil }
K.recording = recording

-- Identity of a take that survives REAPER splitting items: the recorded file
-- (audio), or the take GUID (MIDI and other sources without a file).
local function take_key(take)
  local src = reaper.GetMediaItemTake_Source(take)
  local file = src and reaper.GetMediaSourceFileName(src) or ""
  if file ~= "" then return "file:" .. file, file end
  local _, g = reaper.GetSetMediaItemTakeInfo_String(take, "GUID", "", false)
  return "take:" .. (g or tostring(take)), nil
end

local function snapshot_armed()
  local snap = { tracks = {}, started_at = reaper.GetCursorPosition(), time = reaper.time_precise() }
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    if reaper.GetMediaTrackInfo_Value(tr, "I_RECARM") ~= 0 then
      local keys = {}
      for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
        local it = reaper.GetTrackMediaItem(tr, j)
        for t = 0, reaper.CountTakes(it) - 1 do
          local take = reaper.GetTake(it, t)
          if take then keys[(take_key(take))] = true end
        end
      end
      snap.tracks[track_guid(tr)] = keys
    end
  end
  return snap
end

-- What a recording pass produced. A take is new when its file (or take id) was not on the
-- track before the pass; earlier takes are preserved when every one of them is still there.
-- Both checks are by identity, so REAPER splitting an overlapped item into segments does not
-- turn old takes into "new" ones or count one pass twice.
local function recording_report(snap)
  local report = {
    startedAt = snap and snap.started_at or json.null,
    stoppedAt = reaper.GetCursorPosition(),
    newTakes = json.array({}),
    previousTakesPreserved = json.null,
  }
  if not snap then return report end
  local preserved = true
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    local before = snap.tracks[track_guid(tr)]
    if before then
      local present, reported = {}, {}
      for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
        local it = reaper.GetTrackMediaItem(tr, j)
        local active = reaper.GetActiveTake(it)
        for t = 0, reaper.CountTakes(it) - 1 do
          -- Empty take lanes (gaps left when passes of different lengths stack) have no take.
          local take = reaper.GetTake(it, t)
          if take then
            local key = take_key(take)
            present[key] = true
            if not before[key] then
              local pos = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
              local len = reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
              local r = reported[key]
              if r then
                -- Another segment of the same pass: extend the reported span.
                local e = math.max(r.position + r.length, pos + len)
                r.position = math.min(r.position, pos)
                r.length = e - r.position
              else
                local ti = take_info(take, active)
                r = {
                  trackId = track_guid(tr), trackName = track_label(tr), itemId = item_guid(it), takeIndex = t, takeName = ti.name,
                  file = ti.file, fileExists = ti.fileExists, position = pos, length = len,
                }
                reported[key] = r
                report.newTakes[#report.newTakes + 1] = r
              end
            end
          end
        end
      end
      for key in pairs(before) do
        if not present[key] then preserved = false end
      end
    end
  end
  report.previousTakesPreserved = preserved
  return report
end
K.recording_report = recording_report

------------------------------------------------------------------------------
-- Results
------------------------------------------------------------------------------
local function verified(ok, data, observed, message, warnings)
  return {
    status = ok and "verified" or "unverified",
    data = data, observed = observed, message = message,
    warnings = (warnings and #warnings > 0) and json.array(warnings) or nil,
  }
end

local function read_ok(data, message)
  return { status = "ok", data = data, message = message }
end

-- A handler can return pending(check, timeout_s): check() runs every defer
-- cycle until it returns a result table, or the timeout passes.
local PENDING_MT = {}
local function pending(check, timeout_s, on_timeout)
  return setmetatable({ check = check, timeout = timeout_s, on_timeout = on_timeout }, PENDING_MT)
end
local function is_pending(v) return getmetatable(v) == PENDING_MT end

------------------------------------------------------------------------------
-- FX helpers
------------------------------------------------------------------------------
local function fx_prefix(name)
  return name:match("^(%w+):") or ""
end
local function fx_is_instrument(name)
  local p = fx_prefix(name)
  return p:sub(-1) == "i" and p ~= "" -- VSTi, VST3i, AUi, CLAPi, LV2i
end

local function installed_fx()
  local list = {}
  local i = 0
  while true do
    local ok, name, ident = reaper.EnumInstalledFX(i)
    if not ok then break end
    list[#list + 1] = { name = name, ident = ident or "", instrument = fx_is_instrument(name), format = fx_prefix(name) }
    i = i + 1
    if i > 20000 then break end
  end
  return list
end

local function match_installed_fx(query)
  local q = lower(trim(query))
  local list = installed_fx()
  for _, fx in ipairs(list) do
    if lower(fx.name) == q or lower(fx.ident) == q then return fx end
  end
  local hits = {}
  for _, fx in ipairs(list) do
    if lower(fx.name):find(q, 1, true) then hits[#hits + 1] = fx end
  end
  if #hits == 1 then return hits[1] end
  local names = {}
  for k = 1, math.min(#hits, 10) do names[k] = hits[k].name end
  if #hits > 1 then
    fail("AMBIGUOUS_TARGET", string.format("“%s” matches %d installed plug-ins.", query, #hits), "Choose one: " .. table.concat(names, "; "), { matches = json.array(names) })
  end
  fail("FX_NOT_FOUND", string.format("No installed plug-in matches “%s”.", query))
end

local function resolve_fx(tr, ref)
  arg_table(ref, "fx")
  local count = reaper.TrackFX_GetCount(tr)
  if ref.index ~= nil then
    local idx = arg_int(ref.index, "fx.index", 0, 1023)
    if idx >= count then fail("FX_NOT_FOUND", string.format("%s has no effect in slot %d.", track_label(tr), idx + 1)) end
    return idx
  end
  if ref.step ~= nil or ref.by == "batch" then
    local r = batch_results and batch_results[arg_int(ref.step, "fx.step", 1, 500)]
    local idx = r and r.data and r.data.fxIndex
    if not idx then fail("FX_NOT_FOUND", "That step did not add an effect.") end
    return idx
  end
  if ref.name ~= nil then
    local q = lower(arg_string(ref.name, "fx.name", 256))
    local found = nil
    for f = 0, count - 1 do
      local _, nm = reaper.TrackFX_GetFXName(tr, f)
      if lower(nm):find(q, 1, true) then
        if found then fail("AMBIGUOUS_TARGET", string.format("%s has more than one effect matching “%s”.", track_label(tr), ref.name)) end
        found = f
      end
    end
    if not found then fail("FX_NOT_FOUND", string.format("%s has no effect matching “%s”.", track_label(tr), ref.name)) end
    return found
  end
  fail("INVALID_ARGS", "fx must give index, name or step")
end

local function resolve_param(tr, fx, ref)
  arg_table(ref, "param")
  local n = reaper.TrackFX_GetNumParams(tr, fx)
  if ref.index ~= nil then
    local p = arg_int(ref.index, "param.index", 0, 100000)
    if p >= n then fail("PARAM_NOT_FOUND", "The effect has no parameter " .. p) end
    return p
  end
  local q = lower(arg_string(ref.name, "param.name", 128))
  local partial = {}
  for p = 0, n - 1 do
    local _, pname = reaper.TrackFX_GetParamName(tr, fx, p)
    if lower(pname) == q then return p end
    if lower(pname):find(q, 1, true) then partial[#partial + 1] = p end
  end
  if #partial == 1 then return partial[1] end
  if #partial > 1 then fail("AMBIGUOUS_TARGET", string.format("Several parameters match “%s”.", ref.name)) end
  fail("PARAM_NOT_FOUND", string.format("The effect has no parameter named “%s”.", ref.name))
end

local function formatted_param(tr, fx, p)
  local _, s = reaper.TrackFX_GetFormattedParamValue(tr, fx, p)
  return s or ""
end

-- Displayed value for a hypothetical normalized value. Uses the Cockos
-- extension when the plug-in supports it; otherwise sets and reads back.
local function format_at(tr, fx, p, v)
  local ok, s = reaper.TrackFX_FormatParamValueNormalized(tr, fx, p, v)
  if ok and s and s ~= "" then return s end
  reaper.TrackFX_SetParamNormalized(tr, fx, p, v)
  return formatted_param(tr, fx, p)
end

local function parse_display_number(s)
  local l = lower(s)
  if l:find("inf", 1, true) then return l:find("%-") and -math.huge or math.huge end
  local num = s:match("[-+]?%d+[.,]?%d*")
  if not num then return nil end
  return tonumber((num:gsub(",", ".")))
end

local function set_param_option(tr, fx, p, option)
  local q = lower(trim(option))
  local original = reaper.TrackFX_GetParamNormalized(tr, fx, p)
  local _, step = reaper.TrackFX_GetParameterStepSizes(tr, fx, p)
  local steps = 256
  if step and step > 0 and step < 1 then steps = math.min(1024, math.floor(1 / step + 0.5)) end
  local best, best_exact = nil, false
  local seen = {}
  for k = 0, steps do
    local v = k / steps
    local s = format_at(tr, fx, p, v)
    local ls = lower(trim(s))
    if not seen[ls] then
      seen[ls] = v
      if ls == q then best, best_exact = v, true; break end
      if not best and not q:match("^[-+%d%.]+$") and ls:find(q, 1, true) then best = v end
    end
  end
  if not best then
    reaper.TrackFX_SetParamNormalized(tr, fx, p, original)
    local options = {}
    for s in pairs(seen) do options[#options + 1] = s end
    table.sort(options)
    fail("VALUE_NOT_FOUND", string.format("The parameter has no option matching “%s”.", option), nil, { options = json.array(options) })
  end
  reaper.TrackFX_SetParamNormalized(tr, fx, p, best)
  return best, best_exact
end

local function set_param_display(tr, fx, p, target)
  local lo_v, hi_v = 0.0, 1.0
  local f_lo = parse_display_number(format_at(tr, fx, p, 0.0))
  local f_hi = parse_display_number(format_at(tr, fx, p, 1.0))
  if f_lo == nil or f_hi == nil then fail("VALUE_NOT_FOUND", "The parameter does not display numeric values.") end
  local increasing = f_hi >= f_lo
  local clamped = false
  if (increasing and target <= f_lo) or (not increasing and target >= f_lo) then
    reaper.TrackFX_SetParamNormalized(tr, fx, p, 0.0); clamped = target ~= f_lo
  elseif (increasing and target >= f_hi) or (not increasing and target <= f_hi) then
    reaper.TrackFX_SetParamNormalized(tr, fx, p, 1.0); clamped = target ~= f_hi
  else
    for _ = 1, 40 do
      local mid = (lo_v + hi_v) / 2
      local f = parse_display_number(format_at(tr, fx, p, mid))
      if f == nil then break end
      if (f < target) == increasing then lo_v = mid else hi_v = mid end
    end
    local v_lo, v_hi = lo_v, hi_v
    local d_lo = math.abs((parse_display_number(format_at(tr, fx, p, v_lo)) or math.huge) - target)
    local d_hi = math.abs((parse_display_number(format_at(tr, fx, p, v_hi)) or math.huge) - target)
    reaper.TrackFX_SetParamNormalized(tr, fx, p, d_lo <= d_hi and v_lo or v_hi)
  end
  return clamped
end

------------------------------------------------------------------------------
-- Command handlers
--   ctx.change()      open the undo block before the first modification
--   return verified(...) / read_ok(...) / pending(...)
------------------------------------------------------------------------------
local H = {}
K.handlers = H

H.getProjectState = function()
  return read_ok(project_state())
end

H.listInstalledFx = function(a)
  local filter = opt(a.filter, function(v) if type(v) ~= "string" then fail("INVALID_ARGS", "filter must be a string") end return lower(v) end)
  local kind = a.kind or "any"
  local limit = opt(a.limit, arg_int, "limit", 1, 2000) or 500
  local out = json.array({})
  local total = 0
  for _, fx in ipairs(installed_fx()) do
    local keep = (kind == "any") or (kind == "instrument" and fx.instrument) or (kind == "effect" and not fx.instrument)
    if keep and filter and filter ~= "" then keep = lower(fx.name):find(filter, 1, true) ~= nil or lower(fx.ident):find(filter, 1, true) ~= nil end
    if keep then
      total = total + 1
      if #out < limit then out[#out + 1] = fx end
    end
  end
  return read_ok({ fx = out, total = total })
end

H.listFxParameters = function(a)
  local tr = find_track(a.track)
  local fx = resolve_fx(tr, a.fx)
  local params = json.array({})
  for p = 0, math.min(reaper.TrackFX_GetNumParams(tr, fx), 512) - 1 do
    local _, pname = reaper.TrackFX_GetParamName(tr, fx, p)
    params[#params + 1] = { index = p, name = pname or "", normalized = reaper.TrackFX_GetParamNormalized(tr, fx, p), display = formatted_param(tr, fx, p) }
  end
  local _, fxname = reaper.TrackFX_GetFXName(tr, fx)
  return read_ok({ fxIndex = fx, fxName = fxname, params = params })
end

H.getMeters = function(a)
  local out = json.array({})
  local list = {}
  if type(a.tracks) == "table" and #a.tracks > 0 then
    for i, ref in ipairs(a.tracks) do list[#list + 1] = find_track(ref, "tracks[" .. i .. "]") end
  else
    for i = 0, reaper.CountTracks(0) - 1 do list[#list + 1] = reaper.GetTrack(0, i) end
  end
  for _, tr in ipairs(list) do
    local l, r = reaper.Track_GetPeakInfo(tr, 0), reaper.Track_GetPeakInfo(tr, 1)
    out[#out + 1] = { trackId = track_guid(tr), name = track_label(tr), peakDb = gain_to_db(math.max(l, r)) or -150,
      leftDb = gain_to_db(l) or -150, rightDb = gain_to_db(r) or -150 }
  end
  return read_ok({ meters = out, playState = transport_name(reaper.GetPlayState()) })
end

H.setTempo = function(a, ctx)
  local bpm = arg_number(a.bpm, "bpm", 20, 400)
  local simple, marker = simple_tempo_map()
  if not simple then
    fail("PRECONDITION_FAILED", "This project has a tempo map with tempo changes; Assist only changes the tempo of projects with a single tempo.", "Edit the tempo markers in REAPER.")
  end
  local before = reaper.Master_GetTempo()
  ctx.change()
  if marker then
    local _, _, _, _, _, num, den, linear = reaper.GetTempoTimeSigMarker(0, 0)
    reaper.SetTempoTimeSigMarker(0, 0, 0, -1, -1, bpm, num, den, linear)
  else
    reaper.SetCurrentBPM(0, bpm, false)
  end
  reaper.UpdateTimeline()
  local _, _, after = time_sig_at(0)
  local ok = math.abs(after - bpm) < 0.001
  return verified(ok, { bpm = after, previousBpm = before }, { bpm = after }, string.format("Tempo %.3g → %.3g BPM", before, after))
end

H.setTimeSignature = function(a, ctx)
  local num = arg_int(a.numerator, "numerator", 1, 32)
  local den = arg_int(a.denominator, "denominator", 1, 32)
  if not ({ [1] = 1, [2] = 1, [4] = 1, [8] = 1, [16] = 1, [32] = 1 })[den] then fail("INVALID_ARGS", "denominator must be 1, 2, 4, 8, 16 or 32") end
  local simple, marker = simple_tempo_map()
  if not simple then fail("PRECONDITION_FAILED", "This project has tempo/time-signature changes; edit them in REAPER.") end
  local pn, pd, bpm = time_sig_at(0)
  ctx.change()
  if marker then
    reaper.SetTempoTimeSigMarker(0, 0, 0, -1, -1, bpm, num, den, false)
  else
    reaper.SetTempoTimeSigMarker(0, -1, 0, -1, -1, bpm, num, den, false)
  end
  reaper.UpdateTimeline()
  local an, ad = time_sig_at(0)
  return verified(an == num and ad == den, { numerator = an, denominator = ad }, { numerator = an, denominator = ad },
    string.format("Time signature %d/%d → %d/%d", pn, pd, an, ad))
end

H.saveProject = function()
  local _, path = reaper.EnumProjects(-1)
  if not path or path == "" then
    fail("PRECONDITION_FAILED", "This project has never been saved, so it has no file yet.",
      "Save it once in REAPER (File › Save project as…) to choose where it lives. Assist never picks a location or overwrites files for you.")
  end
  reaper.Main_OnCommand(ACTIONS.save_project, 0)
  return pending(function()
    if reaper.IsProjectDirty(0) == 0 then
      return verified(true, { path = path }, { dirty = false }, "Saved " .. path)
    end
  end, 10, function()
    return verified(false, { path = path }, { dirty = true }, "Save was requested but REAPER still reports unsaved changes.")
  end)
end

H.setCursor = function(a)
  local t = position_to_time(a.position)
  reaper.SetEditCurPos(t, true, true)
  local now = reaper.GetCursorPosition()
  return verified(math.abs(now - t) < 1e-6, { cursor = now, bar = bar_of(now) }, { cursor = now }, "Cursor at " .. reaper.format_timestr_pos(now, "", 2))
end

H.addMarker = function(a, ctx)
  local ps = reaper.GetPlayState()
  local t = a.position and position_to_time(a.position) or ((ps & 5 ~= 0) and reaper.GetPlayPosition() or reaper.GetCursorPosition())
  local name = a.name and arg_string(a.name, "name", 256) or ""
  ctx.change()
  local idx = reaper.AddProjectMarker2(0, false, t, 0, name, -1, 0)
  local found = false
  local _, nm, nr = reaper.CountProjectMarkers(0)
  for i = 0, nm + nr - 1 do
    local _, isrgn, mpos, _, mname, midx = reaper.EnumProjectMarkers3(0, i)
    if not isrgn and midx == idx and math.abs(mpos - t) < 1e-6 and mname == name then found = true end
  end
  return verified(found, { markerId = idx, position = t, bar = bar_of(t) }, nil, string.format("Marker %d%s at %s", idx, name ~= "" and (" “" .. name .. "”") or "", reaper.format_timestr_pos(t, "", 2)))
end

H.addRegion = function(a, ctx)
  local s = position_to_time(a.start, "start")
  local e = position_to_time(a["end"], "end")
  if e <= s then fail("INVALID_ARGS", "The region must end after it starts.") end
  local name = a.name and arg_string(a.name, "name", 256) or ""
  ctx.change()
  local idx = reaper.AddProjectMarker2(0, true, s, e, name, -1, 0)
  local found = false
  local _, nm, nr = reaper.CountProjectMarkers(0)
  for i = 0, nm + nr - 1 do
    local _, isrgn, mpos, mend, _, midx = reaper.EnumProjectMarkers3(0, i)
    if isrgn and midx == idx and math.abs(mpos - s) < 1e-6 and math.abs(mend - e) < 1e-6 then found = true end
  end
  return verified(found, { regionId = idx, start = s, ["end"] = e }, nil, string.format("Region %d “%s”", idx, name))
end

H.setLoopRegion = function(a)
  local s = position_to_time(a.start, "start")
  local e = position_to_time(a["end"], "end")
  if e <= s then fail("INVALID_ARGS", "The loop must end after it starts.") end
  reaper.GetSet_LoopTimeRange2(0, true, true, s, e, false)
  if a["repeat"] ~= false then reaper.GetSetRepeat(1) end
  local rs, re = reaper.GetSet_LoopTimeRange2(0, false, true, 0, 0, false)
  local rep = reaper.GetSetRepeat(-1) == 1
  local ok = math.abs(rs - s) < 1e-6 and math.abs(re - e) < 1e-6 and (a["repeat"] == false or rep)
  return verified(ok, { start = rs, ["end"] = re, ["repeat"] = rep }, { startBar = bar_of(rs), endBar = bar_of(re) },
    string.format("Loop %s – %s, repeat %s", reaper.format_timestr_pos(rs, "", 2), reaper.format_timestr_pos(re, "", 2), rep and "on" or "off"))
end

H.clearLoopRegion = function()
  reaper.GetSetRepeat(0)
  local rep = reaper.GetSetRepeat(-1) == 1
  return verified(not rep, { ["repeat"] = rep }, nil, "Repeat off")
end

H.setPunchRegion = function(a)
  local s = position_to_time(a.start, "start")
  local e = position_to_time(a["end"], "end")
  if e <= s then fail("INVALID_ARGS", "The punch range must end after it starts.") end
  reaper.GetSet_LoopTimeRange2(0, true, false, s, e, false)
  reaper.Main_OnCommand(ACTIONS.recmode_timesel_punch, 0)
  local ts, te = reaper.GetSet_LoopTimeRange2(0, false, false, 0, 0, false)
  local ok = math.abs(ts - s) < 1e-6 and math.abs(te - e) < 1e-6 and toggle(ACTIONS.recmode_timesel_punch) == 1
  return verified(ok, { start = ts, ["end"] = te, recordMode = record_mode() }, nil,
    string.format("Punch-in %s – %s (time-selection auto-punch)", reaper.format_timestr_pos(ts, "", 2), reaper.format_timestr_pos(te, "", 2)))
end

H.clearPunchRegion = function()
  reaper.Main_OnCommand(ACTIONS.recmode_normal, 0)
  return verified(toggle(ACTIONS.recmode_normal) == 1, { recordMode = record_mode() }, nil, "Record mode: normal")
end

local function set_count_in(enabled, bars)
  local en = cfg_int("projmetroen")
  if en == nil then fail("UNSUPPORTED", "This REAPER version does not expose the count-in setting.") end
  en = enabled and (en | 16) or (en & ~16)
  reaper.set_config_var_string("projmetroen", tostring(en), 0)
  if bars then reaper.set_config_var_string("projmetrocountin", fmt_num(bars), 0) end
  local st = count_in_state()
  local ok = st ~= json.null and st.enabled == enabled and (not bars or math.abs(st.bars - bars) < 1e-6)
  return ok, st
end

H.setCountIn = function(a)
  local enabled = arg_bool(a.enabled, "enabled")
  local bars = opt(a.bars, arg_number, "bars", 0.25, 16)
  local ok, st = set_count_in(enabled, bars)
  local warnings = {}
  local en = cfg_int("projmetroen") or 0
  if enabled and en & 1 == 0 then
    warnings[1] = "The metronome is off. REAPER still counts in, but you may not hear clicks; say “metronome on” if you need them."
  end
  return verified(ok, st, st, enabled and string.format("Count-in on: %s bar%s", fmt_num(st.bars), st.bars == 1 and "" or "s") or "Count-in off", warnings)
end

H.setMetronome = function(a)
  local enabled = arg_bool(a.enabled, "enabled")
  reaper.Main_OnCommand(enabled and ACTIONS.metronome_on or ACTIONS.metronome_off, 0)
  local on = toggle(ACTIONS.metronome_toggle) == 1
  return verified(on == enabled, { metronome = on }, nil, "Metronome " .. (on and "on" or "off"))
end

-- Load a colour theme REAPER Assist saved in REAPER's own ColorThemes folder.
-- Only that folder and theme files are accepted; nothing in the project changes.
H.loadColorTheme = function(a)
  local path = a.path
  if type(path) ~= "string" or path == "" then fail("INVALID_ARGS", "path is required") end
  local dir = reaper.GetResourcePath() .. "/ColorThemes/"
  local norm = path:gsub("\\", "/")
  local ndir = dir:gsub("\\", "/")
  if norm:sub(1, #ndir) ~= ndir or norm:find("..", 1, true) or not norm:match("%.ReaperThemeZip$") then
    fail("INVALID_ARGS", "Only theme files in REAPER's ColorThemes folder can be loaded.")
  end
  if not reaper.file_exists(path) then fail("NOT_FOUND", "That theme file doesn't exist.") end
  local ok = reaper.OpenColorThemeFile(path)
  local now = reaper.GetLastColorThemeFile() or ""
  return verified(ok and now:gsub("\\", "/") == norm, { theme = now }, nil, "Theme loaded")
end

------------------------------------------------------------------------------
-- REAPER's action list (0.5): search it, run an action, add or remove a shortcut.
-- Gives the assistant everything REAPER can do from its action list (show/hide the docker,
-- toggle windows, zoom, …) without a dedicated command for each.
------------------------------------------------------------------------------
local ACTION_SECTIONS = { main = 0, midi = 32060, midilist = 32061, explorer = 32063 }

local function action_section(name)
  local id = ACTION_SECTIONS[name or "main"]
  if not id then fail("INVALID_ARGS", "section must be main, midi, midilist or explorer") end
  local sec = reaper.SectionFromUniqueID(id)
  if not sec then fail("UNSUPPORTED", "This REAPER can't list the " .. tostring(name) .. " actions.") end
  return sec, id
end

-- A command id from a number (native action) or a "_NAMED" id (scripts, SWS, custom actions).
local function action_cmd(ref)
  if type(ref) == "number" and ref >= 1 and ref == math.floor(ref) then return ref end
  if type(ref) == "string" and ref:match("^_[%w_%.%-]+$") then
    local c = reaper.NamedCommandLookup(ref)
    if c and c ~= 0 then return c end
    fail("NOT_FOUND", "No action " .. ref .. " in REAPER.", "Search with findActions first.")
  end
  fail("INVALID_ARGS", "action must be a REAPER action id (a number or an _ID)")
end

-- The id a user or another tool can use again: the number, or "_" .. its name for named actions.
local function action_ref(cmd)
  local named = reaper.ReverseNamedCommandLookup(cmd)
  if named and named ~= "" then return "_" .. named end
  return cmd
end

local function action_shortcuts(sec, cmd)
  local out = json.array({})
  local n = reaper.CountActionShortcuts(sec, cmd) or 0
  for i = 0, n - 1 do
    local ok, desc = reaper.GetActionShortcutDesc(sec, cmd, i, "")
    if ok and desc and desc ~= "" then out[#out + 1] = desc end
  end
  return out
end

local function action_state(secid, cmd)
  local st = reaper.GetToggleCommandStateEx(secid, cmd)
  if st == 1 then return true elseif st == 0 then return false end
  return json.null
end

-- The action's name; when the caller says which action it means (`expected`), it must match,
-- so the name the user approved is the action that runs.
local function action_name(sec, secid, cmd, expected)
  local name = reaper.kbd_getTextFromCmd(cmd, sec)
  if not name or name == "" then fail("NOT_FOUND", "No action " .. tostring(cmd) .. " in that section.") end
  if expected ~= nil and (type(expected) ~= "string" or expected:lower() ~= name:lower()) then
    fail("INVALID_ARGS", "Action " .. tostring(cmd) .. " is “" .. name .. "”, not “" .. tostring(expected) .. "”. Nothing was run.", "Use the id and name exactly as findActions returned them.")
  end
  return name
end

-- Actions the assistant may never run: quitting, closing projects, deleting files from disk.
local BLOCKED_ACTIONS = {
  "quit", "exit reaper", "close project", "close all project", "close current project",
  "delete .*from disk", "delete .*source", "delete .*media file", "remove .*and delete", "permanently delete",
  "clean current project directory", "nuke", "uninstall",
}
local function action_blocked(name)
  local l = name:lower()
  for _, pat in ipairs(BLOCKED_ACTIONS) do if l:find(pat) then return true end end
  return false
end

local function norm_key(s) return (s or ""):lower():gsub("%s+", ""):gsub("command", "cmd"):gsub("control", "ctrl"):gsub("option", "opt") end

H.findActions = function(a)
  local q = a.query
  if type(q) ~= "string" or q == "" or #q > 200 then fail("INVALID_ARGS", "query is required") end
  local limit = math.max(1, math.min(tonumber(a.limit) or 25, 100))
  local sec, secid = action_section(a.section)
  local words = {}
  for w in q:lower():gmatch("%S+") do words[#words + 1] = w end
  local want_key = a.shortcut and norm_key(a.shortcut) or nil
  local hits = {}
  local i = 0
  while true do
    local cmd, name = reaper.kbd_enumerateActions(sec, i)
    if not cmd or cmd == 0 then break end
    i = i + 1
    local l = (name or ""):lower()
    local ok = true
    for _, w in ipairs(words) do if not l:find(w, 1, true) then ok = false; break end end
    if ok and want_key then
      ok = false
      for _, d in ipairs(action_shortcuts(sec, cmd)) do if norm_key(d) == want_key then ok = true end end
    end
    if ok then
      -- Shorter names first: "View: Show docker" before "View: Show docker for each…".
      hits[#hits + 1] = { cmd = cmd, name = name }
    end
  end
  table.sort(hits, function(x, y) if #x.name ~= #y.name then return #x.name < #y.name end return x.name < y.name end)
  local out = json.array({})
  for k = 1, math.min(#hits, limit) do
    local h = hits[k]
    out[#out + 1] = { action = action_ref(h.cmd), name = h.name, on = action_state(secid, h.cmd), shortcuts = action_shortcuts(sec, h.cmd) }
  end
  return verified(true, { section = a.section or "main", total = #hits, actions = out, scanned = i }, nil,
    #hits == 0 and "No matching actions. Try fewer or other words (REAPER names actions like \"View: Show docker\")." or nil)
end

H.runAction = function(a)
  local sec, secid = action_section(a.section)
  local cmd = action_cmd(a.action)
  local name = action_name(sec, secid, cmd, a.name)
  if action_blocked(name) then fail("PRECONDITION_FAILED", "Assist doesn't run “" .. name .. "”. Do that one yourself in REAPER.") end
  local before_state = action_state(secid, cmd)
  local undo_before = reaper.Undo_CanUndo2(0) or ""
  if secid == 0 then
    reaper.Main_OnCommand(cmd, 0)
  elseif secid == 32060 or secid == 32061 then
    if not reaper.MIDIEditor_GetActive() then fail("PRECONDITION_FAILED", "Open a MIDI editor first: this is a MIDI editor action.") end
    reaper.MIDIEditor_LastFocused_OnCommand(cmd, secid == 32061)
  else
    fail("UNSUPPORTED", "Assist can only run main and MIDI editor actions.")
  end
  local undo_after = reaper.Undo_CanUndo2(0) or ""
  local after_state = action_state(secid, cmd)
  local data = { action = action_ref(cmd), name = name, on = after_state }
  local r = verified(true, data, nil, "Ran “" .. name .. "”" .. (after_state == true and " (now on)" or after_state == false and " (now off)" or ""))
  -- Actions that change the project add their own undo step, named after the action.
  if undo_after ~= undo_before and undo_after ~= "" then r.undoLabel = undo_after end
  if before_state ~= json.null and before_state == after_state then
    r.warnings = json.array({ "Its on/off state didn't change. The action may need a selection or a focused window." })
  end
  return r
end

-- Opens REAPER's own "add shortcut" window for an action: the user presses the key there and
-- REAPER saves it like any shortcut they set by hand. (REAPER has no call to set a key directly.)
H.assignShortcut = function(a)
  local sec, secid = action_section(a.section)
  local cmd = action_cmd(a.action)
  local name = action_name(sec, secid, cmd, a.name)
  local existing = action_shortcuts(sec, cmd)
  local taken = json.array({})
  if type(a.key) == "string" and a.key ~= "" then
    local want = norm_key(a.key)
    local i = 0
    while true do
      local c, n = reaper.kbd_enumerateActions(sec, i)
      if not c or c == 0 then break end
      i = i + 1
      if c ~= cmd then
        for _, d in ipairs(action_shortcuts(sec, c)) do
          if norm_key(d) == want then taken[#taken + 1] = { action = action_ref(c), name = n, shortcut = d } end
        end
      end
    end
  end
  local slot = reaper.CountActionShortcuts(sec, cmd) or 0
  reaper.defer(function() reaper.DoActionShortcutDialog(reaper.GetMainHwnd(), sec, cmd, slot) end)
  return verified(true, { action = action_ref(cmd), name = name, shortcuts = existing, keyAlreadyUsedBy = taken }, nil,
    "REAPER's shortcut window is open for “" .. name .. "”. Press the key there, then OK.")
end

H.removeShortcut = function(a)
  local sec, secid = action_section(a.section)
  local cmd = action_cmd(a.action)
  local name = action_name(sec, secid, cmd, a.name)
  if type(a.key) ~= "string" or a.key == "" then fail("INVALID_ARGS", "key is required") end
  local want = norm_key(a.key)
  local n = reaper.CountActionShortcuts(sec, cmd) or 0
  for i = n - 1, 0, -1 do
    local ok, desc = reaper.GetActionShortcutDesc(sec, cmd, i, "")
    if ok and norm_key(desc) == want then
      local done = reaper.DeleteActionShortcut(sec, cmd, i)
      return verified(done, { action = action_ref(cmd), name = name, removed = desc, shortcuts = action_shortcuts(sec, cmd) }, nil,
        done and ("Removed " .. desc .. " from “" .. name .. "”") or "REAPER didn't remove it")
    end
  end
  fail("NOT_FOUND", "“" .. name .. "” has no shortcut " .. a.key .. ".", nil, { shortcuts = action_shortcuts(sec, cmd) })
end

-- Quit REAPER the normal way (File: Quit, so REAPER asks to save unsaved projects), after this
-- reply is written. Assist uses it only for its own "restart REAPER to finish" button.
H.quitReaper = function(a)
  reaper.defer(function() reaper.defer(function() reaper.Main_OnCommand(40004, 0) end) end)
  return verified(true, { exe = reaper.GetExePath() }, nil, "Quitting REAPER")
end

------------------------------------------------------------------------------
-- Workspace: a browser docked beside the arrange view, set up while REAPER runs
------------------------------------------------------------------------------
-- The live twin of src/profiles/engine/workspace.ts (which edits reaper.ini while REAPER is
-- closed). REAPER keeps window layout in memory and rewrites it when it quits, so
-- this drives REAPER's own windows instead. Learned in throwaway REAPER 7.8 runs:
--  * Dock_UpdateDockID sets the docker a window opens in next time.
--  * The Media Explorer reads docked=1 and its shortcut list from
--    [reaper_sexplorer] when it opens, unless it was already opened as a floating
--    window in this session; then it stays floating until REAPER restarts.
--  * "Docker: show in left/right of main window" moves the docker holding the
--    focused window. A short-lived script window docked in the same docker takes
--    focus; gfx.getchar(65536) & 2 confirms it before anything moves, so another
--    docker (the mixer's) is never moved by mistake.
--  * A docker selects the tab added last, so the explorer is re-added at the end.

local WS = { explorer = 50124, fx_browser = 40271, mixer = 40078, mixer_dock = 40083, left = 41599, right = 41601,
  transport = 40259, transport_top = 41606, tcp_right = 42373, midi_dock = 40018 }
-- "Transport: Show transport docked below arrange / above ruler / to bottom / to top of main window".
local TRANSPORT_AT = { below = 41603, above = 41604, bottom = 41605, top = 41606 }
local function transport_where()
  if toggle(WS.transport) ~= 1 then return "hidden" end
  for k, id in pairs(TRANSPORT_AT) do if toggle(id) == 1 then return k end end
  return "docker"
end
local function arg_transport(v, name, hidden_ok)
  if not (TRANSPORT_AT[v] or (hidden_ok and v == "hidden")) then
    fail("INVALID_ARGS", name .. " must be below, above, bottom or top" .. (hidden_ok and " (or hidden)" or ""))
  end
  return v
end
local function set_transport(where)
  if where == "hidden" then
    if toggle(WS.transport) == 1 then reaper.Main_OnCommand(WS.transport, 0) end
    return
  end
  if toggle(WS.transport) ~= 1 then reaper.Main_OnCommand(WS.transport, 0) end
  if toggle(TRANSPORT_AT[where]) ~= 1 then reaper.Main_OnCommand(TRANSPORT_AT[where], 0) end
end
-- The open MIDI editor follows the wanted docking (new editors read [midiedit] dock).
local function set_midi_docked(want)
  local ed = reaper.MIDIEditor_GetActive()
  if ed and (reaper.DockIsChildOfDock(ed) ~= -1) ~= want then reaper.MIDIEditor_OnCommand(ed, WS.midi_dock) end
end

local function ini_split(text)
  local lines = {}
  for l in (text .. "\n"):gmatch("([^\n]*)\n") do lines[#lines + 1] = (l:gsub("\r$", "")) end
  local trailing = text:sub(-1) == "\n"
  if trailing then lines[#lines] = nil end
  return lines, (text:find("\r\n", 1, true) and "\r\n" or "\n"), trailing
end

local function ini_section(lines, sect)
  local want, s = "[" .. sect:lower() .. "]", nil
  for i, l in ipairs(lines) do
    if l:match("^%[.*%]%s*$") then
      if s then return s, i - 1 end
      if trim(l):lower() == want then s = i end
    end
  end
  if s then return s, #lines end
end

local function ini_get(lines, sect, key)
  local s, e = ini_section(lines, sect)
  if not s then return nil end
  for i = s + 1, e do
    local k, v = lines[i]:match("^([^=]+)=(.*)$")
    if k == key then return v end
  end
end

local function ini_set(lines, sect, key, value)
  local s, e = ini_section(lines, sect)
  if not s then
    if #lines > 0 and lines[#lines] ~= "" then lines[#lines + 1] = "" end
    lines[#lines + 1] = "[" .. sect .. "]"
    lines[#lines + 1] = key .. "=" .. value
    return
  end
  for i = s + 1, e do
    if lines[i]:match("^([^=]+)=") == key then lines[i] = key .. "=" .. value; return end
  end
  local at = e
  while at > s and trim(lines[at]) == "" do at = at - 1 end
  table.insert(lines, at + 1, key .. "=" .. value)
end

local function ini_remove(lines, sect, pred)
  local s, e = ini_section(lines, sect)
  if not s then return end
  for i = e, s + 1, -1 do
    local k = lines[i]:match("^([^=]+)=")
    if k and pred(k) then table.remove(lines, i) end
  end
end

-- Edit reaper.ini in one step on REAPER's main thread (REAPER can't write it meanwhile).
local function ws_edit_ini(fn)
  local path = reaper.get_ini_file()
  local text = read_file(path)
  if not text then fail("DAW_ERROR", "Couldn't read REAPER's settings file.") end
  local lines, eol, trailing = ini_split(text)
  fn(lines)
  local out = table.concat(lines, eol) .. (trailing and eol or "")
  if out == text then return end
  local dir = path:match("^(.*)[/\\][^/\\]*$") or reaper.GetResourcePath()
  local ok, err = write_atomic(dir, path, out)
  if not ok then fail("DAW_ERROR", "Couldn't write REAPER's settings file: " .. tostring(err)) end
end

-- A docker no other window uses (docker 0 holds the mixer by default).
local function ws_pick_docker()
  local lines = ini_split(read_file(reaper.get_ini_file()) or "")
  local used, mine = { [0] = true }, nil
  local s, e = ini_section(lines, "REAPERdockpref")
  for i = (s or 0) + 1, (s and e or 0) do
    local k, v = lines[i]:match("^([^=]+)=(.*)$")
    local n = v and tonumber(v:match("^%S+%s+(%d+)"))
    if k and n then
      if k == "explorer" then mine = n elseif k ~= "fxbrowser" then used[n] = true end
    end
  end
  if mine and not used[mine] then return mine end
  for n = 1, 15 do if not used[n] then return n end end
end

local function ws_folders(v, name)
  if v == nil then return {} end
  if type(v) ~= "table" or #v > 16 then fail("INVALID_ARGS", name .. " must be a list of up to 16 folders") end
  local out = {}
  for i, f in ipairs(v) do
    if type(f) ~= "table" then fail("INVALID_ARGS", name .. " entries must be objects") end
    local p = arg_string(f.path, name .. "[" .. i .. "].path", 1024)
    if p:find("[\r\n]") or (f.title ~= nil and (type(f.title) ~= "string" or f.title:find("[\r\n]"))) then fail("INVALID_ARGS", name .. " entries must be single lines") end
    out[#out + 1] = { path = p, title = f.title or p }
  end
  return out
end

-- Keep the user's Media Explorer shortcuts and add missing folders. A list that
-- was never saved means REAPER shows its own defaults, so those stay after ours
-- (when the app could say what they are; otherwise the list is left alone).
local function ws_shortcuts(lines, add, defaults)
  local S = "reaper_sexplorer"
  local n = tonumber(ini_get(lines, S, "NbShortcuts") or "")
  local list = {}
  for i = 0, math.min(n or 0, 200) - 1 do
    local p = ini_get(lines, S, "Shortcut" .. i)
    if p and p ~= "" then list[#list + 1] = { path = p, title = ini_get(lines, S, "ShortcutT" .. i) or "" } end
  end
  local fresh = #list == 0
  if fresh and #defaults == 0 then return end
  local function norm(p) p = p:gsub("[/\\]+$", ""); return p == "" and "/" or p end
  local have = {}
  for _, f in ipairs(list) do have[norm(f.path)] = true end
  local function push(f) if not have[norm(f.path)] then list[#list + 1] = f; have[norm(f.path)] = true end end
  for _, f in ipairs(add) do push(f) end
  if fresh then for _, f in ipairs(defaults) do push(f) end end
  ini_remove(lines, S, function(k) return k == "NbShortcuts" or k:match("^Shortcut%d+$") or k:match("^ShortcutT%d+$") end)
  ini_set(lines, S, "NbShortcuts", tostring(#list))
  for i, f in ipairs(list) do
    ini_set(lines, S, "Shortcut" .. (i - 1), f.path)
    ini_set(lines, S, "ShortcutT" .. (i - 1), f.title)
  end
end
K.ws = { split = ini_split, get = ini_get, set = ini_set, shortcuts = ws_shortcuts }

H.setupWorkspace = function(a)
  local side = a.side
  if side ~= "left" and side ~= "right" then fail("INVALID_ARGS", "side must be left or right") end
  local width = arg_int(a.width, "width", 160, 1200)
  local start = arg_string(a.startDir, "startDir", 1024)
  if start:find("[\r\n]") then fail("INVALID_ARGS", "startDir must be a single line") end
  local add, defaults = ws_folders(a.shortcuts, "shortcuts"), ws_folders(a.defaults, "defaults")
  -- transport / tcpRight / midiDocked: nil leaves REAPER as it is; otherwise REAPER ends up exactly so
  -- (switching profiles puts back the user's own setting for what the new profile doesn't change).
  local transport = opt(a.transport, arg_transport, "transport")
  if transport == nil and opt(a.transportTop, arg_bool, "transportTop") then transport = "top" end
  local tcp_right = opt(a.tcpRight, arg_bool, "tcpRight")
  local midi_docked = opt(a.midiDocked, arg_bool, "midiDocked")
  if reaper.GetPlayState() & 4 ~= 0 then fail("RECORDING_IN_PROGRESS", "REAPER is recording.", "Set up the browser after recording stops.") end
  local N = ws_pick_docker()
  if not N then fail("PRECONDITION_FAILED", "Every REAPER docker already holds other windows, so there's no free one for the browser.") end
  local want_pos = side == "left" and 1 or 3
  local open_dir = start:match("[/\\]$") and start or (start .. SEP)

  -- Close both so they reopen in docker N.
  if toggle(WS.explorer) == 1 then reaper.Main_OnCommand(WS.explorer, 0) end
  if toggle(WS.fx_browser) == 1 then reaper.Main_OnCommand(WS.fx_browser, 0) end
  reaper.Dock_UpdateDockID("explorer", N)
  reaper.Dock_UpdateDockID("fxbrowser", N)

  local st = { phase = 1, t = reaper.time_precise() }
  local function after(s) return reaper.time_precise() - st.t >= s end
  local function go(phase) st.phase, st.t = phase, reaper.time_precise() end
  local function close_gfx() if st.gfx then gfx.quit(); st.gfx = false end end
  local function result()
    local ex_dock = st.ex and reaper.DockIsChildOfDock(st.ex) or -1
    local pos = reaper.DockGetPosition(N)
    local data = { docker = N, side = (pos == 1 and "left") or (pos == 3 and "right") or (pos == 0 and "bottom") or (pos == 2 and "top") or "floating",
      explorerDocked = ex_dock == N, fxBrowserDocked = st.fx_docked == true,
      mixerDocked = toggle(WS.mixer) == 1 and toggle(WS.mixer_dock) == 1,
      transport = transport_where(), transportTop = transport_where() == "top", tcpRight = toggle(WS.tcp_right) == 1 }
    -- Only reported when a MIDI editor is open (new ones read [midiedit] dock).
    local ed = midi_docked ~= nil and reaper.MIDIEditor_GetActive() or nil
    if ed then data.midiEditorDocked = reaper.DockIsChildOfDock(ed) ~= -1 end
    local warnings = {}
    if not data.fxBrowserDocked then warnings[#warnings + 1] = "The FX Browser was open as a floating window earlier in this session, so REAPER keeps it floating until it restarts." end
    if st.no_focus then warnings[#warnings + 1] = "REAPER didn't give the browser's docker focus, so it wasn't moved. Right-click its tab › Attached docker position › " .. side .. "." end
    local ok = data.explorerDocked and pos == want_pos and (transport == nil or data.transport == transport)
      and (tcp_right == nil or data.tcpRight == tcp_right) and (data.midiEditorDocked == nil or data.midiEditorDocked == midi_docked)
    return verified(ok, data, nil, ok and ("Browser docked on the " .. side) or "Browser not fully set up", warnings)
  end

  return pending(function()
    if st.phase == 1 and after(0.2) then
      -- REAPER has saved the closed windows' settings; add ours, then reopen them.
      ws_edit_ini(function(lines)
        ini_set(lines, "reaper_sexplorer", "docked", "1")
        ini_set(lines, "reaper_sexplorer", "visible", "1")
        ini_set(lines, "reaper_sexplorer", "lastdir", open_dir)
        ws_shortcuts(lines, add, defaults)
        ini_set(lines, "reaper", "fxadd_dock", "1")
        if midi_docked ~= nil then ini_set(lines, "midiedit", "dock", midi_docked and "1" or "0") end
      end)
      reaper.Main_OnCommand(WS.fx_browser, 0)
      st.ex = reaper.OpenMediaExplorer(open_dir, false)
      go(2)
    elseif st.phase == 2 and after(0.3) then
      if not st.ex or reaper.DockIsChildOfDock(st.ex) ~= N then
        -- Opened floating earlier this session: REAPER won't dock it now, and nothing else is moved.
        return { status = "failed", error = { code = "PRECONDITION_FAILED",
          message = "The Media Explorer was opened as a floating window earlier in this session, and REAPER keeps it floating until it restarts.",
          hint = "Quit REAPER and press the button again; Assist then sets the layout before REAPER starts." },
          data = { docker = N, explorerDocked = false } }
      end
      reaper.DockWindowActivate(st.ex)
      st.fx_docked = toggle(WS.fx_browser) ~= 1 -- a docked tab that isn't showing reads as off
      if reaper.DockGetPosition(N) == want_pos then go(4) else
        gfx.init("REAPER Assist", 240, 240, 1 | (N << 8))
        st.gfx = true
        go(3)
      end
    elseif st.phase == 3 then
      local d = math.floor(gfx.dock(-1))
      local f = math.floor(gfx.getchar(65536))
      if f >= 0 and f & 2 == 2 and d & 1 == 1 and (d >> 8) & 0xff == N then
        reaper.Main_OnCommand(side == "left" and WS.left or WS.right, 0)
        go(4)
      elseif after(1.0) then
        st.no_focus = true
        go(4)
      end
    elseif st.phase == 4 and after(0.2) then
      close_gfx()
      -- Re-add the explorer so the docker remembers it as the selected tab.
      if toggle(WS.explorer) == 1 then reaper.Main_OnCommand(WS.explorer, 0) end
      ws_edit_ini(function(lines)
        local key = side == "left" and "dockheight_l" or "dockheight_r"
        if not ini_get(lines, "reaper", key) then ini_set(lines, "reaper", key, tostring(width)) end
        ini_set(lines, "reaper", "dockersel" .. N, "explorer")
      end)
      go(5)
    elseif st.phase == 5 and after(0.2) then
      st.ex = reaper.OpenMediaExplorer(open_dir, false)
      if toggle(WS.mixer) ~= 1 then reaper.Main_OnCommand(WS.mixer, 0) end
      if toggle(WS.mixer_dock) ~= 1 then reaper.Main_OnCommand(WS.mixer_dock, 0) end
      if transport then set_transport(transport) end
      if tcp_right ~= nil and (toggle(WS.tcp_right) == 1) ~= tcp_right then reaper.Main_OnCommand(WS.tcp_right, 0) end
      -- An open MIDI editor takes the command directly (no focus needed).
      if midi_docked ~= nil then set_midi_docked(midi_docked) end
      go(6)
    elseif st.phase == 6 and after(0.2) then
      return result()
    end
  end, 8.0, function()
    close_gfx()
    return { status = "failed", error = { code = "VERIFICATION_FAILED", message = "REAPER didn't finish setting up the browser in time." } }
  end)
end

-- Put REAPER's windows back the way they were before Assist changed them ("Restore REAPER").
-- The app passes the original states it recorded; anything not passed is left alone. Files
-- (reaper.ini, reaper-kb.ini) are restored by the app once REAPER has quit, since REAPER
-- rewrites them on exit.
H.restoreLayout = function(a)
  local transport = opt(a.transport, arg_transport, "transport", true)
  local tcp_right = opt(a.tcpRight, arg_bool, "tcpRight")
  local explorer = opt(a.explorerOpen, arg_bool, "explorerOpen")
  local fx_browser = opt(a.fxBrowserOpen, arg_bool, "fxBrowserOpen")
  local mixer = opt(a.mixerVisible, arg_bool, "mixerVisible")
  local mixer_docked = opt(a.mixerDocked, arg_bool, "mixerDocked")
  local midi_docked = opt(a.midiDocked, arg_bool, "midiDocked")
  if reaper.GetPlayState() & 4 ~= 0 then fail("RECORDING_IN_PROGRESS", "REAPER is recording.", "Restore after recording stops.") end

  -- A docked tab that isn't showing reads as off, so a window is shown first, then closed.
  local closing = {}
  if fx_browser == false then closing[#closing + 1] = WS.fx_browser end
  if explorer == false then closing[#closing + 1] = WS.explorer end
  local st = { i = 1, shown = false, t = reaper.time_precise() }
  local function after(s) return reaper.time_precise() - st.t >= s end
  local function result()
    local ed = reaper.MIDIEditor_GetActive()
    local data = { transport = transport_where(), tcpRight = toggle(WS.tcp_right) == 1, explorerOpen = toggle(WS.explorer) == 1,
      fxBrowserOpen = toggle(WS.fx_browser) == 1, mixerVisible = toggle(WS.mixer) == 1, mixerDocked = toggle(WS.mixer_dock) == 1 }
    if midi_docked ~= nil and ed then data.midiEditorDocked = reaper.DockIsChildOfDock(ed) ~= -1 end
    local ok = (transport == nil or data.transport == transport) and (tcp_right == nil or data.tcpRight == tcp_right)
      and (explorer ~= false or not data.explorerOpen) and (fx_browser ~= false or not data.fxBrowserOpen)
      and (mixer == nil or data.mixerVisible == mixer) and (mixer_docked == nil or data.mixerDocked == mixer_docked)
      and (data.midiEditorDocked == nil or data.midiEditorDocked == midi_docked)
    return verified(ok, data, nil, ok and "REAPER's windows are back as they were" or "Some windows weren't put back")
  end

  return pending(function()
    if not after(0.15) then return end
    local cmd = closing[st.i]
    if cmd then
      if toggle(cmd) == 1 then
        reaper.Main_OnCommand(cmd, 0)
        st.i, st.shown = st.i + 1, false
      elseif not st.shown then
        reaper.Main_OnCommand(cmd, 0)
        st.shown = true
      else
        st.i, st.shown = st.i + 1, false -- couldn't show it: it isn't open
      end
      st.t = reaper.time_precise()
      return
    end
    if not st.toggled then
      if transport then set_transport(transport) end
      if tcp_right ~= nil and (toggle(WS.tcp_right) == 1) ~= tcp_right then reaper.Main_OnCommand(WS.tcp_right, 0) end
      if mixer_docked ~= nil and (toggle(WS.mixer_dock) == 1) ~= mixer_docked then reaper.Main_OnCommand(WS.mixer_dock, 0) end
      if mixer ~= nil and (toggle(WS.mixer) == 1) ~= mixer then reaper.Main_OnCommand(WS.mixer, 0) end
      if midi_docked ~= nil then
        ws_edit_ini(function(lines) ini_set(lines, "midiedit", "dock", midi_docked and "1" or "0") end)
        set_midi_docked(midi_docked)
      end
      st.toggled, st.t = true, reaper.time_precise()
      return
    end
    if after(0.2) then return result() end
  end, 8.0, function()
    return { status = "failed", error = { code = "VERIFICATION_FAILED", message = "REAPER didn't finish putting its windows back in time." } }
  end)
end

H.setNewTakeMode = function(a)
  local mode = a.mode
  if mode ~= "takes" and mode ~= "lanes" then fail("INVALID_ARGS", "mode must be takes or lanes (tape mode is never selected)") end
  reaper.Main_OnCommand(ACTIONS.newrec_takes, 0)
  if mode == "lanes" then reaper.Main_OnCommand(ACTIONS.newrec_lanes_exclusive, 0) end
  local now = new_take_mode()
  local ok = (mode == "takes" and now == "takes") or (mode == "lanes" and now == "lanes")
  return verified(ok, { newTakeMode = now }, nil, "New recordings over existing media: " .. (now == "takes" and "add takes" or now))
end

local function armed_tracks()
  local out = {}
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    if reaper.GetMediaTrackInfo_Value(tr, "I_RECARM") ~= 0 then out[#out + 1] = tr end
  end
  return out
end

H.startPlayback = function(a)
  local ps = reaper.GetPlayState()
  if ps & 4 ~= 0 then fail("RECORDING_IN_PROGRESS", "REAPER is recording.", "Say “stop recording” first.") end
  local t = a.from and position_to_time(a.from, "from") or nil
  if t then reaper.SetEditCurPos(t, true, true) end
  if ps & 1 == 0 or ps & 2 ~= 0 then reaper.Main_OnCommand(ACTIONS.play, 0) end
  return pending(function()
    local now = reaper.GetPlayState()
    if now & 1 ~= 0 and now & 2 == 0 then
      local pos = reaper.GetPlayPosition()
      return verified(true, { playState = transport_name(now), position = pos }, { positionBar = bar_of(pos) }, "Playing from " .. reaper.format_timestr_pos(t or reaper.GetCursorPosition(), "", 2))
    end
  end, 2.0, function()
    return { status = "failed", error = { code = "VERIFICATION_FAILED", message = "REAPER did not start playing.", hint = "Check that the audio device is running (REAPER › Preferences › Audio)." } }
  end)
end

H.pausePlayback = function()
  local ps = reaper.GetPlayState()
  if ps & 2 ~= 0 then return verified(true, { playState = transport_name(ps) }, nil, "Already paused") end
  if ps & 5 == 0 then return verified(true, { playState = "stopped" }, nil, "Already stopped") end
  reaper.Main_OnCommand(ACTIONS.pause, 0)
  return pending(function()
    local now = reaper.GetPlayState()
    if now & 2 ~= 0 then return verified(true, { playState = transport_name(now) }, nil, "Paused") end
  end, 2.0)
end

local function finish_recording_check(snap)
  return function()
    local now = reaper.GetPlayState()
    if now & 4 ~= 0 then return nil end
    local report = recording_report(snap)
    recording.last_report = report
    recording.snapshot = nil
    local ok = #report.newTakes > 0
    local all_files = true
    for _, t in ipairs(report.newTakes) do if t.fileExists ~= true and t.fileExists ~= json.null then all_files = false end end
    local warnings = {}
    if not ok then warnings[#warnings + 1] = "Recording stopped, but no new take was found on the armed tracks." end
    if not all_files then warnings[#warnings + 1] = "A recorded file could not be found on disk." end
    if report.previousTakesPreserved == false then
      warnings[#warnings + 1] = "An earlier take is no longer on its track after this pass. Check the take lanes and REAPER's undo history."
    end
    local nfiles = #report.newTakes -- one entry per recorded file, however many segments it spans
    report.recordedFiles = nfiles
    local msg = string.format("Stopped. %d new take%s kept", nfiles, nfiles == 1 and "" or "s")
    return verified(ok and all_files, report, { playState = transport_name(now) }, msg, warnings)
  end
end

H.stopRecording = function()
  local ps = reaper.GetPlayState()
  if ps & 4 == 0 then
    return verified(true, { wasRecording = false, playState = transport_name(ps) }, nil, "Not recording")
  end
  local snap = recording.snapshot
  -- "Stop (save all recorded media)": never the prompting or deleting variants.
  reaper.Main_OnCommand(ACTIONS.stop_save_recorded, 0)
  return pending(finish_recording_check(snap), 5.0, function()
    return { status = "failed", error = { code = "VERIFICATION_FAILED", message = "REAPER is still recording after the stop command." } }
  end)
end

H.stopPlayback = function()
  local ps = reaper.GetPlayState()
  if ps & 4 ~= 0 then return H.stopRecording() end
  if ps == 0 then return verified(true, { playState = "stopped" }, nil, "Already stopped") end
  reaper.Main_OnCommand(ACTIONS.stop, 0)
  return pending(function()
    if reaper.GetPlayState() == 0 then return verified(true, { playState = "stopped" }, nil, "Stopped") end
  end, 2.0)
end

H.startRecording = function(a)
  local ps = reaper.GetPlayState()
  if ps & 4 ~= 0 then
    return verified(true, { alreadyRecording = true, playState = transport_name(ps) }, nil, "Already recording")
  end
  local armed = armed_tracks()
  if #armed == 0 then
    fail("PRECONDITION_FAILED", "No track is armed for recording.", "Arm a track first, e.g. “arm the guitar track”.")
  end
  if tape_mode() then
    fail("PRECONDITION_FAILED", "REAPER is set to trim existing items behind new recordings (tape mode), which would hide earlier takes.",
      "Say “use new takes” to keep every take, then record again.")
  end
  local warnings = {}
  local names = {}
  for _, tr in ipairs(armed) do
    local rm = math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_RECMODE"))
    if DESTRUCTIVE_RECMODES[rm] then
      fail("PRECONDITION_FAILED", string.format("%s is set to a MIDI replace record mode, which overwrites existing notes.", track_label(tr)),
        "Change the track's record mode to “Record: input” or “MIDI overdub” in REAPER.")
    end
    if rm == 2 then warnings[#warnings + 1] = track_label(tr) .. " is set to “monitoring only” and will not record." end
    if reaper.GetMediaTrackInfo_Value(tr, "I_RECINPUT") < 0 then warnings[#warnings + 1] = track_label(tr) .. " has no input selected." end
    names[#names + 1] = track_label(tr)
  end
  local _, path = reaper.EnumProjects(-1)
  if not path or path == "" then
    warnings[#warnings + 1] = "The project has not been saved yet; recordings go to " .. (reaper.GetProjectPathEx(0) or "REAPER's default folder") .. "."
  end
  local rmode = record_mode()
  if rmode == "time-selection-punch" then
    local ts, te = reaper.GetSet_LoopTimeRange2(0, false, false, 0, 0, false)
    if te <= ts then warnings[#warnings + 1] = "Auto-punch is on but there is no time selection." end
  end
  if a.from then reaper.SetEditCurPos(position_to_time(a.from, "from"), true, false) end
  local count_in = nil
  if a.countInBars ~= nil then
    local bars = arg_number(a.countInBars, "countInBars", 0, 16)
    local ok, st = set_count_in(bars > 0, bars > 0 and bars or nil)
    if not ok then fail("VERIFICATION_FAILED", "Could not set the count-in.") end
    count_in = st
  else
    count_in = count_in_state()
  end
  local start_pos = reaper.GetCursorPosition()
  recording.snapshot = snapshot_armed()
  recording.snapshot.started_at = start_pos
  recording.last_report = nil
  reaper.Main_OnCommand(ACTIONS.record, 0)
  local _, _, bpm = time_sig_at(start_pos)
  local num, den = time_sig_at(start_pos)
  local count_secs = 0
  if count_in ~= json.null and count_in and count_in.enabled then
    count_secs = count_in.bars * num * (4 / den) * 60 / bpm
  end
  return pending(function()
    local now = reaper.GetPlayState()
    if now & 4 ~= 0 then
      -- During a count-in REAPER already reports "recording" while the playhead runs up to the start.
      local counting = reaper.GetPlayPosition() < start_pos - 0.01
      return verified(true, {
        startedAt = start_pos, startBar = bar_of(start_pos), countIn = count_in or json.null, countingIn = counting,
        armedTracks = json.array(names), recordMode = rmode, newTakeMode = new_take_mode(),
      }, { playState = transport_name(now) }, string.format("Recording on %s from %s", table.concat(names, ", "), reaper.format_timestr_pos(start_pos, "", 2)), warnings)
    end
  end, 2.5 + count_secs, function()
    recording.snapshot = nil
    return { status = "failed", error = { code = "VERIFICATION_FAILED", message = "REAPER did not enter record mode.", hint = "Check the audio device and that the armed track has an input." } }
  end)
end

local function find_take(ref)
  arg_table(ref, "take")
  if ref.last then
    local r = recording.last_report
    if not r or #r.newTakes == 0 then fail("TAKE_NOT_FOUND", "There is no recent recording in this REAPER session.") end
    local out = {}
    for _, t in ipairs(r.newTakes) do
      local item = find_item(t.itemId)
      local take = item and reaper.GetTake(item, t.takeIndex)
      if take then out[#out + 1] = { item = item, take = take, info = t } end
    end
    if #out == 0 then fail("TAKE_NOT_FOUND", "The most recent takes are no longer in the project.") end
    return out
  end
  local item = find_item(ref.itemId)
  if not item then fail("TAKE_NOT_FOUND", "That item no longer exists.") end
  local take = ref.takeIndex and reaper.GetTake(item, ref.takeIndex) or reaper.GetActiveTake(item)
  if not take then fail("TAKE_NOT_FOUND", "That take no longer exists.") end
  return { { item = item, take = take } }
end

H.markTake = function(a, ctx)
  local label = arg_string(a.label, "label", 64)
  local takes = find_take(a.take)
  ctx.change()
  local marked = json.array({})
  local all_ok = true
  for _, t in ipairs(takes) do
    local before = reaper.GetNumTakeMarkers(t.take)
    local srcpos = reaper.GetMediaItemTakeInfo_Value(t.take, "D_STARTOFFS")
    reaper.SetTakeMarker(t.take, -1, label, srcpos)
    local ok = reaper.GetNumTakeMarkers(t.take) == before + 1
    all_ok = all_ok and ok
    local _, tname = reaper.GetSetMediaItemTakeInfo_String(t.take, "P_NAME", "", false)
    marked[#marked + 1] = { itemId = item_guid(t.item), takeName = tname or "" }
  end
  reaper.UpdateArrange()
  return verified(all_ok, { marked = marked, label = label }, nil, string.format("Marked %d take%s “%s”", #marked, #marked == 1 and "" or "s", label))
end

H.createTrack = function(a, ctx)
  local name = arg_string(a.name, "name", 256)
  local kind = a.kind or "audio"
  if kind ~= "audio" and kind ~= "midi" and kind ~= "bus" then fail("INVALID_ARGS", "kind must be audio, midi or bus") end
  local n = reaper.CountTracks(0)
  local idx = n
  if a.position ~= nil then idx = math.min(arg_int(a.position, "position", 1, 10000) - 1, n) end
  ctx.change()
  reaper.InsertTrackAtIndex(idx, true)
  local tr = reaper.GetTrack(0, idx)
  if not tr then fail("DAW_ERROR", "REAPER did not create the track.") end
  reaper.GetSetMediaTrackInfo_String(tr, "P_NAME", name, true)
  if kind == "midi" then
    reaper.SetMediaTrackInfo_Value(tr, "I_RECINPUT", 4096 | (63 << 5)) -- all MIDI inputs, all channels
  elseif kind == "bus" then
    reaper.SetMediaTrackInfo_Value(tr, "I_RECINPUT", -1)
  end
  reaper.TrackList_AdjustWindows(false)
  local ok = reaper.CountTracks(0) == n + 1 and track_name(tr) == name
  local st = track_state(tr)
  return verified(ok, { trackId = st.id, index = st.index, name = st.name }, { track = st }, string.format("Created track %d “%s”", st.index, st.name))
end

H.renameTrack = function(a, ctx)
  local tr = find_track(a.track)
  local name = arg_string(a.name, "name", 256)
  local before = track_name(tr)
  ctx.change()
  reaper.GetSetMediaTrackInfo_String(tr, "P_NAME", name, true)
  local after = track_name(tr)
  return verified(after == name, { trackId = track_guid(tr), name = after, previousName = before }, nil, string.format("Renamed “%s” → “%s”", before, after))
end

H.selectTrack = function(a)
  local tr = find_track(a.track)
  reaper.SetOnlyTrackSelected(tr)
  reaper.SetMixerScroll(tr)
  local ok = reaper.GetMediaTrackInfo_Value(tr, "I_SELECTED") ~= 0 and reaper.CountSelectedTracks(0) == 1
  return verified(ok, { trackId = track_guid(tr) }, nil, "Selected " .. track_label(tr))
end

H.setTrackInput = function(a, ctx)
  local tr = find_track(a.track)
  local input = arg_table(a.input, "input")
  local value
  if input.type == "none" then
    value = -1
  elseif input.type == "audio" then
    local ch = arg_int(input.channel, "input.channel", 1, 512)
    local stereo = input.stereo == true
    local n = reaper.GetNumAudioInputs()
    local last = stereo and ch + 1 or ch
    if last > n then
      local names = {}
      for c = 0, math.min(n, 16) - 1 do names[#names + 1] = (c + 1) .. ": " .. (reaper.GetInputChannelName(c) or "") end
      fail("INPUT_OUT_OF_RANGE", string.format("The audio device has %d input%s; input %s does not exist.", n, n == 1 and "" or "s", stereo and (ch .. "/" .. (ch + 1)) or tostring(ch)),
        n > 0 and ("Available: " .. table.concat(names, ", ")) or "Check REAPER › Preferences › Audio › Device.")
    end
    value = (ch - 1) | (stereo and 1024 or 0)
  elseif input.type == "midi" then
    local dev = input.device == nil and 63 or (input.device == "all" and 63 or arg_int(input.device, "input.device", 0, 61))
    local chan = opt(input.channel, arg_int, "input.channel", 0, 16) or 0
    value = 4096 | (dev << 5) | chan
  else
    fail("INVALID_ARGS", "input.type must be none, audio or midi")
  end
  ctx.change()
  reaper.SetMediaTrackInfo_Value(tr, "I_RECINPUT", value)
  local now = math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_RECINPUT"))
  local desc = describe_input(now)
  return verified(now == value, { trackId = track_guid(tr), input = desc }, nil, track_label(tr) .. " input: " .. desc.label)
end

H.armTrack = function(a, ctx)
  local tr = find_track(a.track)
  local armed = arg_bool(a.armed, "armed")
  ctx.change()
  reaper.SetMediaTrackInfo_Value(tr, "I_RECARM", armed and 1 or 0)
  local now = reaper.GetMediaTrackInfo_Value(tr, "I_RECARM") ~= 0
  local warnings = {}
  if armed and reaper.GetMediaTrackInfo_Value(tr, "I_RECINPUT") < 0 then warnings[1] = track_label(tr) .. " has no input selected." end
  return verified(now == armed, { trackId = track_guid(tr), armed = now }, nil, (now and "Armed " or "Disarmed ") .. track_label(tr), warnings)
end

H.setMonitoring = function(a, ctx)
  local tr = find_track(a.track)
  local modes = { off = 0, on = 1, auto = 2 }
  local v = modes[a.mode]
  if not v then fail("INVALID_ARGS", "mode must be off, on or auto") end
  ctx.change()
  reaper.SetMediaTrackInfo_Value(tr, "I_RECMON", v)
  local now = math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_RECMON"))
  return verified(now == v, { trackId = track_guid(tr), monitoring = MONITOR[now] }, nil, track_label(tr) .. " monitoring " .. (MONITOR[now] or "?"))
end

H.setTrackChannelCount = function(a, ctx)
  local tr = find_track(a.track)
  local ch = arg_int(a.channels, "channels", 2, 128)
  if ch % 2 ~= 0 then fail("INVALID_ARGS", "channels must be even") end
  ctx.change()
  reaper.SetMediaTrackInfo_Value(tr, "I_NCHAN", ch)
  local now = math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_NCHAN"))
  return verified(now == ch, { trackId = track_guid(tr), channels = now }, nil, string.format("%s: %d channels", track_label(tr), now))
end

H.setTrackVolume = function(a, ctx)
  local tr = find_track(a.track)
  local before_gain = reaper.GetMediaTrackInfo_Value(tr, "D_VOL")
  local before_db = gain_to_db(before_gain) or -150
  local target
  if a.db ~= nil and a.changeDb == nil then
    target = arg_number(a.db, "db", -150, 12)
  elseif a.changeDb ~= nil and a.db == nil then
    target = math.min(12, math.max(-150, before_db + arg_number(a.changeDb, "changeDb", -48, 24)))
  else
    fail("INVALID_ARGS", "Give exactly one of db or changeDb")
  end
  ctx.change()
  local g = db_to_gain(target)
  reaper.SetMediaTrackInfo_Value(tr, "D_VOL", g)
  local now = reaper.GetMediaTrackInfo_Value(tr, "D_VOL")
  local after_db = gain_to_db(now) or -150
  local warnings = {}
  if a.changeDb and (target == 12 or target == -150) then warnings[1] = "Reached the fader limit." end
  return verified(math.abs(now - g) <= 1e-9 + g * 1e-6, { trackId = track_guid(tr), volumeDb = after_db, previousDb = before_db }, nil,
    string.format("%s volume %.1f dB → %.1f dB", track_label(tr), before_db, after_db), warnings)
end

H.setTrackPan = function(a, ctx)
  local tr = find_track(a.track)
  local pan = arg_number(a.pan, "pan", -1, 1)
  ctx.change()
  reaper.SetMediaTrackInfo_Value(tr, "D_PAN", pan)
  local now = reaper.GetMediaTrackInfo_Value(tr, "D_PAN")
  local desc = math.abs(now) < 0.005 and "center" or string.format("%d%% %s", math.floor(math.abs(now) * 100 + 0.5), now < 0 and "left" or "right")
  return verified(math.abs(now - pan) < 1e-6, { trackId = track_guid(tr), pan = now }, nil, track_label(tr) .. " pan " .. desc)
end

H.setTrackMute = function(a, ctx)
  local tr = find_track(a.track)
  local m = arg_bool(a.muted, "muted")
  ctx.change()
  reaper.SetMediaTrackInfo_Value(tr, "B_MUTE", m and 1 or 0)
  local now = reaper.GetMediaTrackInfo_Value(tr, "B_MUTE") ~= 0
  return verified(now == m, { trackId = track_guid(tr), muted = now }, nil, (now and "Muted " or "Unmuted ") .. track_label(tr))
end

H.setTrackSolo = function(a, ctx)
  local tr = find_track(a.track)
  local s = arg_bool(a.soloed, "soloed")
  ctx.change()
  reaper.SetMediaTrackInfo_Value(tr, "I_SOLO", s and 2 or 0) -- 2 = solo in place
  local now = reaper.GetMediaTrackInfo_Value(tr, "I_SOLO") ~= 0
  return verified(now == s, { trackId = track_guid(tr), soloed = now }, nil, (now and "Soloed " or "Unsoloed ") .. track_label(tr))
end

H.createMidiClip = function(a, ctx)
  local tr = find_track(a.track)
  local s = position_to_time(a.start, "start")
  local bars = arg_number(a.lengthBars, "lengthBars", 0.0001, 1024)
  local num, den = time_sig_at(s)
  local s_qn = reaper.TimeMap2_timeToQN(0, s)
  local e_qn = s_qn + bars * num * 4 / den
  local e = reaper.TimeMap2_QNToTime(0, e_qn)
  for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
    local it = reaper.GetTrackMediaItem(tr, j)
    local ip = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
    local il = reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
    if ip < e - 1e-9 and ip + il > s + 1e-9 then
      fail("PRECONDITION_FAILED", string.format("%s already has material between %s and %s.", track_label(tr), reaper.format_timestr_pos(s, "", 2), reaper.format_timestr_pos(e, "", 2)),
        "Use another position or a new track; Assist does not write over existing items.")
    end
  end
  ctx.change()
  local item = reaper.CreateNewMIDIItemInProj(tr, s_qn, e_qn, true)
  if not item then fail("DAW_ERROR", "REAPER did not create the MIDI item.") end
  local take = reaper.GetActiveTake(item)
  if a.name and take then reaper.GetSetMediaItemTakeInfo_String(take, "P_NAME", arg_string(a.name, "name", 256), true) end
  reaper.UpdateArrange()
  local pos = reaper.GetMediaItemInfo_Value(item, "D_POSITION")
  local len = reaper.GetMediaItemInfo_Value(item, "D_LENGTH")
  local ok = take ~= nil and reaper.TakeIsMIDI(take) and math.abs(pos - s) < 1e-6 and math.abs(pos + len - e) < 1e-4
  return verified(ok, { clipId = item_guid(item), trackId = track_guid(tr), start = pos, length = len, startBar = bar_of(pos) }, nil,
    string.format("MIDI clip on %s, %s – %s", track_label(tr), reaper.format_timestr_pos(pos, "", 2), reaper.format_timestr_pos(pos + len, "", 2)))
end

H.insertMidiNotes = function(a, ctx)
  local item, take = find_clip(a.clip)
  local notes = a.notes
  if type(notes) ~= "table" or #notes == 0 or #notes > 20000 then fail("INVALID_ARGS", "notes must be a list of 1 to 20000 notes") end
  local item_pos = reaper.GetMediaItemInfo_Value(item, "D_POSITION")
  local item_len = reaper.GetMediaItemInfo_Value(item, "D_LENGTH")
  local item_qn = reaper.TimeMap2_timeToQN(0, item_pos)
  local end_qn = reaper.TimeMap2_timeToQN(0, item_pos + item_len)
  local clip_qn = end_qn - item_qn
  for i, n in ipairs(notes) do
    arg_table(n, "note " .. i)
    arg_number(n.start, "note.start", 0, 100000)
    arg_number(n.length, "note.length", 1e-6, 100000)
    arg_int(n.pitch, "note.pitch", 0, 127)
    arg_int(n.velocity, "note.velocity", 1, 127)
    if n.channel ~= nil then arg_int(n.channel, "note.channel", 0, 15) end
    if n.start + n.length > clip_qn + 1e-6 then
      fail("INVALID_ARGS", string.format("Note %d ends after the clip (at beat %.3f of %.3f).", i, n.start + n.length, clip_qn))
    end
  end
  local _, before = reaper.MIDI_CountEvts(take)
  ctx.change()
  for _, n in ipairs(notes) do
    local s = reaper.MIDI_GetPPQPosFromProjQN(take, item_qn + n.start)
    local e = reaper.MIDI_GetPPQPosFromProjQN(take, item_qn + n.start + n.length)
    reaper.MIDI_InsertNote(take, false, false, s, e, n.channel or 0, math.floor(n.pitch), math.floor(n.velocity), true)
  end
  reaper.MIDI_Sort(take)
  local _, after = reaper.MIDI_CountEvts(take)
  local inserted = after - before
  return verified(inserted == #notes, { clipId = item_guid(item), inserted = inserted, totalNotes = after }, nil,
    string.format("Inserted %d note%s", inserted, inserted == 1 and "" or "s"))
end

H.quantizeMidiClip = function(a, ctx)
  local item, take = find_clip(a.clip)
  local grid = arg_number(a.gridBeats, "gridBeats", 1 / 64, 4)
  local strength = opt(a.strength, arg_number, "strength", 0, 1) or 1
  local item_qn = reaper.TimeMap2_timeToQN(0, reaper.GetMediaItemInfo_Value(item, "D_POSITION"))
  local _, count = reaper.MIDI_CountEvts(take)
  ctx.change()
  local moved = 0
  for i = 0, count - 1 do
    local _, _, _, sppq, eppq = reaper.MIDI_GetNote(take, i)
    local sqn = reaper.MIDI_GetProjQNFromPPQPos(take, sppq) - item_qn
    local target = math.floor(sqn / grid + 0.5) * grid
    local delta = (target - sqn) * strength
    if math.abs(delta) > 1e-9 then
      local eqn = reaper.MIDI_GetProjQNFromPPQPos(take, eppq) - item_qn
      local ns = reaper.MIDI_GetPPQPosFromProjQN(take, item_qn + sqn + delta)
      local ne = reaper.MIDI_GetPPQPosFromProjQN(take, item_qn + eqn + delta)
      reaper.MIDI_SetNote(take, i, nil, nil, ns, ne, nil, nil, nil, true)
      moved = moved + 1
    end
  end
  reaper.MIDI_Sort(take)
  local ok = true
  if strength == 1 then
    local _, c2 = reaper.MIDI_CountEvts(take)
    for i = 0, c2 - 1 do
      local _, _, _, sppq = reaper.MIDI_GetNote(take, i)
      local sqn = reaper.MIDI_GetProjQNFromPPQPos(take, sppq) - item_qn
      local off = math.abs(sqn / grid - math.floor(sqn / grid + 0.5))
      if off > 0.01 then ok = false end
    end
  end
  return verified(ok, { clipId = item_guid(item), moved = moved, notes = count }, nil, string.format("Quantized %d of %d notes", moved, count))
end

H.addFx = function(a, ctx)
  local tr = find_track(a.track)
  local fx = match_installed_fx(arg_string(a.fx, "fx", 512))
  local before = reaper.TrackFX_GetCount(tr)
  local pos = opt(a.position, arg_int, "position", 0, 1023)
  ctx.change()
  local idx = reaper.TrackFX_AddByName(tr, fx.name, false, pos and (-1000 - pos) or -1)
  if idx < 0 then fail("FX_NOT_FOUND", "REAPER could not load " .. fx.name .. ".") end
  local after = reaper.TrackFX_GetCount(tr)
  local _, loaded = reaper.TrackFX_GetFXName(tr, idx)
  local warnings = {}
  if fx.instrument and idx > 0 then warnings[1] = "The instrument is not first in the chain; effects before it receive MIDI, not audio." end
  return verified(after == before + 1, { trackId = track_guid(tr), fxIndex = idx, fxName = loaded, instrument = fx.instrument }, nil,
    string.format("Added %s to %s (slot %d)", loaded, track_label(tr), idx + 1), warnings)
end

H.setFxParameter = function(a, ctx)
  local tr = find_track(a.track)
  local fx = resolve_fx(tr, a.fx)
  local p = resolve_param(tr, fx, a.param)
  local value = arg_table(a.value, "value")
  local _, pname = reaper.TrackFX_GetParamName(tr, fx, p)
  local before = formatted_param(tr, fx, p)
  local before_norm = reaper.TrackFX_GetParamNormalized(tr, fx, p)
  ctx.change()
  local ok, warnings = true, {}
  if value.normalized ~= nil then
    local v = arg_number(value.normalized, "value.normalized", 0, 1)
    reaper.TrackFX_SetParamNormalized(tr, fx, p, v)
    ok = math.abs(reaper.TrackFX_GetParamNormalized(tr, fx, p) - v) < 1e-4
  elseif value.option ~= nil then
    set_param_option(tr, fx, p, arg_string(value.option, "value.option", 128))
    ok = lower(formatted_param(tr, fx, p)):find(lower(trim(value.option)), 1, true) ~= nil
  elseif value.display ~= nil then
    local target = arg_number(value.display, "value.display", -1e6, 1e6)
    local clamped = set_param_display(tr, fx, p, target)
    local got = parse_display_number(formatted_param(tr, fx, p))
    if clamped then warnings[#warnings + 1] = "The target is outside the parameter's range; set to the nearest limit." end
    ok = got ~= nil and (clamped or math.abs(got - target) <= math.max(0.05 * math.abs(target), 0.11))
  else
    reaper.TrackFX_SetParamNormalized(tr, fx, p, before_norm)
    fail("INVALID_ARGS", "value must give normalized, display or option")
  end
  local after = formatted_param(tr, fx, p)
  return verified(ok, { trackId = track_guid(tr), fxIndex = fx, param = pname, paramIndex = p, display = after, previousDisplay = before }, nil,
    string.format("%s: %s %s → %s", track_label(tr), pname, before, after), warnings)
end

H.setFxEnabled = function(a, ctx)
  local tr = find_track(a.track)
  local fx = resolve_fx(tr, a.fx)
  local en = arg_bool(a.enabled, "enabled")
  ctx.change()
  reaper.TrackFX_SetEnabled(tr, fx, en)
  local now = reaper.TrackFX_GetEnabled(tr, fx)
  local _, nm = reaper.TrackFX_GetFXName(tr, fx)
  return verified(now == en, { trackId = track_guid(tr), fxIndex = fx, enabled = now }, nil, (now and "Enabled " or "Bypassed ") .. nm)
end

local SEND_MODES = { ["post-fader"] = 0, ["pre-fx"] = 1, ["pre-fader"] = 3 }

local function find_send(src, dst, src_ch0, dst_ch0)
  for s = 0, reaper.GetTrackNumSends(src, 0) - 1 do
    local d = reaper.GetTrackSendInfo_Value(src, 0, s, "P_DESTTRACK")
    if d == dst then
      local sc = math.floor(reaper.GetTrackSendInfo_Value(src, 0, s, "I_SRCCHAN"))
      local dc = math.floor(reaper.GetTrackSendInfo_Value(src, 0, s, "I_DSTCHAN"))
      if (sc & 1023) == src_ch0 and (sc >> 10) == 0 and (dc & 1023) == dst_ch0 then return s end
    end
  end
  return nil
end

local function make_send(src, dst, src_ch0, dst_ch0, db, mode)
  local existing = find_send(src, dst, src_ch0, dst_ch0)
  local idx = existing or reaper.CreateTrackSend(src, dst)
  if idx < 0 then fail("DAW_ERROR", "REAPER could not create the send.") end
  reaper.SetTrackSendInfo_Value(src, 0, idx, "I_SRCCHAN", src_ch0)
  reaper.SetTrackSendInfo_Value(src, 0, idx, "I_DSTCHAN", dst_ch0)
  reaper.SetTrackSendInfo_Value(src, 0, idx, "I_SENDMODE", mode)
  reaper.SetTrackSendInfo_Value(src, 0, idx, "D_VOL", db_to_gain(db))
  local ok = reaper.GetTrackSendInfo_Value(src, 0, idx, "P_DESTTRACK") == dst
    and math.floor(reaper.GetTrackSendInfo_Value(src, 0, idx, "I_SRCCHAN")) == src_ch0
    and math.floor(reaper.GetTrackSendInfo_Value(src, 0, idx, "I_DSTCHAN")) == dst_ch0
    and math.floor(reaper.GetTrackSendInfo_Value(src, 0, idx, "I_SENDMODE")) == mode
  return idx, ok, existing ~= nil
end

H.createSend = function(a, ctx)
  local src = find_track(a.from, "from")
  local dst = find_track(a.to, "to")
  if src == dst then fail("INVALID_ARGS", "A track cannot send to itself.") end
  local sc = (opt(a.sourceChannel, arg_int, "sourceChannel", 1, 127) or 1) - 1
  local dc = (opt(a.destChannel, arg_int, "destChannel", 1, 127) or 1) - 1
  local db = opt(a.volumeDb, arg_number, "volumeDb", -150, 12) or 0
  local mode = SEND_MODES[a.mode or "post-fader"]
  if mode == nil then fail("INVALID_ARGS", "mode must be post-fader, pre-fader or pre-fx") end
  local dst_ch = math.floor(reaper.GetMediaTrackInfo_Value(dst, "I_NCHAN"))
  if dc + 2 > dst_ch then
    fail("PRECONDITION_FAILED", string.format("%s has %d channels; a send to channels %d/%d needs %d.", track_label(dst), dst_ch, dc + 1, dc + 2, dc + 2),
      "Increase the destination track's channel count first.")
  end
  ctx.change()
  local idx, ok, existed = make_send(src, dst, sc, dc, db, mode)
  return verified(ok, { fromId = track_guid(src), toId = track_guid(dst), sendIndex = idx, existing = existed }, nil,
    string.format("%s %s → %s (ch %d/%d → %d/%d, %.1f dB)", existed and "Updated send" or "Send", track_label(src), track_label(dst), sc + 1, sc + 2, dc + 1, dc + 2, db))
end

local function find_compressor_fx()
  for _, fx in ipairs(installed_fx()) do
    if lower(fx.name):find("reacomp", 1, true) and not lower(fx.name):find("reaxcomp", 1, true) then return fx end
  end
  return nil
end

H.configureSidechain = function(a, ctx)
  local src = find_track(a.source, "source")
  local dst = find_track(a.target, "target")
  if src == dst then fail("INVALID_ARGS", "The trigger and the ducked track must be different tracks.") end
  local comp = find_compressor_fx()
  if not comp then fail("UNSUPPORTED", "ReaComp is not available, and Assist only configures sidechains with compressors it can verify.") end
  local c = a.compressor or {}
  local send_db = opt(a.sendDb, arg_number, "sendDb", -60, 12) or 0
  ctx.change()
  local steps = json.array({})
  -- 1. Room for the key signal on channels 3/4.
  if reaper.GetMediaTrackInfo_Value(dst, "I_NCHAN") < 4 then reaper.SetMediaTrackInfo_Value(dst, "I_NCHAN", 4) end
  local nch = math.floor(reaper.GetMediaTrackInfo_Value(dst, "I_NCHAN"))
  steps[#steps + 1] = { step = "channels", ok = nch >= 4, detail = track_label(dst) .. " has " .. nch .. " channels" }
  -- 2. Send source 1/2 -> target 3/4, post-fader.
  local sidx, sok, existed = make_send(src, dst, 0, 2, send_db, 0)
  steps[#steps + 1] = { step = "send", ok = sok, detail = string.format("%s 1/2 → %s 3/4%s", track_label(src), track_label(dst), existed and " (existing send)" or "") }
  -- 3. Compressor (reuse a ReaComp already on the track).
  local fx = nil
  for f = 0, reaper.TrackFX_GetCount(dst) - 1 do
    local _, nm = reaper.TrackFX_GetFXName(dst, f)
    if lower(nm):find("reacomp", 1, true) and not lower(nm):find("reaxcomp", 1, true) then fx = f; break end
  end
  local added = false
  if not fx then
    fx = reaper.TrackFX_AddByName(dst, comp.name, false, -1)
    added = true
  end
  steps[#steps + 1] = { step = "compressor", ok = fx ~= nil and fx >= 0, detail = (added and "Added " or "Using existing ") .. comp.name }
  if not fx or fx < 0 then fail("DAW_ERROR", "Could not insert the compressor.", nil, { steps = steps }) end
  -- 4. Detector listens to the auxiliary input. The parameter is found by name and the value by
  --    the plug-in's own displayed text, never by fixed index:
  --    * a parameter named "Detector ..." with an option containing "aux", or
  --    * ReaComp's "SignIn" parameter, whose displayed values are channel codes. Measured on
  --      REAPER 7.82 with a silent audio test (scripts/probes/reacomp_detector_probe.lua):
  --      "0" = main input (always compressed by its own signal), "2" = auxiliary input
  --      L+R = track channels 3/4 (no reduction while the key send is muted, ~30 dB of ducking
  --      when it plays). tests/integration repeats this measurement through the bridge.
  local det_ok, det_value, det_name = false, "", ""
  local detector, mode = nil, nil
  for p = 0, reaper.TrackFX_GetNumParams(dst, fx) - 1 do
    local _, pn = reaper.TrackFX_GetParamName(dst, fx, p)
    local l = lower(pn)
    if l:find("detector", 1, true) then detector, mode, det_name = p, "named", pn; break end
    if l == "signin" and not detector then detector, mode, det_name = p, "signin", pn end
  end
  if detector then
    local okset
    if mode == "named" then
      okset = pcall(set_param_option, dst, fx, detector, "aux")
    else
      okset = pcall(set_param_display, dst, fx, detector, 2) -- numeric code: search the displayed value, then check it exactly
    end
    det_value = formatted_param(dst, fx, detector)
    if mode == "named" then
      det_ok = okset and lower(det_value):find("aux", 1, true) ~= nil
    else
      det_ok = okset and trim(det_value) == "2"
      det_value = "auxiliary input 3/4 (" .. det_name .. " " .. det_value .. ")"
    end
  end
  steps[#steps + 1] = { step = "detector", ok = det_ok, detail = detector and ("Detector input: " .. det_value) or "No detector parameter found" }
  -- 5. Optional settings.
  local settings = { { "thresholdDb", "thresh" }, { "ratio", "ratio" }, { "attackMs", "attack" }, { "releaseMs", "release" } }
  for _, s in ipairs(settings) do
    local v = c[s[1]]
    if v ~= nil then
      arg_number(v, s[1], -1e6, 1e6)
      local okp, p = pcall(resolve_param, dst, fx, { name = s[2] })
      if okp then
        set_param_display(dst, fx, p, v)
        local shown = formatted_param(dst, fx, p)
        local got = parse_display_number(shown)
        steps[#steps + 1] = { step = s[1], ok = got ~= nil and math.abs(got - v) <= math.max(0.05 * math.abs(v), 0.11), detail = s[2] .. " " .. shown }
      else
        steps[#steps + 1] = { step = s[1], ok = false, detail = "No " .. s[2] .. " parameter" }
      end
    end
  end
  -- 6. The compressor's inputs 3/4 read track channels 3/4.
  local _, in_pins = reaper.TrackFX_GetIOSize(dst, fx)
  local pins_ok = false
  if in_pins and in_pins >= 4 then
    local m3 = reaper.TrackFX_GetPinMappings(dst, fx, 0, 2)
    local m4 = reaper.TrackFX_GetPinMappings(dst, fx, 0, 3)
    pins_ok = (m3 & 4) ~= 0 and (m4 & 8) ~= 0
  end
  steps[#steps + 1] = { step = "pins", ok = pins_ok, detail = string.format("Compressor has %s input pins; aux pins map to track channels 3/4: %s", tostring(in_pins), pins_ok and "yes" or "no") }
  local all = true
  for _, s in ipairs(steps) do all = all and s.ok end
  if not all then
    fail("VERIFICATION_FAILED", "The sidechain could not be verified, so the change was rolled back.", nil, { steps = steps })
  end
  return verified(true, { sourceId = track_guid(src), targetId = track_guid(dst), fxIndex = fx, sendIndex = sidx, steps = steps }, nil,
    string.format("Sidechain: %s ducks %s (ReaComp, detector %s)", track_label(src), track_label(dst), det_value))
end

H.undo = function(a)
  local expect = arg_string(a.expectLabel, "expectLabel", 512)
  local top = reaper.Undo_CanUndo2(0)
  if top ~= expect then
    fail("UNDO_MISMATCH", string.format("REAPER's latest undo step is “%s”, not this Assist change.", tostring(top or "nothing")),
      "Assist only undoes its own most recent change so it never undoes your edits. Use REAPER's undo history instead.")
  end
  local r = reaper.Undo_DoUndo2(0)
  local redo = reaper.Undo_CanRedo2(0)
  return verified(r ~= 0 and redo == expect, { undone = expect }, nil, "Undid “" .. expect .. "”")
end

-- The 0.4 section has its own scope: Lua allows at most 200 locals in the main chunk.
do
------------------------------------------------------------------------------
-- 0.4: places (sections, bars, selection), item, MIDI and automation editing,
-- offline analysis and recording information
------------------------------------------------------------------------------
-- Ruler position as text: "9.1" on a beat, "9.2.50" between beats.
local function clock_label(t) return (reaper.format_timestr_pos(t, "", 2):gsub("%.00$", "")) end

local function qn(t) return reaper.TimeMap2_timeToQN(0, t) end
local function tm(q) return reaper.TimeMap2_QNToTime(0, q) end
local function qn_per_bar_at(t)
  local num, den = time_sig_at(t)
  return num * 4 / den
end

-- "bars 9–16" when both edges sit on downbeats, otherwise ruler positions.
local function bars_text(s, e)
  local a, b = bar_of(s), bar_of(e)
  if a ~= json.null and b ~= json.null and math.abs(a.beat - 1) < 0.01 and math.abs(b.beat - 1) < 0.01 then
    local last = b.bar - 1
    if last <= a.bar then return "bar " .. a.bar end
    return string.format("bars %d–%d", a.bar, last)
  end
  return clock_label(s) .. "–" .. clock_label(e)
end

-- A stretch of time in seconds with ruler labels; an end at "17.1" means the span covers bars up to 16.
local function span_json(s, e)
  return { start = round(s, 6), ["end"] = round(e, 6), startBar = clock_label(s), endBar = clock_label(e), label = bars_text(s, e) }
end

local function merge(a, b)
  for k, v in pairs(b) do a[k] = v end
  return a
end

-- Song sections: regions as they are; a marker runs to the next marker (or the project end).
local function section_list()
  local regions, markers = {}, {}
  local _, nm, nr = reaper.CountProjectMarkers(0)
  for i = 0, nm + nr - 1 do
    local ok, isrgn, mpos, rend, name, idx = reaper.EnumProjectMarkers3(0, i)
    if ok and ok > 0 then
      if isrgn then
        regions[#regions + 1] = { name = name or "", kind = "region", start = mpos, ["end"] = rend, id = idx }
      else
        markers[#markers + 1] = { name = name or "", kind = "marker", start = mpos, id = idx }
      end
    end
  end
  table.sort(markers, function(x, y) return x.start < y.start end)
  local stop = reaper.GetProjectLength(0)
  for i, m in ipairs(markers) do
    local nxt = markers[i + 1]
    m["end"] = nxt and nxt.start or math.max(stop, m.start)
  end
  local all = {}
  for _, r in ipairs(regions) do all[#all + 1] = r end
  for _, m in ipairs(markers) do all[#all + 1] = m end
  table.sort(all, function(x, y)
    if x.start ~= y.start then return x.start < y.start end
    return x.kind == "region" and y.kind ~= "region"
  end)
  return all
end

local function sections_json()
  local out = json.array({})
  for _, s in ipairs(section_list()) do
    if s.name ~= "" then out[#out + 1] = merge(span_json(s.start, s["end"]), { name = s.name, kind = s.kind }) end
  end
  return out
end

local function resolve_section(r, what)
  local name = arg_string(r.section, what .. ".section", 256)
  local want = lower(trim(name))
  local all = section_list()
  local exact, partial = {}, {}
  for _, s in ipairs(all) do
    local n = lower(trim(s.name))
    if n ~= "" and s["end"] > s.start then
      if n == want then exact[#exact + 1] = s elseif n:find(want, 1, true) then partial[#partial + 1] = s end
    end
  end
  local hits = (#exact > 0) and exact or partial
  if #hits == 0 then
    local names = {}
    for _, s in ipairs(all) do if s.name ~= "" then names[#names + 1] = string.format("%s (%s)", s.name, bars_text(s.start, s["end"])) end end
    fail("SECTION_NOT_FOUND", string.format("There is no region or marker called “%s”.", name),
      #names > 0 and ("Sections: " .. table.concat(names, ", ") .. ".") or "The project has no named regions or markers; give bars instead.")
  end
  if r.occurrence ~= nil then
    local n = arg_int(r.occurrence, what .. ".occurrence", 1, 999)
    if not hits[n] then fail("SECTION_NOT_FOUND", string.format("“%s” appears only %d time%s.", name, #hits, #hits == 1 and "" or "s")) end
    return hits[n]
  end
  if #hits > 1 then
    local same = true
    for i = 2, #hits do
      if math.abs(hits[i].start - hits[1].start) > 1e-6 or math.abs(hits[i]["end"] - hits[1]["end"]) > 1e-6 then same = false end
    end
    if not same then
      local opts = {}
      for i, s in ipairs(hits) do opts[#opts + 1] = string.format("%d) %s, %s", i, s.name, bars_text(s.start, s["end"])) end
      fail("AMBIGUOUS_TARGET", string.format("“%s” matches %d sections: %s.", name, #hits, table.concat(opts, "; ")),
        "Ask the user which one, then pass occurrence (1 = first) or bars.")
    end
  end
  return hits[1]
end

local function resolve_range(r, what)
  what = what or "range"
  arg_table(r, what)
  local s, e
  if r.section ~= nil then
    local sec = resolve_section(r, what)
    s, e = sec.start, sec["end"]
  elseif r.fromBar ~= nil then
    local a = arg_int(r.fromBar, what .. ".fromBar", 1, 100000)
    local b = arg_int(r.toBar, what .. ".toBar", 1, 100000)
    if b < a then fail("INVALID_ARGS", "toBar must not be before fromBar") end
    s = position_to_time({ bar = a }, what .. ".fromBar")
    e = position_to_time({ bar = b + 1 }, what .. ".toBar")
  elseif r.timeSelection ~= nil then
    s, e = reaper.GetSet_LoopTimeRange2(0, false, false, 0, 0, false)
    if e <= s then fail("NOTHING_SELECTED", "There is no time selection in REAPER.", "Select a time range first, or give bars or a section.") end
  elseif r.start ~= nil then
    s = position_to_time(r.start, what .. ".start")
    e = position_to_time(r["end"], what .. ".end")
  else
    fail("INVALID_ARGS", what .. " must give section, fromBar/toBar, timeSelection or start/end")
  end
  if e <= s then fail("INVALID_ARGS", "The range must end after it starts.") end
  return s, e
end
K.resolve_range = resolve_range

local function place_to_time(p, what)
  arg_table(p, what)
  if p.section ~= nil then return resolve_section(p, what).start end
  return position_to_time(p, what)
end

------------------------------------------------------------------------------
-- Items
------------------------------------------------------------------------------
local function item_bounds(it)
  local p = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
  return p, p + reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
end

local function take_kind(take)
  if not take then return "empty" end
  return reaper.TakeIsMIDI(take) and "midi" or "audio"
end

local function take_name(take)
  if not take then return "" end
  local _, n = reaper.GetSetMediaItemTakeInfo_String(take, "P_NAME", "", false)
  return n or ""
end

local function item_brief(it)
  local tr = reaper.GetMediaItem_Track(it)
  local take = reaper.GetActiveTake(it)
  local a, b = item_bounds(it)
  return merge(span_json(a, b), {
    id = item_guid(it), trackId = track_guid(tr), track = track_label(tr), name = take_name(take), kind = take_kind(take),
  })
end

local function items_on(tr, s, e)
  local out = {}
  for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
    local it = reaper.GetTrackMediaItem(tr, j)
    local a, b = item_bounds(it)
    if not s or (a < e - 1e-9 and b > s + 1e-9) then out[#out + 1] = it end
  end
  return out
end

-- Items named by an ItemsRef; also returns the ref's range when it has one.
local function resolve_items(ref, what)
  what = what or "items"
  arg_table(ref, what)
  local items, s, e = {}, nil, nil
  if ref.ids ~= nil then
    arg_table(ref.ids, what .. ".ids")
    local missing = 0
    for _, id in ipairs(ref.ids) do
      local it = find_item(id)
      if it then items[#items + 1] = it else missing = missing + 1 end
    end
    if missing > 0 then
      fail("ITEM_NOT_FOUND", string.format("%d of the items no longer exist%s.", missing, missing == #ref.ids and "" or " (the rest were not touched)"),
        "Read the project again (getSelection or listTrackItems) for fresh ids.")
    end
  elseif ref.selected ~= nil then
    for i = 0, reaper.CountSelectedMediaItems(0) - 1 do items[#items + 1] = reaper.GetSelectedMediaItem(0, i) end
    if #items == 0 then fail("NOTHING_SELECTED", "No items are selected in REAPER.", "Select the items, or name a track and bars.") end
  elseif ref.track ~= nil then
    local tr = find_track(ref.track, what .. ".track")
    if ref.range ~= nil then s, e = resolve_range(ref.range, what .. ".range") end
    items = items_on(tr, s, e)
    if #items == 0 then
      fail("ITEM_NOT_FOUND", string.format("%s has no items%s.", track_label(tr), s and (" in " .. bars_text(s, e)) or ""), "Check the track and the bars.")
    end
  else
    fail("INVALID_ARGS", what .. " must give ids, selected or track")
  end
  if #items > 2000 then fail("INVALID_ARGS", "That is more than 2000 items; narrow it down with a range.") end
  return items, s, e
end

local function lane_of(it)
  local tr = reaper.GetMediaItem_Track(it)
  if reaper.GetMediaTrackInfo_Value(tr, "I_FREEMODE") == 2 then return math.floor(reaper.GetMediaItemInfo_Value(it, "I_FIXEDLANE")) end
  return nil
end

-- First item on tr (same lane, outside `except`) overlapping s..e.
local function overlapping_on(tr, s, e, except, lane)
  for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
    local it = reaper.GetTrackMediaItem(tr, j)
    if not (except and except[it]) and (lane == nil or lane_of(it) == lane) then
      local a, b = item_bounds(it)
      if a < e - 1e-6 and b > s + 1e-6 then return it end
    end
  end
  return nil
end

local function selected_items()
  local out = {}
  for i = 0, reaper.CountSelectedMediaItems(0) - 1 do out[#out + 1] = reaper.GetSelectedMediaItem(0, i) end
  return out
end
local function selected_tracks()
  local out = {}
  for i = 0, reaper.CountSelectedTracks(0) - 1 do out[#out + 1] = reaper.GetSelectedTrack(0, i) end
  return out
end
local function select_only_items(list)
  reaper.SelectAllMediaItems(0, false)
  for _, it in ipairs(list) do if reaper.ValidatePtr2(0, it, "MediaItem*") then reaper.SetMediaItemSelected(it, true) end end
end
local function select_only_tracks(list)
  for i = 0, reaper.CountTracks(0) - 1 do reaper.SetMediaTrackInfo_Value(reaper.GetTrack(0, i), "I_SELECTED", 0) end
  for _, tr in ipairs(list) do if reaper.ValidatePtr2(0, tr, "MediaTrack*") then reaper.SetMediaTrackInfo_Value(tr, "I_SELECTED", 1) end end
end

-- Run fn with a temporary selection, then put the user's track, item and time selection back.
local function with_selection(fn)
  local tracks, items = selected_tracks(), selected_items()
  local ts, te = reaper.GetSet_LoopTimeRange2(0, false, false, 0, 0, false)
  local ok, r1, r2 = pcall(fn)
  select_only_tracks(tracks)
  select_only_items(items)
  reaper.GetSet_LoopTimeRange2(0, true, false, ts, te, false)
  if not ok then error(r1, 0) end
  return r1, r2
end

local function require_stopped(what)
  if reaper.GetPlayState() ~= 0 then
    fail("PRECONDITION_FAILED", "REAPER is playing.", "Stop playback first: " .. what .. " renders offline.")
  end
end

local function clone_item(src, dst_track)
  local ok, chunk = reaper.GetItemStateChunk(src, "", false)
  if not ok then return nil end
  -- Fresh GUIDs for the item, its takes and its MIDI pool, so the copy is independent.
  chunk = chunk:gsub("{%x%x%x%x%x%x%x%x%-%x%x%x%x%-%x%x%x%x%-%x%x%x%x%-%x%x%x%x%x%x%x%x%x%x%x%x}", function() return reaper.genGuid("") end)
  local it = reaper.AddMediaItemToTrack(dst_track)
  if not reaper.SetItemStateChunk(it, chunk, false) then reaper.DeleteTrackMediaItem(dst_track, it); return nil end
  return it
end

local function item_detail(it)
  local d = item_brief(it)
  local take = reaper.GetActiveTake(it)
  d.position = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
  d.length = reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
  d.muted = reaper.GetMediaItemInfo_Value(it, "B_MUTE") ~= 0
  d.gainDb = gain_to_db(reaper.GetMediaItemInfo_Value(it, "D_VOL")) or -150
  d.fadeInMs = round(reaper.GetMediaItemInfo_Value(it, "D_FADEINLEN") * 1000, 1)
  d.fadeOutMs = round(reaper.GetMediaItemInfo_Value(it, "D_FADEOUTLEN") * 1000, 1)
  if take then
    d.pitch = round(reaper.GetMediaItemTakeInfo_Value(take, "D_PITCH"), 3)
    d.playrate = round(reaper.GetMediaItemTakeInfo_Value(take, "D_PLAYRATE"), 4)
    d.preservePitch = reaper.GetMediaItemTakeInfo_Value(take, "B_PPITCH") ~= 0
    local src = reaper.GetMediaItemTake_Source(take)
    local _, _, _, rev = reaper.PCM_Source_GetSectionInfo(src)
    d.reversed = rev == true
    if not reaper.TakeIsMIDI(take) then d.takeGainDb = gain_to_db(math.abs(reaper.GetMediaItemTakeInfo_Value(take, "D_VOL"))) or -150 end
  end
  d.takeCount = reaper.CountTakes(it)
  return d
end

------------------------------------------------------------------------------
-- MIDI notes
------------------------------------------------------------------------------
local PITCH_NAMES = { "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B" }
local function pitch_name(p) return PITCH_NAMES[p % 12 + 1] .. tostring(p // 12 - 1) end
K.pitch_name = pitch_name

local SCALES = {
  major = { 0, 2, 4, 5, 7, 9, 11 }, minor = { 0, 2, 3, 5, 7, 8, 10 }, dorian = { 0, 2, 3, 5, 7, 9, 10 },
  phrygian = { 0, 1, 3, 5, 7, 8, 10 }, lydian = { 0, 2, 4, 6, 7, 9, 11 }, mixolydian = { 0, 2, 4, 5, 7, 9, 10 },
  locrian = { 0, 1, 3, 5, 6, 8, 10 }, ["harmonic-minor"] = { 0, 2, 3, 5, 7, 8, 11 }, ["melodic-minor"] = { 0, 2, 3, 5, 7, 9, 11 },
  ["major-pentatonic"] = { 0, 2, 4, 7, 9 }, ["minor-pentatonic"] = { 0, 3, 5, 7, 10 }, blues = { 0, 3, 5, 6, 7, 10 },
}
local TONICS = { C = 0, ["C#"] = 1, Db = 1, D = 2, ["D#"] = 3, Eb = 3, E = 4, F = 5, ["F#"] = 6, Gb = 6, G = 7, ["G#"] = 8, Ab = 8, A = 9, ["A#"] = 10, Bb = 10, B = 11 }

local function snap_to_scale(p, set)
  if set[p % 12] then return p end
  for d = 1, 6 do
    if p - d >= 0 and set[(p - d) % 12] then return p - d end
    if p + d <= 127 and set[(p + d) % 12] then return p + d end
  end
  return p
end
K.snap_to_scale = snap_to_scale

-- Park-Miller generator: humanize is repeatable for a given seed.
local function rng(seed)
  local state = math.floor(seed) % 2147483647
  if state <= 0 then state = state + 2147483646 end
  return function()
    state = (state * 48271) % 2147483647
    return state / 2147483647
  end
end

-- Snap x (quarter notes) to a grid of g, with swing (50 = straight) on every second grid line.
local function quant_target(x, g, swing)
  if not swing or math.abs(swing - 50) < 1e-9 then return math.floor(x / g + 0.5) * g end
  local pair = 2 * g
  local base = math.floor(x / pair) * pair
  local best = base
  for _, v in ipairs({ base, base + pair * swing / 100, base + pair }) do
    if math.abs(v - x) < math.abs(best - x) then best = v end
  end
  return best
end
K.quant_target = quant_target

local function midi_sources(ref, what)
  local list = {}
  local function add(it, take, selected_only)
    if take and reaper.TakeIsMIDI(take) then list[#list + 1] = { item = it, take = take, selectedOnly = selected_only } end
  end
  if ref.selected == "notes" then
    local ed = reaper.MIDIEditor_GetActive()
    local take = ed and reaper.MIDIEditor_GetTake(ed)
    if not take or not reaper.ValidatePtr2(0, take, "MediaItem_Take*") then
      fail("NOTHING_SELECTED", "No MIDI editor is open.", "Open the clip in the MIDI editor and select notes, or name a track and bars.")
    end
    add(reaper.GetMediaItemTake_Item(take), take, true)
  elseif ref.selected == "items" then
    for _, it in ipairs(selected_items()) do add(it, reaper.GetActiveTake(it), false) end
    if #list == 0 then fail("NOTHING_SELECTED", "No MIDI items are selected.", "Select MIDI items, or name a track and bars.") end
  elseif ref.items ~= nil then
    for _, id in ipairs(arg_table(ref.items, what .. ".items")) do
      local it = find_item(id)
      if not it then fail("ITEM_NOT_FOUND", "A MIDI item no longer exists.", "Read the project again for fresh ids.") end
      local take = reaper.GetActiveTake(it)
      if not take or not reaper.TakeIsMIDI(take) then fail("CLIP_NOT_FOUND", "That item is not a MIDI clip.") end
      add(it, take, false)
    end
  elseif ref.track ~= nil then
    local tr = find_track(ref.track, what .. ".track")
    for _, it in ipairs(items_on(tr)) do add(it, reaper.GetActiveTake(it), false) end
    if #list == 0 then fail("CLIP_NOT_FOUND", track_label(tr) .. " has no MIDI items.", "Use readMidiNotes on a MIDI track, or analyzeAudio for audio.") end
  else
    fail("INVALID_ARGS", what .. " must give track, items or selected")
  end
  return list
end

-- The notes a NotesRef names: { {item, take, idx = {note indices}} }, total, range start/end.
local function resolve_notes(ref, what)
  what = what or "notes"
  arg_table(ref, what)
  local s, e
  if ref.range ~= nil then s, e = resolve_range(ref.range, what .. ".range") end
  local lo, hi = 0, 127
  if ref.pitch ~= nil then
    arg_table(ref.pitch, what .. ".pitch")
    lo = arg_int(ref.pitch.min, what .. ".pitch.min", 0, 127)
    hi = arg_int(ref.pitch.max, what .. ".pitch.max", 0, 127)
    if hi < lo then lo, hi = hi, lo end
  end
  local list = midi_sources(ref, what)
  local total = 0
  for _, t in ipairs(list) do
    t.idx = {}
    local a, b = item_bounds(t.item)
    local _, n = reaper.MIDI_CountEvts(t.take)
    for i = 0, n - 1 do
      local _, sel, _, sppq, _, _, pitch = reaper.MIDI_GetNote(t.take, i)
      local ok = pitch >= lo and pitch <= hi and (not t.selectedOnly or sel)
      if ok then
        local at = reaper.MIDI_GetProjTimeFromPPQPos(t.take, sppq)
        ok = at >= a - 1e-6 and at < b - 1e-6 and (not s or (at >= s - 1e-6 and at < e - 1e-6))
      end
      if ok then t.idx[#t.idx + 1] = i end
    end
    total = total + #t.idx
  end
  return list, total, s, e
end

local function where_text(s, e) return s and (" in " .. bars_text(s, e)) or "" end

------------------------------------------------------------------------------
-- Envelopes
------------------------------------------------------------------------------
local TRACK_ENVS = {
  volume = { name = "Volume", chunk = "<VOLENV2", action = 40406 },
  pan = { name = "Pan", chunk = "<PANENV2", action = 40407 },
  mute = { name = "Mute", chunk = "<MUTEENV", action = 40867 },
}

-- Returns env, kind ("volume" | "pan" | "mute" | "fx"), fx index, param index.
local function find_envelope(tr, ref, create)
  arg_table(ref, "envelope")
  if ref.kind ~= nil then
    local d = TRACK_ENVS[ref.kind]
    if not d then fail("INVALID_ARGS", "envelope.kind must be volume, pan or mute") end
    local env = reaper.GetTrackEnvelopeByChunkName(tr, d.chunk) or reaper.GetTrackEnvelopeByName(tr, d.name)
    if not env and create then
      with_selection(function()
        select_only_tracks({ tr })
        reaper.Main_OnCommand(d.action, 0)
      end)
      env = reaper.GetTrackEnvelopeByChunkName(tr, d.chunk) or reaper.GetTrackEnvelopeByName(tr, d.name)
    end
    return env, ref.kind
  end
  local fx = resolve_fx(tr, ref.fx)
  local p = resolve_param(tr, fx, ref.param)
  return reaper.GetFXEnvelope(tr, fx, p, create == true), "fx", fx, p
end

local function mute_raw(env, muted)
  -- REAPER labels raw values itself; read which end means "muted".
  local zero = lower(reaper.Envelope_FormatValue(env, 0) or "")
  local zero_is_unmuted = zero:find("unmute", 1, true) ~= nil
  if muted then return zero_is_unmuted and 1 or 0 end
  return zero_is_unmuted and 0 or 1
end

-- Musician units <-> raw envelope values.
local function to_raw(env, kind, v, tr, fx, p)
  if kind == "volume" then
    if v > 6.0001 then fail("INVALID_ARGS", "Volume automation goes up to +6 dB.") end
    return reaper.ScaleToEnvelopeMode(reaper.GetEnvelopeScalingMode(env), db_to_gain(v))
  elseif kind == "pan" then
    if v < -1 or v > 1 then fail("INVALID_ARGS", "Pan values go from -1 (left) to 1 (right).") end
    return -v -- REAPER stores pan envelopes inverted (raw -1 shows as 100%R)
  elseif kind == "mute" then
    return mute_raw(env, v >= 0.5)
  end
  if v < 0 or v > 1 then fail("INVALID_ARGS", "Effect parameter automation uses 0 to 1.") end
  local _, mn, mx = reaper.TrackFX_GetParam(tr, fx, p)
  return mn + v * (mx - mn)
end

local function from_raw(env, kind, raw, tr, fx, p)
  if kind == "volume" then
    return gain_to_db(reaper.ScaleFromEnvelopeMode(reaper.GetEnvelopeScalingMode(env), raw)) or -150
  elseif kind == "pan" then
    return round(-raw, 4)
  elseif kind == "mute" then
    return (raw == mute_raw(env, true)) and 1 or 0
  end
  local _, mn, mx = reaper.TrackFX_GetParam(tr, fx, p)
  if mx - mn == 0 then return raw end
  return round((raw - mn) / (mx - mn), 4)
end

local function env_value_at(env, t)
  local _, v = reaper.Envelope_Evaluate(env, t, 48000, 1)
  return v
end

local SHAPE_NAMES = { [0] = "linear", [1] = "square", [2] = "slow", [3] = "fast-start", [4] = "fast-end", [5] = "bezier" }

------------------------------------------------------------------------------
-- Analysis
------------------------------------------------------------------------------
local function parse_render_stats(s)
  local files, cur = {}, nil
  for field in (s or ""):gmatch("[^;]+") do
    local k, v = field:match("^(%u+):(.*)$")
    if k == "FILE" then cur = { FILE = v }; files[#files + 1] = cur
    elseif k and cur then cur[k] = v end
  end
  local out = {}
  for _, f in ipairs(files) do
    local function num(x) local n = tonumber(x); return n and round(n, 2) or json.null end
    out[#out + 1] = {
      name = f.FILE, length = f.LENGTH or json.null, peakDb = num(f.PEAK), truePeakDb = num(f.TRUEPEAK), clips = num(f.CLIP),
      truePeakClips = num(f.TRUPEAKCLIP), rmsDb = num(f.RMSI), rmsMMaxDb = num(f.RMSMMAX), lufsI = num(f.LUFSI),
      lufsSMax = num(f.LUFSSMAX), lufsMMax = num(f.LUFSMMAX), lra = num(f.LRA),
    }
  end
  return out
end
K.parse_render_stats = parse_render_stats

local function dry_run(action)
  local ok, stats = reaper.GetSetProjectInfo_String(0, "RENDER_STATS", tostring(action), false)
  if not ok or not stats or stats == "" then return {} end
  return parse_render_stats(stats)
end

local function make_fft(n)
  local cos_t, sin_t, rev, hann = {}, {}, {}, {}
  for k = 0, n // 2 - 1 do cos_t[k] = math.cos(2 * math.pi * k / n); sin_t[k] = -math.sin(2 * math.pi * k / n) end
  local bits = math.floor(math.log(n, 2) + 0.5)
  for i = 0, n - 1 do
    local r, x = 0, i
    for _ = 1, bits do r = (r << 1) | (x & 1); x = x >> 1 end
    rev[i] = r
    hann[i] = 0.5 - 0.5 * math.cos(2 * math.pi * i / (n - 1))
  end
  local function fft(re, im)
    for i = 0, n - 1 do
      local r = rev[i]
      if r > i then re[i], re[r] = re[r], re[i]; im[i], im[r] = im[r], im[i] end
    end
    local size = 2
    while size <= n do
      local half, step = size // 2, n // size
      for start = 0, n - 1, size do
        local k = 0
        for j = start, start + half - 1 do
          local l = j + half
          local wr, wi = cos_t[k], sin_t[k]
          local tr_ = wr * re[l] - wi * im[l]
          local ti = wr * im[l] + wi * re[l]
          re[l], im[l] = re[j] - tr_, im[j] - ti
          re[j], im[j] = re[j] + tr_, im[j] + ti
          k = k + step
        end
      end
      size = size * 2
    end
  end
  return fft, hann
end

local FFT_N = 4096
local fft_fn, fft_hann = nil, nil
local BANDS = { { "sub", 20, 60 }, { "low", 60, 250 }, { "lowMid", 250, 500 }, { "mid", 500, 2000 }, { "highMid", 2000, 6000 }, { "high", 6000, 20000 } }

-- Tonal balance and clipping signs from up to `max_windows` 4096-sample windows of an accessor.
local function scan_accessor(acc, s, e, nch, sr, max_windows)
  if not fft_fn then fft_fn, fft_hann = make_fft(FFT_N) end
  local win = FFT_N / sr
  local dur = e - s
  if dur < win then return nil end
  local count = math.max(1, math.min(max_windows, math.floor(dur / win)))
  local step = count > 1 and (dur - win) / (count - 1) or 0
  local buf = reaper.new_array(FFT_N * nch)
  local energy = {}
  for i = 1, #BANDS do energy[i] = 0 end
  local total, cnum, used, clip_runs = 0, 0, 0, 0
  local re, im = {}, {}
  for w = 0, count - 1 do
    buf.clear()
    if reaper.GetAudioAccessorSamples(acc, sr, nch, s + w * step, FFT_N, buf) == 1 then
      local x = buf.table()
      local ms = 0
      local runs = {}
      for i = 0, FFT_N - 1 do
        local v = 0
        for c = 1, nch do
          local xc = x[i * nch + c]
          v = v + xc
          if xc >= 0.999 or xc <= -0.999 then
            runs[c] = (runs[c] or 0) + 1
            if runs[c] == 3 then clip_runs = clip_runs + 1 end
          else
            runs[c] = 0
          end
        end
        v = v / nch
        ms = ms + v * v
        re[i], im[i] = v * fft_hann[i], 0
      end
      if ms / FFT_N > 1e-7 then -- skip windows quieter than about -70 dBFS
        used = used + 1
        fft_fn(re, im)
        for k = 1, FFT_N // 2 - 1 do
          local f = k * sr / FFT_N
          if f >= 20 and f < 20000 then
            local p = re[k] * re[k] + im[k] * im[k]
            total = total + p
            cnum = cnum + p * f
            for b = 1, #BANDS do
              if f < BANDS[b][3] then energy[b] = energy[b] + p; break end
            end
          end
        end
      end
    end
  end
  local out = { windows = used, clipRuns = clip_runs }
  if used > 0 and total > 0 then
    local bands = json.array({})
    for b, band in ipairs(BANDS) do
      bands[#bands + 1] = { band = band[1], fromHz = band[2], toHz = band[3],
        share = round(energy[b] / total * 100, 1), db = energy[b] > 0 and round(10 * math.log(energy[b] / total, 10), 1) or -120 }
    end
    out.bands = bands
    out.centroidHz = round(cnum / total, 0)
  end
  return out
end

-- Recorded level of an audio take's source (before item gain, FX and fades), over s..e of the item.
local function source_levels(it, take, s, e)
  local src = reaper.GetMediaItemTake_Source(take)
  local a, b = item_bounds(it)
  local s2, e2 = math.max(a, s or a), math.min(b, e or b)
  local rate = reaper.GetMediaItemTakeInfo_Value(take, "D_PLAYRATE")
  local offs = reaper.GetMediaItemTakeInfo_Value(take, "D_STARTOFFS")
  local len = reaper.GetMediaSourceLength(src)
  local ss = math.max(0, math.min(len, offs + (s2 - a) * rate))
  local se = math.max(ss, math.min(len, offs + (e2 - a) * rate))
  if se - ss < 0.05 then return nil end
  local nch = math.max(1, reaper.GetMediaSourceNumChannels(src))
  local function level(mode)
    local g = reaper.CalculateNormalization(src, mode, 0, ss, se)
    if not g or g <= 0 then return json.null end
    return round(-20 * math.log(g, 10), 2)
  end
  local rms = level(1)
  return {
    lufsI = level(0), peakDb = level(2), truePeakDb = level(3), lufsMMax = level(4), lufsSMax = level(5),
    rmsDb = rms ~= json.null and round(rms - 10 * math.log(nch, 10), 2) or json.null, -- per channel
    channels = nch, seconds = round(se - ss, 2),
  }
end

------------------------------------------------------------------------------
-- Context: selection, sections and per-track extras for getProjectState
------------------------------------------------------------------------------
local function selection_state()
  local tracks = json.array({})
  for _, tr in ipairs(selected_tracks()) do tracks[#tracks + 1] = { id = track_guid(tr), index = track_number(tr), name = track_name(tr) } end
  local items = json.array({})
  local n = reaper.CountSelectedMediaItems(0)
  for i = 0, math.min(n, 64) - 1 do items[#items + 1] = item_brief(reaper.GetSelectedMediaItem(0, i)) end
  local razor = json.array({})
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    local _, r = reaper.GetSetMediaTrackInfo_String(tr, "P_RAZOREDITS", "", false)
    if r and r ~= "" then
      for a, b, g in r:gmatch('(%S+) (%S+) "([^"]*)"') do
        local s, e = tonumber(a), tonumber(b)
        if s and e and e > s and g == "" and #razor < 64 then
          razor[#razor + 1] = merge(span_json(s, e), { trackId = track_guid(tr), track = track_label(tr) })
        end
      end
    end
  end
  local ts, te = reaper.GetSet_LoopTimeRange2(0, false, false, 0, 0, false)
  local midi = json.null
  local ed = reaper.MIDIEditor_GetActive()
  local take = ed and reaper.MIDIEditor_GetTake(ed)
  if take and reaper.ValidatePtr2(0, take, "MediaItem_Take*") then
    local it = reaper.GetMediaItemTake_Item(take)
    local _, cnt = reaper.MIDI_CountEvts(take)
    local nsel, lo, hi, first, last = 0, 128, -1, nil, nil
    local i = reaper.MIDI_EnumSelNotes(take, -1)
    while i ~= -1 and nsel < 100000 do
      nsel = nsel + 1
      local _, _, _, sppq, eppq, _, pitch = reaper.MIDI_GetNote(take, i)
      lo, hi = math.min(lo, pitch), math.max(hi, pitch)
      local st, en = reaper.MIDI_GetProjTimeFromPPQPos(take, sppq), reaper.MIDI_GetProjTimeFromPPQPos(take, eppq)
      first = first and math.min(first, st) or st
      last = last and math.max(last, en) or en
      i = reaper.MIDI_EnumSelNotes(take, i)
    end
    midi = {
      itemId = item_guid(it), track = track_label(reaper.GetMediaItem_Track(it)), take = take_name(take), notes = cnt, selectedNotes = nsel,
      pitchRange = nsel > 0 and (pitch_name(lo) .. "–" .. pitch_name(hi)) or json.null,
      selectedSpan = first and span_json(first, last) or json.null,
    }
  end
  local env = json.null
  local se = reaper.GetSelectedEnvelope(0)
  if se then
    local _, ename = reaper.GetEnvelopeName(se)
    local ptr = reaper.Envelope_GetParentTrack(se)
    env = { name = ename or "", track = ptr and track_label(ptr) or json.null, points = reaper.CountEnvelopePoints(se) }
  end
  return {
    tracks = tracks, items = items, itemCount = n, razor = razor,
    timeSelection = (te > ts) and span_json(ts, te) or json.null, midiEditor = midi, envelope = env,
  }
end

-- Contiguous runs of items on a track, e.g. "bars 1–16 (4 items)".
local function item_spans(tr)
  local list = {}
  local midi, audio = 0, 0
  for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
    local it = reaper.GetTrackMediaItem(tr, j)
    local a, b = item_bounds(it)
    list[#list + 1] = { a, b }
    if take_kind(reaper.GetActiveTake(it)) == "midi" then midi = midi + 1 else audio = audio + 1 end
  end
  table.sort(list, function(x, y) return x[1] < y[1] end)
  local spans, cur = {}, nil
  for _, r in ipairs(list) do
    if cur and r[1] <= cur[2] + 0.01 then
      cur[2] = math.max(cur[2], r[2]); cur[3] = cur[3] + 1
    else
      cur = { r[1], r[2], 1 }
      spans[#spans + 1] = cur
    end
  end
  local out = json.array({})
  for i = 1, math.min(#spans, 8) do out[#out + 1] = merge(span_json(spans[i][1], spans[i][2]), { count = spans[i][3] }) end
  return { count = #list, midi = midi, audio = audio, spans = out, moreSpans = math.max(0, #spans - 8) }
end

local function track_receives(tr)
  local out = json.array({})
  for r = 0, reaper.GetTrackNumSends(tr, -1) - 1 do
    local srcp = reaper.GetTrackSendInfo_Value(tr, -1, r, "P_SRCTRACK")
    out[#out + 1] = {
      fromId = type(srcp) == "userdata" and track_guid(srcp) or json.null,
      fromName = type(srcp) == "userdata" and track_label(srcp) or json.null,
      volumeDb = gain_to_db(reaper.GetTrackSendInfo_Value(tr, -1, r, "D_VOL")) or json.null,
      destChannel = (math.floor(reaper.GetTrackSendInfo_Value(tr, -1, r, "I_DSTCHAN")) & 1023) + 1,
      mode = send_mode_name(reaper.GetTrackSendInfo_Value(tr, -1, r, "I_SENDMODE")),
    }
  end
  return out
end

local function input_fx(tr)
  local out = json.array({})
  for f = 0, reaper.TrackFX_GetRecCount(tr) - 1 do
    local _, name = reaper.TrackFX_GetFXName(tr, 0x1000000 + f)
    out[#out + 1] = { name = name or "", enabled = reaper.TrackFX_GetEnabled(tr, 0x1000000 + f) }
  end
  return out
end

local function envelope_brief(tr)
  local out = json.array({})
  for i = 0, reaper.CountTrackEnvelopes(tr) - 1 do
    local env = reaper.GetTrackEnvelope(tr, i)
    local pts = reaper.CountEnvelopePoints(env)
    local items = reaper.CountAutomationItems(env)
    if (pts > 1 or items > 0) and #out < 16 then
      local _, name = reaper.GetEnvelopeName(env)
      local _, active = reaper.GetSetEnvelopeInfo_String(env, "ACTIVE", "", false)
      out[#out + 1] = { name = name or "", points = pts, automationItems = items, active = active ~= "0" }
    end
  end
  return out
end

local AUTOMODES = { [0] = "trim/read", [1] = "read", [2] = "touch", [3] = "write", [4] = "latch", [5] = "latch preview" }

local function fx_with_presets(tr, list)
  for _, f in ipairs(list) do
    local _, preset = reaper.TrackFX_GetPreset(tr, f.index, "")
    if preset and preset ~= "" then f.preset = preset end
    if fx_is_instrument(f.name) then f.instrument = true end
  end
  return list
end

augment_state = function(st)
  st.selection = selection_state()
  st.sections = sections_json()
  st.project.lengthBar = bar_of(reaper.GetProjectLength(0))
  if st.timeSelection ~= json.null then st.timeSelection = span_json(st.timeSelection.start, st.timeSelection["end"]) end
  if st.loop ~= json.null then st.loop = span_json(st.loop.start, st.loop["end"]) end
  for _, m in ipairs(st.markers) do
    if m.isRegion then m.endBar = bar_of(m["end"]) end
  end
  for _, t in ipairs(st.tracks) do
    local tr = reaper.GetTrack(0, t.index - 1)
    if tr then
      t.items = item_spans(tr)
      t.receives = track_receives(tr)
      fx_with_presets(tr, t.fx)
      t.inputFx = input_fx(tr)
      t.envelopes = envelope_brief(tr)
      t.frozen = reaper.GetMediaTrackInfo_Value(tr, "I_FREEZECOUNT") > 0
      local parent = reaper.GetParentTrack(tr)
      t.parentId = parent and track_guid(parent) or json.null
      t.mainSend = reaper.GetMediaTrackInfo_Value(tr, "B_MAINSEND") ~= 0
      t.automation = AUTOMODES[math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_AUTOMODE"))] or "read"
    end
  end
  return st
end

------------------------------------------------------------------------------
-- 0.4 handlers: reads
------------------------------------------------------------------------------
H.getSelection = function()
  return read_ok(selection_state())
end

-- The small per-message context: project basics, selection, sections and the track list (no FX walks).
H.getSessionContext = function()
  local ps = reaper.GetPlayState()
  local cursor = reaper.GetCursorPosition()
  local pos = (ps & 1 ~= 0 or ps & 4 ~= 0) and reaper.GetPlayPosition() or cursor
  local num, den, bpm = time_sig_at(pos)
  local pname = reaper.GetProjectName(0)
  local _, path = reaper.EnumProjects(-1)
  local lb = bar_of(reaper.GetProjectLength(0))
  local n = reaper.CountTracks(0)
  local tracks = json.array({})
  for i = 0, math.min(n, 200) - 1 do
    local tr = reaper.GetTrack(0, i)
    tracks[#tracks + 1] = { id = track_guid(tr), index = i + 1, name = track_name(tr), armed = reaper.GetMediaTrackInfo_Value(tr, "I_RECARM") ~= 0 }
  end
  return read_ok({
    project = {
      name = (pname ~= "" and pname) or "Untitled project", saved = (path or "") ~= "", dirty = reaper.IsProjectDirty(0) ~= 0,
      bpm = round(bpm, 3), timeSig = string.format("%d/%d", num, den), transport = transport_name(ps), cursorBar = clock_label(pos),
      lengthBars = (lb ~= json.null) and (lb.beat > 1.001 and lb.bar or lb.bar - 1) or json.null, trackCount = n,
    },
    selection = selection_state(), sections = sections_json(), tracks = tracks,
  })
end

H.listTrackItems = function(a)
  local tr = find_track(a.track)
  local s, e
  if a.range ~= nil then s, e = resolve_range(a.range, "range") end
  local items = json.array({})
  for _, it in ipairs(items_on(tr, s, e)) do
    if #items >= 500 then break end
    items[#items + 1] = merge(item_info(it, tr), item_detail(it))
  end
  return read_ok({ trackId = track_guid(tr), track = track_label(tr), items = items, total = #items_on(tr, s, e), range = s and span_json(s, e) or json.null })
end

H.getTrackDetails = function(a)
  local tr = find_track(a.track)
  local st = track_state(tr)
  fx_with_presets(tr, st.fx)
  for _, f in ipairs(st.fx) do
    local ok, file = reaper.TrackFX_GetNamedConfigParm(tr, f.index, "FILE0") -- ReaSamplOmatic5000 and similar samplers
    if ok and file and file ~= "" then f.sample = file end
    f.offline = reaper.TrackFX_GetOffline(tr, f.index)
  end
  local inst = reaper.TrackFX_GetInstrument(tr)
  local lo, hi, notes, files = 128, -1, 0, {}
  local seen = {}
  for _, it in ipairs(items_on(tr)) do
    local take = reaper.GetActiveTake(it)
    if take and reaper.TakeIsMIDI(take) then
      local _, n = reaper.MIDI_CountEvts(take)
      for i = 0, n - 1 do
        local _, _, _, _, _, _, pitch = reaper.MIDI_GetNote(take, i)
        lo, hi = math.min(lo, pitch), math.max(hi, pitch)
      end
      notes = notes + n
    elseif take then
      local src = reaper.GetMediaItemTake_Source(take)
      local parent = reaper.GetMediaSourceParent(src)
      local f = reaper.GetMediaSourceFileName(parent or src) or ""
      if f ~= "" and not seen[f] and #files < 20 then seen[f] = true; files[#files + 1] = f end
    end
  end
  local items = json.array({})
  for _, it in ipairs(items_on(tr)) do
    if #items >= 100 then break end
    items[#items + 1] = item_brief(it)
  end
  local parent = reaper.GetParentTrack(tr)
  return read_ok({
    track = st,
    instrument = inst >= 0 and { fxIndex = inst, name = select(2, reaper.TrackFX_GetFXName(tr, inst)), preset = select(2, reaper.TrackFX_GetPreset(tr, inst, "")) } or json.null,
    inputFx = input_fx(tr), receives = track_receives(tr), envelopes = envelope_brief(tr),
    parent = parent and track_label(parent) or json.null, mainSend = reaper.GetMediaTrackInfo_Value(tr, "B_MAINSEND") ~= 0,
    frozen = reaper.GetMediaTrackInfo_Value(tr, "I_FREEZECOUNT") > 0,
    automation = AUTOMODES[math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_AUTOMODE"))] or "read",
    items = items, itemTotal = reaper.CountTrackMediaItems(tr),
    midi = notes > 0 and { notes = notes, lowest = pitch_name(lo), highest = pitch_name(hi), lowestPitch = lo, highestPitch = hi } or json.null,
    audioFiles = json.array(files),
  })
end

H.readMidiNotes = function(a)
  local list, total, s, e = resolve_notes(a.notes, "notes")
  local clips, notes = json.array({}), json.array({})
  for ci, t in ipairs(list) do
    local a0, b0 = item_bounds(t.item)
    local tr = reaper.GetMediaItem_Track(t.item)
    clips[#clips + 1] = merge(span_json(a0, b0), { itemId = item_guid(t.item), track = track_label(tr), trackId = track_guid(tr), name = take_name(t.take),
      notes = #t.idx })
    for _, i in ipairs(t.idx) do
      if #notes >= 20000 then break end
      local _, sel, mut, sppq, eppq, chan, pitch, vel = reaper.MIDI_GetNote(t.take, i)
      local sq = reaper.MIDI_GetProjQNFromPPQPos(t.take, sppq)
      local eq = reaper.MIDI_GetProjQNFromPPQPos(t.take, eppq)
      notes[#notes + 1] = json.array({ clock_label(reaper.MIDI_GetProjTimeFromPPQPos(t.take, sppq)), round(sq, 4), round(eq - sq, 4), pitch, vel, chan, sel and 1 or 0, mut and 1 or 0, ci - 1 })
    end
  end
  local num, den, bpm = time_sig_at(s or 0)
  return read_ok({ clips = clips, notes = notes, total = total, truncated = total > #notes, range = s and span_json(s, e) or json.null,
    bpm = round(bpm, 3), timeSig = string.format("%d/%d", num, den), columns = "position,qn,lengthBeats,pitch,velocity,channel,selected,muted,clip" })
end

H.readAutomation = function(a)
  local tr = find_track(a.track)
  local env, kind, fx, p = find_envelope(tr, a.envelope, false)
  if not env then
    return read_ok({ track = track_label(tr), envelope = kind, exists = false, points = json.array({}) }, "There is no such envelope on this track yet.")
  end
  local s, e
  if a.range ~= nil then s, e = resolve_range(a.range, "range") end
  local pts = json.array({})
  local n = reaper.CountEnvelopePoints(env)
  for i = 0, n - 1 do
    local _, t, v, shape = reaper.GetEnvelopePoint(env, i)
    if (not s or (t >= s - 1e-9 and t <= e + 1e-9)) and #pts < 500 then
      pts[#pts + 1] = { time = round(t, 4), position = clock_label(t), value = from_raw(env, kind, v, tr, fx, p), display = reaper.Envelope_FormatValue(env, v), shape = SHAPE_NAMES[shape] or shape }
    end
  end
  local _, name = reaper.GetEnvelopeName(env)
  local out = { track = track_label(tr), envelope = name, kind = kind, exists = true, points = pts, totalPoints = n,
    automationItems = reaper.CountAutomationItems(env), range = s and span_json(s, e) or json.null }
  if s then
    -- Just inside the edges: writeAutomation keeps guard points exactly on them.
    local inset = math.min(0.001, (e - s) / 4)
    out.valueAtStart = from_raw(env, kind, env_value_at(env, s + inset), tr, fx, p)
    out.valueAtEnd = from_raw(env, kind, env_value_at(env, e - inset), tr, fx, p)
  end
  return read_ok(out)
end

H.analyzeAudio = function(a)
  local target = arg_table(a.target, "target")
  require_stopped("measuring")
  local s, e
  if a.range ~= nil then s, e = resolve_range(a.range, "range") end
  local results = json.array({})
  local notes = json.array({})
  if target.master then
    local stats = with_selection(function()
      if s then reaper.GetSet_LoopTimeRange2(0, true, false, s, e, false) end
      return dry_run(s and 42441 or 42440)
    end)
    local st = stats[1]
    if not st then fail("DAW_ERROR", "REAPER did not return loudness statistics for the master.") end
    st.name = "Master"
    st.kind = "master"
    results[1] = st
    notes[#notes + 1] = "Tonal balance of the master needs a render; measure items or frozen tracks for that."
  elseif target.tracks then
    local list = {}
    for i, ref in ipairs(arg_table(target.tracks, "target.tracks")) do list[#list + 1] = find_track(ref, "target.tracks[" .. i .. "]") end
    table.sort(list, function(x, y) return track_number(x) < track_number(y) end)
    local stats = with_selection(function()
      select_only_tracks(list)
      if s then reaper.GetSet_LoopTimeRange2(0, true, false, s, e, false) end
      return dry_run(s and 42439 or 42438)
    end)
    for i, tr in ipairs(list) do
      local r = stats[i] or { name = track_label(tr), missing = true }
      r.name, r.kind, r.trackId = track_label(tr), "track", track_guid(tr)
      -- Tonal balance from the track's audio items (before FX).
      local has_audio = false
      for _, it in ipairs(items_on(tr, s, e)) do
        if take_kind(reaper.GetActiveTake(it)) == "audio" then has_audio = true; break end
      end
      if has_audio then
        local acc = reaper.CreateTrackAudioAccessor(tr)
        local a0 = s or reaper.GetAudioAccessorStartTime(acc)
        local b0 = e or reaper.GetAudioAccessorEndTime(acc)
        local sr = math.floor(reaper.GetSetProjectInfo(0, "PROJECT_SRATE", 0, false))
        if sr < 8000 then sr = 48000 end
        r.sourceScan = scan_accessor(acc, a0, b0, 2, sr, 24)
        reaper.DestroyAudioAccessor(acc)
      else
        r.sourceScan = json.null
      end
      results[#results + 1] = r
    end
  else
    local has_midi = false
    local items, rs, re = resolve_items(arg_table(target.items, "target.items"), "target.items")
    if #items > 64 then fail("INVALID_ARGS", "Measure at most 64 items at a time; narrow it down with a range.") end
    s, e = s or rs, e or re
    -- The dry run reports items in project order: by track, then by position.
    table.sort(items, function(x, y)
      local tx, ty = track_number(reaper.GetMediaItem_Track(x)), track_number(reaper.GetMediaItem_Track(y))
      if tx ~= ty then return tx < ty end
      return (item_bounds(x)) < (item_bounds(y))
    end)
    local stats = with_selection(function()
      select_only_items(items)
      return dry_run(42437)
    end)
    for i, it in ipairs(items) do
      local take = reaper.GetActiveTake(it)
      local r = stats[i] or { missing = true }
      r.kind, r.itemId, r.track = "item", item_guid(it), track_label(reaper.GetMediaItem_Track(it))
      r.name = take_name(take)
      r.bars = bars_text(item_bounds(it))
      if take and not reaper.TakeIsMIDI(take) then
        r.source = source_levels(it, take, s, e) or json.null
        r.itemGainDb = gain_to_db(reaper.GetMediaItemInfo_Value(it, "D_VOL") * math.abs(reaper.GetMediaItemTakeInfo_Value(take, "D_VOL"))) or -150
        if i <= 8 then
          local acc = reaper.CreateTakeAudioAccessor(take)
          local src = reaper.GetMediaItemTake_Source(take)
          local nch = math.max(1, math.min(2, reaper.GetMediaSourceNumChannels(src)))
          local sr = math.floor(reaper.GetMediaSourceSampleRate(src))
          if sr < 8000 then sr = 48000 end
          local a0, b0 = item_bounds(it)
          local x0 = math.max(a0, s or a0) - a0
          local x1 = math.min(b0, e or b0) - a0
          r.sourceScan = scan_accessor(acc, x0, x1, nch, sr, 24) or json.null
          reaper.DestroyAudioAccessor(acc)
        end
      else
        r.source = json.null
        has_midi = true
      end
      results[#results + 1] = r
    end
    if has_midi then notes[#notes + 1] = "MIDI items are measured after their instrument (the post-FX numbers)." end
    if s then notes[#notes + 1] = "Post-FX numbers cover each whole item; the source numbers and tonal balance cover only the range." end
  end
  return read_ok({ results = results, range = s and span_json(s, e) or json.null, notes = notes,
    sampleRate = math.floor(reaper.GetSetProjectInfo(0, "PROJECT_SRATE", 0, false)) })
end

local B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local function b64decode(s)
  local out, bits, nbits = {}, 0, 0
  for i = 1, #s do
    local c = s:sub(i, i)
    if c == "=" then break end
    local v = B64:find(c, 1, true)
    if v then
      bits = (bits << 6) | (v - 1)
      nbits = nbits + 6
      if nbits >= 8 then
        nbits = nbits - 8
        out[#out + 1] = string.char((bits >> nbits) & 0xFF)
        bits = bits & ((1 << nbits) - 1)
      end
    end
  end
  return table.concat(out)
end
K.b64decode = b64decode

local REC_FORMATS = { evaw = "WAV", ffia = "AIFF", calf = "FLAC", l3pm = "MP3", vggo = "OGG Vorbis", SggO = "Opus", kpvw = "WavPack", ["wave"] = "WAV" }

local function record_format()
  local ok, s = reaper.GetSetProjectInfo_String(0, "RECORD_FORMAT", "", false)
  if not ok or not s or s == "" then return json.null end
  local raw = b64decode(s)
  local tag = raw:sub(1, 4)
  local out = { type = REC_FORMATS[tag] or tag }
  if tag == "evaw" and #raw >= 5 then out.bitDepth = raw:byte(5) end
  return out
end

H.getRecordingSetup = function()
  local dev = {}
  for _, k in ipairs({ "MODE", "IDENT_IN", "IDENT_OUT", "BSIZE", "SRATE", "BPS" }) do
    local ok, v = reaper.GetAudioDeviceInfo(k)
    if ok then dev[k] = v end
  end
  local srate = tonumber(dev.SRATE)
  local lin, lout = reaper.GetInputOutputLatency()
  local bsize = tonumber(dev.BSIZE)
  local function ms(samples) return (srate and srate > 0 and samples) and round(samples / srate * 1000, 1) or json.null end
  local armed = json.array({})
  for _, tr in ipairs(armed_tracks()) do
    local rm = math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_RECMODE"))
    armed[#armed + 1] = {
      id = track_guid(tr), name = track_label(tr), input = describe_input(reaper.GetMediaTrackInfo_Value(tr, "I_RECINPUT")),
      monitoring = MONITOR[math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_RECMON"))] or "on",
      recordMode = RECMODES[rm] or ("mode-" .. rm), inputFx = input_fx(tr), fx = track_fx(tr),
      channels = math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_NCHAN")),
    }
  end
  local _, path = reaper.EnumProjects(-1)
  local _, recpath_setting = reaper.GetSetProjectInfo_String(0, "RECORD_PATH", "", false)
  local use_proj = reaper.GetSetProjectInfo(0, "PROJECT_SRATE_USE", 0, false) ~= 0
  local proj_sr = reaper.GetSetProjectInfo(0, "PROJECT_SRATE", 0, false)
  local ts, te = reaper.GetSet_LoopTimeRange2(0, false, false, 0, 0, false)
  local en = cfg_int("projmetroen")
  return read_ok({
    device = {
      open = dev.SRATE ~= nil, driver = dev.MODE or json.null, input = dev.IDENT_IN or json.null, output = dev.IDENT_OUT or json.null,
      sampleRate = srate or json.null, bufferSize = bsize or json.null, bitDepth = tonumber(dev.BPS) or json.null,
    },
    latency = {
      inputSamples = lin, outputSamples = lout, inputMs = ms(lin), outputMs = ms(lout),
      roundTripMs = ms((lin or 0) + (lout or 0)), bufferMs = ms(bsize),
    },
    projectSampleRate = use_proj and proj_sr or (srate or json.null),
    recordFormat = record_format(),
    recordPath = reaper.GetProjectPathEx(0) or json.null, recordPathSetting = recpath_setting or "",
    projectSaved = path ~= nil and path ~= "",
    recordMode = record_mode(), newTakeMode = new_take_mode(),
    preroll = { record = toggle(41819) == 1, play = toggle(41818) == 1, bars = cfg_num("prerollmeas") or json.null },
    countIn = count_in_state(), metronome = (en == nil) and json.null or (en & 1 ~= 0),
    timeSelection = (te > ts) and span_json(ts, te) or json.null,
    armed = armed, audioInputs = reaper.GetNumAudioInputs(), playState = transport_name(reaper.GetPlayState()),
  })
end

H.checkInputLevels = function(a)
  local secs = opt(a.seconds, arg_number, "seconds", 1, 10) or 4
  local list = {}
  if type(a.tracks) == "table" and #a.tracks > 0 then
    for i, ref in ipairs(a.tracks) do list[#list + 1] = find_track(ref, "tracks[" .. i .. "]") end
  else
    list = armed_tracks()
  end
  if #list == 0 then
    fail("PRECONDITION_FAILED", "No track is armed, so there is no input to listen to.", "Arm the track first, or name the tracks.")
  end
  for _, tr in ipairs(list) do
    reaper.Track_GetPeakHoldDB(tr, 0, true)
    reaper.Track_GetPeakHoldDB(tr, 1, true)
  end
  local peaks = {}
  local done_at = reaper.time_precise() + secs
  return pending(function()
    for i, tr in ipairs(list) do
      local p = peaks[i] or { 0, 0 }
      p[1] = math.max(p[1], reaper.Track_GetPeakInfo(tr, 0))
      p[2] = math.max(p[2], reaper.Track_GetPeakInfo(tr, 1))
      peaks[i] = p
    end
    if reaper.time_precise() < done_at then return nil end
    local out = json.array({})
    for i, tr in ipairs(list) do
      local p = peaks[i]
      local hold = math.max(reaper.Track_GetPeakHoldDB(tr, 0, false), reaper.Track_GetPeakHoldDB(tr, 1, false)) * 100
      local sampled = gain_to_db(math.max(p[1], p[2])) or -150
      local peak = math.max(sampled, hold > -150 and hold or -150)
      out[#out + 1] = {
        trackId = track_guid(tr), name = track_label(tr), peakDb = round(peak, 1), headroomDb = round(-peak, 1),
        leftDb = gain_to_db(p[1]) or -150, rightDb = gain_to_db(p[2]) or -150,
        armed = reaper.GetMediaTrackInfo_Value(tr, "I_RECARM") ~= 0,
        input = describe_input(reaper.GetMediaTrackInfo_Value(tr, "I_RECINPUT")),
        monitoring = MONITOR[math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_RECMON"))] or "on",
      }
    end
    return read_ok({ seconds = secs, tracks = out, playState = transport_name(reaper.GetPlayState()) })
  end, secs + 3)
end

------------------------------------------------------------------------------
-- 0.4 handlers: item edits (each is one undo point, read back afterwards)
------------------------------------------------------------------------------
H.splitItems = function(a, ctx)
  local items = resolve_items(a.items, "items")
  local times = {}
  if a.atRangeEdges ~= nil then
    local s, e = resolve_range(a.atRangeEdges, "atRangeEdges")
    times = { s, e }
  else
    for i, p in ipairs(arg_table(a.at, "at")) do times[#times + 1] = place_to_time(p, "at[" .. i .. "]") end
  end
  table.sort(times)
  local plan = {}
  for _, it in ipairs(items) do
    local p0, p1 = item_bounds(it)
    local cuts = {}
    for _, t in ipairs(times) do if t > p0 + 1e-6 and t < p1 - 1e-6 then cuts[#cuts + 1] = t end end
    if #cuts > 0 then plan[#plan + 1] = { it = it, cuts = cuts } end
  end
  if #plan == 0 then fail("PRECONDITION_FAILED", "None of the split points falls inside those items.", "Check the bars, or list the items first.") end
  ctx.change()
  local pieces = json.array({})
  local made, ok = 0, true
  for _, p in ipairs(plan) do
    local cur = p.it
    pieces[#pieces + 1] = cur
    for _, t in ipairs(p.cuts) do
      local right = reaper.SplitMediaItem(cur, t)
      if right then
        made = made + 1
        local _, b = item_bounds(cur)
        if math.abs(b - t) > 1e-6 then ok = false end
        cur = right
        pieces[#pieces + 1] = cur
      else
        ok = false
      end
    end
  end
  reaper.UpdateArrange()
  local out = json.array({})
  for _, it in ipairs(pieces) do out[#out + 1] = item_brief(it) end
  return verified(ok, { splits = made, items = out }, nil, string.format("Made %d split%s", made, made == 1 and "" or "s"))
end

H.moveItems = function(a, ctx)
  local items = resolve_items(a.items, "items")
  local dest = a.toTrack and find_track(a.toTrack, "toTrack") or nil
  local to = a.to and place_to_time(a.to, "to") or nil
  local by = a.by and arg_table(a.by, "by") or nil
  local first = math.huge
  for _, it in ipairs(items) do first = math.min(first, (item_bounds(it))) end
  local plan = {}
  for _, it in ipairs(items) do
    local p0, p1 = item_bounds(it)
    local np = p0
    if to then
      np = tm(qn(to) + (qn(p0) - qn(first)))
    elseif by then
      local dq = 0
      if by.bars ~= nil then dq = dq + arg_number(by.bars, "by.bars", -10000, 10000) * qn_per_bar_at(p0) end
      if by.beats ~= nil then dq = dq + arg_number(by.beats, "by.beats", -100000, 100000) end
      np = tm(qn(p0) + dq)
      if by.seconds ~= nil then np = np + arg_number(by.seconds, "by.seconds", -86400, 86400) end
    end
    if np < -1e-6 then fail("INVALID_ARGS", "That would move an item before the start of the project.") end
    plan[#plan + 1] = { it = it, pos = math.max(0, np), len = p1 - p0, track = dest or reaper.GetMediaItem_Track(it), lane = lane_of(it) }
  end
  local moving = {}
  for _, it in ipairs(items) do moving[it] = true end
  for _, p in ipairs(plan) do
    local hit = overlapping_on(p.track, p.pos, p.pos + p.len, moving, p.lane)
    if hit then
      fail("PRECONDITION_FAILED", string.format("%s already has material at %s.", track_label(p.track), bars_text(item_bounds(hit))),
        "Choose a free spot, or move or remove that material first.")
    end
  end
  ctx.change()
  for _, p in ipairs(plan) do
    if dest and reaper.GetMediaItem_Track(p.it) ~= dest then reaper.MoveMediaItemToTrack(p.it, dest) end
    reaper.SetMediaItemInfo_Value(p.it, "D_POSITION", p.pos)
  end
  reaper.UpdateArrange()
  local ok, out = true, json.array({})
  for _, p in ipairs(plan) do
    if math.abs(reaper.GetMediaItemInfo_Value(p.it, "D_POSITION") - p.pos) > 1e-6 or (dest and reaper.GetMediaItem_Track(p.it) ~= dest) then ok = false end
    out[#out + 1] = item_brief(p.it)
  end
  return verified(ok, { moved = #plan, items = out }, nil, string.format("Moved %d item%s", #plan, #plan == 1 and "" or "s"))
end

H.copyItems = function(a, ctx)
  local items, rs, re = resolve_items(a.items, "items")
  local to = place_to_time(a.to, "to")
  local times = opt(a.times, arg_int, "times", 1, 64) or 1
  local dest = a.toTrack and find_track(a.toTrack, "toTrack") or nil
  local anchor, last = math.huge, -math.huge
  for _, it in ipairs(items) do
    local p0, p1 = item_bounds(it)
    anchor, last = math.min(anchor, p0), math.max(last, p1)
  end
  if rs then anchor, last = rs, re end
  local aq, spanq, toq = qn(anchor), qn(last) - qn(anchor), qn(to)
  if spanq <= 1e-9 then fail("INVALID_ARGS", "There is nothing to copy there.") end
  local plan = {}
  for k = 0, times - 1 do
    for _, it in ipairs(items) do
      local p0, p1 = item_bounds(it)
      local c0, c1 = p0, p1
      if rs then c0, c1 = math.max(p0, rs), math.min(p1, re) end
      if c1 - c0 > 1e-6 then
        local pos = tm(toq + k * spanq + (qn(c0) - aq))
        plan[#plan + 1] = { src = it, cut0 = c0 - p0, cutEnd = c1 < p1 - 1e-9, keep = c1 - c0, pos = pos,
          track = dest or reaper.GetMediaItem_Track(it), lane = lane_of(it) }
      end
    end
  end
  if #plan > 2000 then fail("INVALID_ARGS", "That would make more than 2000 items.") end
  for i, p in ipairs(plan) do
    local hit = overlapping_on(p.track, p.pos, p.pos + p.keep, nil, p.lane)
    if hit then
      fail("PRECONDITION_FAILED", string.format("%s already has material at %s, so nothing was copied.", track_label(p.track), bars_text(item_bounds(hit))),
        "Copy to a free spot (or another track), or clear that spot first.")
    end
    for j = 1, i - 1 do
      local o = plan[j]
      if o.track == p.track and o.lane == p.lane and o.pos < p.pos + p.keep - 1e-6 and o.pos + o.keep > p.pos + 1e-6 then
        fail("PRECONDITION_FAILED", "The copies would overlap each other.", "Copy to a place at least as far away as the material is long.")
      end
    end
  end
  ctx.change()
  local made, ok = json.array({}), true
  for _, p in ipairs(plan) do
    local it = clone_item(p.src, p.track)
    if not it then
      ok = false
    else
      reaper.SetMediaItemInfo_Value(it, "D_POSITION", p.pos)
      if p.cut0 > 1e-9 or p.cutEnd then
        for ti = 0, reaper.CountTakes(it) - 1 do
          local tk = reaper.GetTake(it, ti)
          if tk then
            local rate = reaper.GetMediaItemTakeInfo_Value(tk, "D_PLAYRATE")
            reaper.SetMediaItemTakeInfo_Value(tk, "D_STARTOFFS", reaper.GetMediaItemTakeInfo_Value(tk, "D_STARTOFFS") + p.cut0 * rate)
          end
        end
        reaper.SetMediaItemInfo_Value(it, "D_LENGTH", p.keep)
        if take_kind(reaper.GetActiveTake(it)) == "audio" then
          -- A short fade where the copy was cut out of a longer item, so it doesn't click.
          if p.cut0 > 1e-9 then reaper.SetMediaItemInfo_Value(it, "D_FADEINLEN", math.min(0.005, p.keep / 4)) end
          if p.cutEnd then reaper.SetMediaItemInfo_Value(it, "D_FADEOUTLEN", math.min(0.005, p.keep / 4)) end
        end
      end
      local q0 = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
      local ql = reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
      if math.abs(q0 - p.pos) > 1e-6 or math.abs(ql - p.keep) > 1e-6 or reaper.GetMediaItem_Track(it) ~= p.track then ok = false end
      made[#made + 1] = item_brief(it)
    end
  end
  reaper.UpdateArrange()
  return verified(ok and #made == #plan, { copies = #made, times = times, items = made }, nil,
    string.format("Made %d cop%s", #made, #made == 1 and "y" or "ies"))
end

local function source_room(take)
  -- Seconds of source available before and after the current window (nil = unlimited, e.g. MIDI or looped).
  if not take or reaper.TakeIsMIDI(take) then return nil end
  local it = reaper.GetMediaItemTake_Item(take)
  if reaper.GetMediaItemInfo_Value(it, "B_LOOPSRC") ~= 0 then return nil end
  return true
end

H.trimItems = function(a, ctx)
  local items = resolve_items(a.items, "items")
  local s, e
  if a.toRange ~= nil then s, e = resolve_range(a.toRange, "toRange") end
  local ns = a.start and place_to_time(a.start, "start") or nil
  local ne = a["end"] and place_to_time(a["end"], "end") or nil
  local plan, warnings = {}, {}
  for _, it in ipairs(items) do
    local p0, p1 = item_bounds(it)
    local n0, n1 = p0, p1
    if s then n0, n1 = math.max(p0, s), math.min(p1, e) else n0, n1 = ns or p0, ne or p1 end
    if n1 - n0 > 1e-6 then
      local take = reaper.GetActiveTake(it)
      if source_room(take) then
        local rate = reaper.GetMediaItemTakeInfo_Value(take, "D_PLAYRATE")
        local offs = reaper.GetMediaItemTakeInfo_Value(take, "D_STARTOFFS")
        local len = reaper.GetMediaSourceLength(reaper.GetMediaItemTake_Source(take))
        local min0 = p0 - offs / rate
        local max1 = p0 + (len - offs) / rate
        if n0 < min0 - 1e-6 then n0 = min0; warnings[#warnings + 1] = "The start was limited to where the recording begins." end
        if n1 > max1 + 1e-6 then n1 = max1; warnings[#warnings + 1] = "The end was limited to where the recording ends." end
      end
      if n1 - n0 > 1e-6 and (math.abs(n0 - p0) > 1e-9 or math.abs(n1 - p1) > 1e-9) then plan[#plan + 1] = { it = it, p0 = p0, n0 = n0, n1 = n1 } end
    end
  end
  if #plan == 0 then fail("PRECONDITION_FAILED", "Nothing to trim: the items already fit, or none overlaps that range.") end
  ctx.change()
  local ok, out = true, json.array({})
  for _, p in ipairs(plan) do
    local d = p.n0 - p.p0
    for ti = 0, reaper.CountTakes(p.it) - 1 do
      local tk = reaper.GetTake(p.it, ti)
      if tk then
        local rate = reaper.GetMediaItemTakeInfo_Value(tk, "D_PLAYRATE")
        reaper.SetMediaItemTakeInfo_Value(tk, "D_STARTOFFS", reaper.GetMediaItemTakeInfo_Value(tk, "D_STARTOFFS") + d * rate)
      end
    end
    reaper.SetMediaItemInfo_Value(p.it, "D_POSITION", p.n0)
    reaper.SetMediaItemInfo_Value(p.it, "D_LENGTH", p.n1 - p.n0)
    local len = p.n1 - p.n0
    for _, k in ipairs({ "D_FADEINLEN", "D_FADEOUTLEN" }) do
      if reaper.GetMediaItemInfo_Value(p.it, k) > len then reaper.SetMediaItemInfo_Value(p.it, k, len / 2) end
    end
    local q0, q1 = item_bounds(p.it)
    if math.abs(q0 - p.n0) > 1e-6 or math.abs(q1 - p.n1) > 1e-6 then ok = false end
    out[#out + 1] = item_brief(p.it)
  end
  reaper.UpdateArrange()
  local dedup, seen = {}, {}
  for _, w in ipairs(warnings) do if not seen[w] then seen[w] = true; dedup[#dedup + 1] = w end end
  return verified(ok, { trimmed = #plan, items = out }, nil, string.format("Trimmed %d item%s", #plan, #plan == 1 and "" or "s"), dedup)
end

local FADE_SHAPES = { linear = 0, ["fast-start"] = 1, ["fast-end"] = 2, ["s-curve"] = 5 }

local function is_reversed(take)
  if not take then return false end
  local _, _, _, rev = reaper.PCM_Source_GetSectionInfo(reaper.GetMediaItemTake_Source(take))
  return rev == true
end

H.setItemProperties = function(a, ctx)
  local items = resolve_items(a.items, "items")
  local gain = opt(a.gainDb, arg_number, "gainDb", -150, 24)
  local change = opt(a.changeGainDb, arg_number, "changeGainDb", -48, 24)
  local fin = opt(a.fadeInMs, arg_number, "fadeInMs", 0, 600000)
  local fout = opt(a.fadeOutMs, arg_number, "fadeOutMs", 0, 600000)
  local shape = nil
  if a.fadeShape ~= nil then
    shape = FADE_SHAPES[a.fadeShape]
    if not shape then fail("INVALID_ARGS", "fadeShape must be linear, fast-start, fast-end or s-curve") end
  end
  local pitch = opt(a.pitchSemitones, arg_number, "pitchSemitones", -48, 48)
  local rate = opt(a.playrate, arg_number, "playrate", 0.1, 10)
  local pp = opt(a.preservePitch, arg_bool, "preservePitch")
  local rev = opt(a.reversed, arg_bool, "reversed")
  local mute = opt(a.muted, arg_bool, "muted")
  local name = a.name and arg_string(a.name, "name", 256) or nil
  ctx.change()
  local expect = {}
  local to_reverse = {}
  for _, it in ipairs(items) do
    local take = reaper.GetActiveTake(it)
    local x = { it = it }
    if gain then reaper.SetMediaItemInfo_Value(it, "D_VOL", db_to_gain(gain)) end
    if change then reaper.SetMediaItemInfo_Value(it, "D_VOL", reaper.GetMediaItemInfo_Value(it, "D_VOL") * db_to_gain(change)) end
    x.vol = reaper.GetMediaItemInfo_Value(it, "D_VOL")
    local len = reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
    if fin then reaper.SetMediaItemInfo_Value(it, "D_FADEINLEN", math.min(fin / 1000, len)); x.fin = math.min(fin / 1000, len) end
    if fout then reaper.SetMediaItemInfo_Value(it, "D_FADEOUTLEN", math.min(fout / 1000, len)); x.fout = math.min(fout / 1000, len) end
    if shape then
      if fin or not fout then reaper.SetMediaItemInfo_Value(it, "C_FADEINSHAPE", shape) end
      if fout or not fin then reaper.SetMediaItemInfo_Value(it, "C_FADEOUTSHAPE", shape) end
    end
    if mute ~= nil then reaper.SetMediaItemInfo_Value(it, "B_MUTE", mute and 1 or 0) end
    if take then
      if pitch then reaper.SetMediaItemTakeInfo_Value(take, "D_PITCH", pitch) end
      if pp ~= nil then reaper.SetMediaItemTakeInfo_Value(take, "B_PPITCH", pp and 1 or 0) end
      if rate then
        local old = reaper.GetMediaItemTakeInfo_Value(take, "D_PLAYRATE")
        reaper.SetMediaItemTakeInfo_Value(take, "D_PLAYRATE", rate)
        -- Keep the same stretch of audio: the item gets shorter when it plays faster.
        reaper.SetMediaItemInfo_Value(it, "D_LENGTH", len * old / rate)
      end
      if name then reaper.GetSetMediaItemTakeInfo_String(take, "P_NAME", name, true) end
      if rev ~= nil and is_reversed(take) ~= rev and not reaper.TakeIsMIDI(take) then to_reverse[#to_reverse + 1] = it end
    end
    expect[#expect + 1] = x
  end
  if #to_reverse > 0 then
    with_selection(function()
      select_only_items(to_reverse)
      reaper.Main_OnCommand(41051, 0) -- Item properties: Toggle take reverse
    end)
  end
  reaper.UpdateArrange()
  local ok = true
  local out = json.array({})
  for _, x in ipairs(expect) do
    local it = x.it
    local take = reaper.GetActiveTake(it)
    if math.abs(reaper.GetMediaItemInfo_Value(it, "D_VOL") - x.vol) > 1e-6 then ok = false end
    if x.fin and math.abs(reaper.GetMediaItemInfo_Value(it, "D_FADEINLEN") - x.fin) > 1e-6 then ok = false end
    if x.fout and math.abs(reaper.GetMediaItemInfo_Value(it, "D_FADEOUTLEN") - x.fout) > 1e-6 then ok = false end
    if mute ~= nil and (reaper.GetMediaItemInfo_Value(it, "B_MUTE") ~= 0) ~= mute then ok = false end
    if take then
      if pitch and math.abs(reaper.GetMediaItemTakeInfo_Value(take, "D_PITCH") - pitch) > 1e-6 then ok = false end
      if rate and math.abs(reaper.GetMediaItemTakeInfo_Value(take, "D_PLAYRATE") - rate) > 1e-6 then ok = false end
      if rev ~= nil and not reaper.TakeIsMIDI(take) and is_reversed(take) ~= rev then ok = false end
    end
    out[#out + 1] = item_detail(it)
  end
  return verified(ok, { items = out }, nil, string.format("Updated %d item%s", #expect, #expect == 1 and "" or "s"))
end

H.glueItems = function(a, ctx)
  local items = resolve_items(a.items, "items")
  require_stopped("gluing")
  local tr = reaper.GetMediaItem_Track(items[1])
  local p0, p1 = math.huge, -math.huge
  for _, it in ipairs(items) do
    if reaper.GetMediaItem_Track(it) ~= tr then fail("INVALID_ARGS", "Glue items on one track at a time.") end
    local n = reaper.CountTakes(it)
    if n > 1 then
      fail("PRECONDITION_FAILED", string.format("An item at %s has %d takes; gluing would keep only the active one.", bars_text(item_bounds(it)), n),
        "Choose the take you want (chooseTake), and crop the item to it in REAPER first if you really want to glue.")
    end
    local a0, b0 = item_bounds(it)
    p0, p1 = math.min(p0, a0), math.max(p1, b0)
  end
  ctx.change()
  local glued = with_selection(function()
    select_only_items(items)
    reaper.Main_OnCommand(40362, 0) -- Item: Glue items, ignoring time selection
    return selected_items()
  end)
  local new = glued and glued[1]
  local ok = new ~= nil and #glued == 1
  local gone = 0
  for _, it in ipairs(items) do if not reaper.ValidatePtr2(0, it, "MediaItem*") then gone = gone + 1 end end
  if ok then
    local a0, b0 = item_bounds(new)
    ok = math.abs(a0 - p0) < 1e-3 and math.abs(b0 - p1) < 1e-3
  end
  return verified(ok, { item = new and item_brief(new) or json.null, glued = #items, replaced = gone }, nil,
    string.format("Glued %d item%s on %s", #items, #items == 1 and "" or "s", track_label(tr)))
end

H.chooseTake = function(a, ctx)
  if a.itemId ~= nil then
    local it = find_item(a.itemId)
    if not it then fail("ITEM_NOT_FOUND", "That item no longer exists.") end
    local idx = arg_int(a.takeIndex, "takeIndex", 0, 1023)
    local take = reaper.GetTake(it, idx)
    if not take then fail("TAKE_NOT_FOUND", string.format("That item has %d take%s.", reaper.CountTakes(it), reaper.CountTakes(it) == 1 and "" or "s")) end
    ctx.change()
    reaper.SetActiveTake(take)
    reaper.UpdateArrange()
    return verified(reaper.GetActiveTake(it) == take, { itemId = item_guid(it), takeIndex = idx, takeName = take_name(take), takes = reaper.CountTakes(it) }, nil,
      string.format("Take %d (“%s”) now plays", idx + 1, take_name(take)))
  end
  local tr = find_track(a.track)
  local lane = arg_int(a.lane, "lane", 0, 1023)
  if reaper.GetMediaTrackInfo_Value(tr, "I_FREEMODE") ~= 2 then
    fail("PRECONDITION_FAILED", track_label(tr) .. " does not use fixed lanes.", "Use itemId + takeIndex for takes inside an item.")
  end
  local count = math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_NUMFIXEDLANES"))
  if lane >= count then fail("TAKE_NOT_FOUND", string.format("%s has %d lane%s.", track_label(tr), count, count == 1 and "" or "s")) end
  ctx.change()
  reaper.SetMediaTrackInfo_Value(tr, "C_LANEPLAYS:" .. lane, 1)
  reaper.UpdateArrange()
  return verified(reaper.GetMediaTrackInfo_Value(tr, "C_LANEPLAYS:" .. lane) == 1, { trackId = track_guid(tr), lane = lane, lanes = count }, nil,
    string.format("Lane %d plays on %s", lane + 1, track_label(tr)))
end

local FREEZE = { stereo = 41223, mono = 40901, multichannel = 40877 }

H.freezeTrack = function(a, ctx)
  local tr = find_track(a.track)
  local want = arg_bool(a.frozen, "frozen")
  require_stopped("freezing")
  local before = math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_FREEZECOUNT"))
  if want then
    local action = FREEZE[a.channels or "stereo"]
    if not action then fail("INVALID_ARGS", "channels must be stereo, mono or multichannel") end
    ctx.change()
    with_selection(function()
      select_only_tracks({ tr })
      reaper.Main_OnCommand(action, 0)
    end)
  else
    if before == 0 then return verified(true, { trackId = track_guid(tr), frozen = false }, nil, track_label(tr) .. " is not frozen") end
    ctx.change()
    with_selection(function()
      select_only_tracks({ tr })
      reaper.Main_OnCommand(41644, 0) -- Track: Unfreeze tracks
    end)
  end
  local after = math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_FREEZECOUNT"))
  local ok = want and after > before or (not want and after < before)
  return verified(ok, { trackId = track_guid(tr), frozen = after > 0, freezeLevels = after }, nil,
    (want and "Froze " or "Unfroze ") .. track_label(tr))
end

------------------------------------------------------------------------------
-- 0.4 handlers: MIDI edits
------------------------------------------------------------------------------
H.editNotes = function(a, ctx)
  local list, total, s, e = resolve_notes(a.notes, "notes")
  if total == 0 then
    fail("NOTES_NOT_FOUND", "No notes match" .. where_text(s, e) .. ".", "Check the track, bars and pitch filter (readMidiNotes shows what is there).")
  end
  local scale = nil
  if a.toScale ~= nil then
    arg_table(a.toScale, "toScale")
    local root = TONICS[a.toScale.tonic]
    local steps = SCALES[a.toScale.mode]
    if not root or not steps then fail("INVALID_ARGS", "toScale needs a tonic like C or F# and a mode like minor") end
    scale = {}
    for _, st in ipairs(steps) do scale[(root + st) % 12] = true end
  end
  local transpose = opt(a.transpose, arg_int, "transpose", -48, 48)
  local q = a.quantize and arg_table(a.quantize, "quantize") or nil
  if q then
    arg_number(q.gridBeats, "quantize.gridBeats", 1 / 64, 4)
    opt(q.strength, arg_number, "quantize.strength", 0, 1)
    opt(q.swing, arg_number, "quantize.swing", 50, 75)
  end
  local len = a.length and arg_table(a.length, "length") or nil
  local vel = a.velocity and arg_table(a.velocity, "velocity") or nil
  local hum = a.humanize and arg_table(a.humanize, "humanize") or nil
  if not (scale or transpose or q or len or vel or hum) then fail("INVALID_ARGS", "Give at least one edit") end
  ctx.change()
  local changed, clamped = 0, 0
  local warnings = {}
  local r = hum and rng(hum.seed or (os.time() % 100000 + 1)) or nil
  for _, t in ipairs(list) do
    local take = t.take
    local ns = {}
    for _, i in ipairs(t.idx) do
      local _, _, _, sppq, eppq, _, pitch, v = reaper.MIDI_GetNote(take, i)
      ns[#ns + 1] = { i = i, sq = reaper.MIDI_GetProjQNFromPPQPos(take, sppq), eq = reaper.MIDI_GetProjQNFromPPQPos(take, eppq), pitch = pitch, vel = v, o = { sppq, eppq, pitch, v } }
    end
    table.sort(ns, function(x, y) if x.sq ~= y.sq then return x.sq < y.sq end return x.pitch < y.pitch end)
    for _, n in ipairs(ns) do
      if scale then n.pitch = snap_to_scale(n.pitch, scale) end
      if transpose then
        local p = n.pitch + transpose
        if p < 0 or p > 127 then clamped = clamped + 1; p = math.max(0, math.min(127, p)) end
        n.pitch = p
      end
      if q then
        local g, st = q.gridBeats, q.strength or 1
        local d = (quant_target(n.sq, g, q.swing) - n.sq) * st
        n.sq, n.eq = n.sq + d, n.eq + d
        if q.ends then
          local ee = n.eq + (quant_target(n.eq, g, q.swing) - n.eq) * st
          if ee > n.sq + 1e-4 then n.eq = ee end
        end
      end
    end
    if len then
      if len.legato then
        for k, n in ipairs(ns) do
          for m = k + 1, #ns do
            if ns[m].sq > n.sq + 1e-4 then n.eq = ns[m].sq; break end
          end
        end
      elseif len.beats ~= nil then
        local b = arg_number(len.beats, "length.beats", 1 / 64, 64)
        for _, n in ipairs(ns) do n.eq = n.sq + b end
      elseif len.scalePercent ~= nil then
        local f = arg_number(len.scalePercent, "length.scalePercent", 1, 1000) / 100
        for _, n in ipairs(ns) do n.eq = n.sq + (n.eq - n.sq) * f end
      else
        fail("INVALID_ARGS", "length must give beats, scalePercent or legato")
      end
    end
    if vel then
      local function clampv(v) return math.max(1, math.min(127, math.floor(v + 0.5))) end
      if vel.set ~= nil then
        local v = arg_int(vel.set, "velocity.set", 1, 127)
        for _, n in ipairs(ns) do n.vel = v end
      elseif vel.change ~= nil then
        local d = arg_int(vel.change, "velocity.change", -126, 126)
        for _, n in ipairs(ns) do n.vel = clampv(n.vel + d) end
      elseif vel.scalePercent ~= nil then
        local f = arg_number(vel.scalePercent, "velocity.scalePercent", 1, 400) / 100
        for _, n in ipairs(ns) do n.vel = clampv(n.vel * f) end
      elseif vel.compressTo ~= nil then
        local lo = arg_int(vel.compressTo.min, "velocity.compressTo.min", 1, 127)
        local hi = arg_int(vel.compressTo.max, "velocity.compressTo.max", 1, 127)
        local mn, mx = 127, 1
        for _, n in ipairs(ns) do mn, mx = math.min(mn, n.vel), math.max(mx, n.vel) end
        for _, n in ipairs(ns) do
          n.vel = (mx == mn) and clampv((lo + hi) / 2) or clampv(lo + (n.vel - mn) * (hi - lo) / (mx - mn))
        end
      elseif vel.ramp ~= nil then
        local v0 = arg_int(vel.ramp.from, "velocity.ramp.from", 1, 127)
        local v1 = arg_int(vel.ramp.to, "velocity.ramp.to", 1, 127)
        local first, last = ns[1].sq, ns[#ns].sq
        for _, n in ipairs(ns) do
          n.vel = (last - first < 1e-9) and v0 or clampv(v0 + (v1 - v0) * (n.sq - first) / (last - first))
        end
      else
        fail("INVALID_ARGS", "velocity must give set, change, scalePercent, compressTo or ramp")
      end
    end
    if hum then
      local tms = opt(hum.timingMs, arg_number, "humanize.timingMs", 0, 50) or 0
      local vamt = opt(hum.velocity, arg_int, "humanize.velocity", 0, 40) or 0
      for _, n in ipairs(ns) do
        if tms > 0 then
          local t0 = tm(n.sq)
          local shifted = qn(math.max(0, t0 + (r() * 2 - 1) * tms / 1000))
          local d = shifted - n.sq
          n.sq, n.eq = n.sq + d, n.eq + d
        end
        if vamt > 0 then n.vel = math.max(1, math.min(127, n.vel + math.floor((r() * 2 - 1) * vamt + 0.5))) end
      end
    end
    -- REAPER cuts notes at the clip's end, so a note that ended inside the clip stays inside it.
    local item = reaper.GetMediaItemTake_Item(take)
    local clip_end = reaper.MIDI_GetPPQPosFromProjTime(take, reaper.GetMediaItemInfo_Value(item, "D_POSITION") + reaper.GetMediaItemInfo_Value(item, "D_LENGTH"))
    for _, n in ipairs(ns) do
      local np = reaper.MIDI_GetPPQPosFromProjQN(take, n.sq)
      local ne = reaper.MIDI_GetPPQPosFromProjQN(take, n.eq)
      if ne > clip_end and n.o[2] <= clip_end + 0.5 then ne = clip_end end
      if ne < np + 1 then ne = np + 1 end
      n.np, n.ne = np, ne
    end
    -- Same-pitch notes must not run into each other (REAPER would merge or cut them): a moved note
    -- starts no earlier than the end of the same-pitch note before it and ends before the next one.
    local edited, others = {}, {}
    for _, n in ipairs(ns) do edited[n.i] = true end
    local _, cnt = reaper.MIDI_CountEvts(take)
    for i = 0, cnt - 1 do
      if not edited[i] then
        local _, _, _, sp, ep, _, pitch = reaper.MIDI_GetNote(take, i)
        others[#others + 1] = { s = sp, e = ep, os = sp, pitch = pitch }
      end
    end
    for _, n in ipairs(ns) do others[#others + 1] = { s = n.np, e = n.ne, os = n.o[1], pitch = n.pitch, n = n } end
    for _, n in ipairs(ns) do
      for _, o in ipairs(others) do
        if o.n ~= n and o.pitch == n.pitch then
          if o.os < n.o[1] and o.e > n.np and o.s < n.np then n.np = o.e end
          if o.os > n.o[1] and n.ne > o.s and n.np < o.s then n.ne = o.s end
        end
      end
      if n.ne < n.np + 1 then n.ne = n.np + 1 end
    end
    for _, n in ipairs(ns) do
      local np, ne = n.np, n.ne
      if math.abs(np - n.o[1]) > 0.5 or math.abs(ne - n.o[2]) > 0.5 or n.pitch ~= n.o[3] or n.vel ~= n.o[4] then changed = changed + 1 end
      reaper.MIDI_SetNote(take, n.i, nil, nil, np, ne, nil, n.pitch, n.vel, true)
    end
    reaper.MIDI_Sort(take)
    t.ns = ns
  end
  -- Read back: every edited note must be in its clip with its new pitch, velocity and timing.
  local ok, missing = true, {}
  for _, t in ipairs(list) do
    local _, cnt = reaper.MIDI_CountEvts(t.take)
    local have = {}
    for i = 0, cnt - 1 do
      local _, _, _, sppq, eppq, _, pitch, v = reaper.MIDI_GetNote(t.take, i)
      local key = pitch * 128 + v
      have[key] = have[key] or {}
      local h = have[key]
      h[#h + 1] = { sppq, eppq }
    end
    for _, n in ipairs(t.ns) do
      local found = false
      for _, h in ipairs(have[n.pitch * 128 + n.vel] or {}) do
        if math.abs(h[1] - n.np) <= 1.01 and math.abs(h[2] - n.ne) <= 1.01 then found = true; break end
      end
      if not found then
        ok = false
        if #missing < 5 then
          missing[#missing + 1] = string.format("%s %s v%d", clock_label(reaper.MIDI_GetProjTimeFromPPQPos(t.take, n.np)), pitch_name(n.pitch), n.vel)
        end
      end
    end
  end
  if #missing > 0 then warnings[#warnings + 1] = "Not found after the edit: " .. table.concat(missing, ", ") .. "." end
  if clamped > 0 then warnings[#warnings + 1] = string.format("%d note%s hit the edge of the MIDI range and were clamped.", clamped, clamped == 1 and "" or "s") end
  return verified(ok, { notes = total, changed = changed, clips = #list, range = s and span_json(s, e) or json.null }, nil,
    string.format("Edited %d note%s%s (%d changed)", total, total == 1 and "" or "s", where_text(s, e), changed), warnings)
end

H.deleteNotes = function(a, ctx)
  local list, total, s, e = resolve_notes(a.notes, "notes")
  if total == 0 then fail("NOTES_NOT_FOUND", "No notes match" .. where_text(s, e) .. ", so nothing was deleted.") end
  ctx.change()
  local ok = true
  for _, t in ipairs(list) do
    local _, before = reaper.MIDI_CountEvts(t.take)
    table.sort(t.idx, function(x, y) return x > y end)
    for _, i in ipairs(t.idx) do reaper.MIDI_DeleteNote(t.take, i) end
    reaper.MIDI_Sort(t.take)
    local _, after = reaper.MIDI_CountEvts(t.take)
    if before - after ~= #t.idx then ok = false end
  end
  return verified(ok, { deleted = total, clips = #list, range = s and span_json(s, e) or json.null }, nil,
    string.format("Deleted %d note%s%s", total, total == 1 and "" or "s", where_text(s, e)))
end

------------------------------------------------------------------------------
-- 0.4 handlers: automation
------------------------------------------------------------------------------
local LFO = {
  sine = function(ph) return 0.5 - 0.5 * math.cos(2 * math.pi * ph) end,
  triangle = function(ph) return ph < 0.5 and ph * 2 or 2 - ph * 2 end,
  ["saw-up"] = function(ph) return ph end,
  ["saw-down"] = function(ph) return 1 - ph end,
  square = function(ph) return ph < 0.5 and 1 or 0 end,
}

H.writeAutomation = function(a, ctx)
  local tr = find_track(a.track)
  local s, e = resolve_range(a.range, "range")
  local shape = a.shape
  if shape ~= "set" and shape ~= "ramp" and shape ~= "points" and shape ~= "lfo" and shape ~= "clear" then
    fail("INVALID_ARGS", "shape must be set, ramp, points, lfo or clear")
  end
  -- Validate everything before the envelope is created or changed.
  local function want(v, name) return arg_number(v, name, -150, 24) end
  local pts = {}
  if shape == "set" then
    local v = want(a.value, "value")
    pts = { { s, v }, { e, v } }
  elseif shape == "ramp" then
    pts = { { s, want(a.from, "from") }, { e, want(a.to, "to") } }
  elseif shape == "points" then
    for i, p in ipairs(arg_table(a.points, "points")) do
      arg_table(p, "points[" .. i .. "]")
      local t = place_to_time(p.at, "points[" .. i .. "].at")
      if t < s - 1e-6 or t > e + 1e-6 then fail("INVALID_ARGS", string.format("Point %d is outside the range (%s).", i, bars_text(s, e))) end
      pts[#pts + 1] = { t, want(p.value, "points[" .. i .. "].value") }
    end
    table.sort(pts, function(x, y) return x[1] < y[1] end)
  elseif shape == "lfo" then
    local l = arg_table(a.lfo, "lfo")
    local f = LFO[l.wave]
    if not f then fail("INVALID_ARGS", "lfo.wave must be sine, triangle, saw-up, saw-down or square") end
    local per = arg_number(l.periodBeats, "lfo.periodBeats", 1 / 16, 64)
    local lo, hi = want(l.low, "lfo.low"), want(l.high, "lfo.high")
    local q0, q1 = qn(s), qn(e)
    local per_steps = (l.wave == "sine" or l.wave == "triangle") and 16 or 2
    if (q1 - q0) / per * per_steps > 4000 then fail("INVALID_ARGS", "That LFO would need too many points; use a longer period or a shorter range.") end
    local k = 0
    while true do
      local cq = q0 + k * per / per_steps
      if cq > q1 + 1e-9 then break end
      local ph = ((cq - q0) / per) % 1
      if l.wave == "square" then
        local t = tm(cq)
        pts[#pts + 1] = { t, lo + (hi - lo) * f(ph), 1 } -- square shape: hold until the next point
      elseif l.wave == "saw-up" or l.wave == "saw-down" then
        local t = tm(cq)
        pts[#pts + 1] = { t, lo + (hi - lo) * f(0) }
        local tend = math.min(tm(cq + per) - 0.0005, e)
        if tend > t then pts[#pts + 1] = { tend, lo + (hi - lo) * f(1) } end
        k = k + 1 -- one cycle per step pair
      else
        pts[#pts + 1] = { tm(cq), lo + (hi - lo) * f(ph) }
      end
      k = k + 1
    end
  end
  ctx.change()
  local env, kind, fx, p = find_envelope(tr, a.envelope, true)
  if not env then fail("DAW_ERROR", "REAPER did not create the envelope.") end
  reaper.GetSetEnvelopeInfo_String(env, "ACTIVE", "1", true)
  reaper.GetSetEnvelopeInfo_String(env, "VISIBLE", "1", true)
  local raw_pts = {}
  for i, pt in ipairs(pts) do raw_pts[i] = { pt[1], to_raw(env, kind, pt[2], tr, fx, p), pt[3] or 0 } end
  local pad = 0.0005
  local before_s = env_value_at(env, s - pad * 2)
  local edge_s, edge_e = env_value_at(env, s), env_value_at(env, e)
  local outside_after = env_value_at(env, e + pad * 2)
  reaper.DeleteEnvelopePointRange(env, s - 1e-7, e + 1e-7)
  -- Guards keep everything outside the range exactly as it was. At the project start there is
  -- nothing before the range, so the new shape starts right at 0.
  local at_start = s < pad * 2
  if not at_start then reaper.InsertEnvelopePoint(env, s, edge_s, 0, 0, false, true) end
  reaper.InsertEnvelopePoint(env, e, edge_e, 0, 0, false, true)
  for _, rp in ipairs(raw_pts) do
    local t = math.max(at_start and s or s + pad, math.min(e - pad, rp[1]))
    reaper.InsertEnvelopePoint(env, t, rp[2], rp[3], 0, false, true)
  end
  reaper.Envelope_SortPoints(env)
  reaper.UpdateArrange()
  -- Read back.
  local ok = (at_start or math.abs(env_value_at(env, s - pad * 2) - before_s) < 1e-6) and math.abs(env_value_at(env, e + pad * 2) - outside_after) < 1e-6
  if shape == "set" or shape == "ramp" then
    local v0 = from_raw(env, kind, env_value_at(env, s + pad * 2), tr, fx, p)
    local v1 = from_raw(env, kind, env_value_at(env, e - pad * 2), tr, fx, p)
    local tol = kind == "volume" and 0.2 or 0.02
    local w0, w1 = pts[1][2], pts[#pts][2]
    if kind == "volume" and w0 <= -100 then w0 = v0 end
    if kind == "volume" and w1 <= -100 then w1 = v1 end
    if kind == "mute" then w0, w1 = w0 >= 0.5 and 1 or 0, w1 >= 0.5 and 1 or 0 end
    if math.abs(v0 - w0) > tol or math.abs(v1 - w1) > tol then ok = false end
  end
  local items = reaper.CountAutomationItems(env)
  local warnings = {}
  if items > 0 then warnings[1] = "This envelope has automation items; where they overlap the range, they play instead of these points." end
  local mode = math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_AUTOMODE"))
  if mode >= 2 then warnings[#warnings + 1] = "The track is in " .. (AUTOMODES[mode] or "write") .. " mode; switch to read if you don't want playback to overwrite this." end
  local _, ename = reaper.GetEnvelopeName(env)
  return verified(ok, { track = track_label(tr), envelope = ename, kind = kind, points = #pts, range = span_json(s, e) }, nil,
    string.format("%s automation on %s, %s: %s", ename, track_label(tr), bars_text(s, e), shape), warnings)
end

------------------------------------------------------------------------------
-- 0.4 handlers: recording settings
------------------------------------------------------------------------------
H.setRecordMode = function(a)
  local mode = a.mode
  local actions = { normal = ACTIONS.recmode_normal, ["time-selection-punch"] = ACTIONS.recmode_timesel_punch, ["item-punch"] = ACTIONS.recmode_item_punch }
  if not actions[mode] then fail("INVALID_ARGS", "mode must be normal, time-selection-punch or item-punch") end
  local data = {}
  if a.range ~= nil then
    if mode ~= "time-selection-punch" then fail("INVALID_ARGS", "range only applies to time-selection-punch") end
    local s, e = resolve_range(a.range, "range")
    reaper.GetSet_LoopTimeRange2(0, true, false, s, e, false)
  end
  reaper.Main_OnCommand(actions[mode], 0)
  local warnings = {}
  local ts, te = reaper.GetSet_LoopTimeRange2(0, false, false, 0, 0, false)
  if mode == "time-selection-punch" then
    if te <= ts then warnings[1] = "There is no time selection yet; recording only happens inside one." end
    data.punch = te > ts and span_json(ts, te) or json.null
  elseif mode == "item-punch" and reaper.CountSelectedMediaItems(0) == 0 then
    warnings[1] = "No items are selected; item punch records only over selected items."
  end
  data.recordMode = record_mode()
  return verified(data.recordMode == mode, data, nil, "Record mode: " .. data.recordMode .. (data.punch and data.punch ~= json.null and (" (" .. data.punch.label .. ")") or ""), warnings)
end

H.setPreroll = function(a)
  local function set(id, on)
    if on == nil then return end
    if (toggle(id) == 1) ~= on then reaper.Main_OnCommand(id, 0) end
  end
  set(41819, opt(a.record, arg_bool, "record"))
  set(41818, opt(a.play, arg_bool, "play"))
  local bars = opt(a.bars, arg_number, "bars", 0, 16)
  if bars then reaper.set_config_var_string("prerollmeas", fmt_num(bars), 0) end
  local st = { record = toggle(41819) == 1, play = toggle(41818) == 1, bars = cfg_num("prerollmeas") or json.null }
  local ok = (a.record == nil or st.record == a.record) and (a.play == nil or st.play == a.play) and (not bars or (st.bars ~= json.null and math.abs(st.bars - bars) < 1e-6))
  return verified(ok, st, nil, string.format("Pre-roll: record %s, play %s, %s bar%s", st.record and "on" or "off", st.play and "on" or "off",
    st.bars ~= json.null and fmt_num(st.bars) or "?", st.bars == 1 and "" or "s"))
end

end -- 0.4 section

------------------------------------------------------------------------------
-- Request dispatch
------------------------------------------------------------------------------
local UNDOABLE = {
  setTempo = true, setTimeSignature = true, addMarker = true, addRegion = true, markTake = true,
  createTrack = true, renameTrack = true, setTrackInput = true, armTrack = true, setMonitoring = true,
  setTrackChannelCount = true, setTrackVolume = true, setTrackPan = true, setTrackMute = true, setTrackSolo = true,
  createMidiClip = true, insertMidiNotes = true, quantizeMidiClip = true, addFx = true, setFxParameter = true,
  setFxEnabled = true, createSend = true, configureSidechain = true,
  -- 0.4
  splitItems = true, moveItems = true, copyItems = true, trimItems = true, setItemProperties = true, glueItems = true,
  editNotes = true, deleteNotes = true, writeAutomation = true, chooseTake = true, freezeTrack = true,
}
K.UNDOABLE = UNDOABLE

-- Codes that mean "nothing was attempted: change the request" rather than "it went wrong".
local REJECTED = {
  INVALID_ARGS = true, PRECONDITION_FAILED = true, RECORDING_IN_PROGRESS = true, UNDO_MISMATCH = true, AMBIGUOUS_TARGET = true,
  NOTHING_SELECTED = true, SECTION_NOT_FOUND = true, ITEM_NOT_FOUND = true, NOTES_NOT_FOUND = true, TAKE_NOT_FOUND = true,
}

local function error_result(e)
  if is_fail(e) then
    return { status = (e.code == "UNSUPPORTED") and "unsupported" or (REJECTED[e.code] and "rejected" or "failed"),
      error = { code = e.code, message = e.message, hint = e.hint, details = e.details } }
  end
  return { status = "failed", error = { code = "DAW_ERROR", message = "Bridge error: " .. tostring(e) } }
end

-- Reads: any undo step that appears while one runs is taken back.
local READ_ONLY = {
  findActions = true,
  analyzeAudio = true, getSelection = true, getSessionContext = true, listTrackItems = true, getTrackDetails = true,
  readMidiNotes = true, readAutomation = true, getRecordingSetup = true, getProjectState = true, checkInputLevels = true,
}

-- Runs one undoable-or-not command synchronously inside (at most) one undo block.
-- Returns result (table or pending), undo_label_used.
local function run_handler(name, args, undo_label, block)
  local h = H[name]
  if not h then return { status = "unsupported", error = { code = "UNSUPPORTED", message = "The REAPER bridge does not implement " .. tostring(name) } } end
  local opened = false
  local ctx = {
    change = function()
      if block and not block.opened then
        reaper.Undo_BeginBlock2(0)
        block.opened = true
      elseif not block and UNDOABLE[name] and not opened then
        reaper.Undo_BeginBlock2(0)
        opened = true
      end
    end,
  }
  local top_before = READ_ONLY[name] and (reaper.Undo_CanUndo2(0) or "") or nil
  reaper.PreventUIRefresh(1)
  local ok, res = pcall(h, args or {}, ctx)
  reaper.PreventUIRefresh(-1)
  if top_before ~= nil and (reaper.Undo_CanUndo2(0) or "") ~= top_before then
    -- A read must not leave an undo step (REAPER's dry-run render adds "Unselect all items"),
    -- or the user's last change could no longer be undone by name. Nothing else runs meanwhile.
    reaper.Undo_DoUndo2(0)
  end
  if opened then
    reaper.Undo_EndBlock2(0, undo_label, -1)
    if not ok then
      -- Transactional: a failed command leaves nothing half-done.
      local rolled = reaper.Undo_CanUndo2(0) == undo_label and reaper.Undo_DoUndo2(0) ~= 0
      local r = error_result(res)
      r.rolledBack = rolled
      return r
    end
    if type(res) == "table" and not is_pending(res) and (res.status == "verified" or res.status == "unverified") then
      res.undoLabel = undo_label
    end
  end
  if not ok then return error_result(res) end
  return res
end
K.run_handler = run_handler

local function run_batch(req)
  local cmds = req.commands
  if type(cmds) ~= "table" or #cmds == 0 or #cmds > 200 then
    return { status = "rejected", error = { code = "INVALID_ARGS", message = "batch.commands must hold 1 to 200 commands" } }
  end
  for _, c in ipairs(cmds) do
    if type(c) ~= "table" or not UNDOABLE[c.command] then
      return { status = "rejected", error = { code = "INVALID_ARGS", message = "Only undoable editing commands can be batched: " .. tostring(c and c.command) } }
    end
  end
  local label = type(req.undoLabel) == "string" and req.undoLabel or "Assist: batch"
  local block = { opened = false }
  local results = json.array({})
  batch_results = results
  local failed_at = nil
  reaper.PreventUIRefresh(1)
  for i, c in ipairs(cmds) do
    local r = run_handler(c.command, c.args, label, block)
    if is_pending(r) then r = { status = "failed", error = { code = "INTERNAL", message = "Command cannot run in a batch" } } end
    r.command = c.command
    results[i] = r
    if r.status ~= "verified" and r.status ~= "unverified" and r.status ~= "ok" then failed_at = i; break end
  end
  reaper.PreventUIRefresh(-1)
  batch_results = nil
  local rolled = false
  if block.opened then
    reaper.Undo_EndBlock2(0, label, -1)
    if failed_at and req.atomic ~= false then
      rolled = reaper.Undo_CanUndo2(0) == label and reaper.Undo_DoUndo2(0) ~= 0
    end
  end
  for i = (failed_at or #cmds) + 1, #cmds do
    results[i] = { status = "skipped", command = cmds[i].command, message = "Not run because an earlier command failed" }
  end
  local status = failed_at and "failed" or "verified"
  if not failed_at then
    for _, r in ipairs(results) do if r.status == "unverified" then status = "unverified" end end
  end
  return { status = status, data = { results = results, rolledBack = rolled }, undoLabel = (block.opened and not rolled) and label or nil }
end

------------------------------------------------------------------------------
-- Bridge runtime: directories, heartbeat, request loop
------------------------------------------------------------------------------
local B = { dir = nil, pending = nil, seen = {}, seen_order = {}, journal_ids = {}, seq = 0, last_status = 0, last_poll = 0, started_ms = 0, last_ps = 0 }
K.B = B

local ID_PATTERN = "^[%w_%-]+$"

local function new_session_id()
  math.randomseed(math.floor(reaper.time_precise() * 1e6) % 2147483647 + os.time())
  local t = {}
  for i = 1, 16 do t[i] = string.format("%x", math.random(0, 15)) end
  return table.concat(t)
end

local function remember(id, response_json, status)
  if not B.seen[id] then
    B.seen_order[#B.seen_order + 1] = id
    if #B.seen_order > 500 then
      local old = table.remove(B.seen_order, 1)
      B.seen[old] = nil
    end
  end
  B.seen[id] = response_json
  local f = io.open(join(B.dir, "journal.log"), "a")
  if f then f:write(id, " ", status or "?", " ", K.session, "\n"); f:close() end
end

local function load_journal()
  local data = read_file(join(B.dir, "journal.log"))
  if not data then return end
  local lines = {}
  for line in data:gmatch("[^\n]+") do lines[#lines + 1] = line end
  -- Keep the journal bounded: rewrite it with the last 2000 entries.
  local first = math.max(1, #lines - 2000 + 1)
  for i = first, #lines do
    local id = lines[i]:match("^(%S+)")
    if id then B.journal_ids[id] = true end
  end
  if #lines > 4000 then
    local f = io.open(join(B.dir, "journal.log"), "w")
    if f then
      for i = first, #lines do f:write(lines[i], "\n") end
      f:close()
    end
  end
end

local function respond(id, req, result, started)
  result.id = id
  result.v = 1
  result.session = K.session
  result.command = result.command or (req and req.command) or json.null
  result.kind = req and req.kind or json.null
  result.durationMs = math.floor((reaper.time_precise() - started) * 1000)
  local ok, data = pcall(json.encode, result)
  if not ok then
    data = json.encode({ v = 1, id = id, session = K.session, status = "failed", error = { code = "INTERNAL", message = "Could not encode the result: " .. tostring(data) } })
  end
  write_atomic(join(B.dir, "tmp"), join(B.dir, "outbox", id .. ".json"), data)
  remember(id, data, result.status)
  os.remove(join(B.dir, "processing", id .. ".json"))
end

local function reject(id, req, code, message, hint, started)
  respond(id, req, { status = "rejected", error = { code = code, message = message, hint = hint } }, started)
end

local function hello()
  return read_ok({
    bridge = "reaper-assist", bridgeVersion = BRIDGE_VERSION, protocol = PROTOCOL, session = K.session,
    reaperVersion = reaper.GetAppVersion(), projectKey = project_key(),
    commands = (function() local t = json.array({}); for k in pairs(H) do t[#t + 1] = k end; table.sort(t); return t end)(),
  })
end

-- Process one claimed request file. Returns true if a pending verification was started.
local function process(name)
  local id = name:sub(1, -6)
  local started = reaper.time_precise()
  local path = join(B.dir, "processing", name)
  if not id:match(ID_PATTERN) or #id > 80 then os.remove(path); return false end
  if B.seen[id] then
    write_atomic(join(B.dir, "tmp"), join(B.dir, "outbox", id .. ".json"), B.seen[id])
    os.remove(path)
    return false
  end
  if B.journal_ids[id] then
    reject(id, nil, "DUPLICATE_REQUEST", "This request was already answered in an earlier bridge session; it was not run again.", nil, started)
    return false
  end
  local raw = read_file(path)
  local okp, req = pcall(json.decode, raw or "")
  if not okp or type(req) ~= "table" then
    reject(id, nil, "INVALID_ARGS", "The request is not valid JSON.", nil, started)
    return false
  end
  if req.v ~= 1 then reject(id, req, "PROTOCOL_MISMATCH", "Unsupported request version " .. tostring(req.v), nil, started); return false end
  if req.id ~= id then reject(id, req, "INVALID_ARGS", "Request id does not match its file name.", nil, started); return false end
  if req.kind ~= "hello" then
    if req.session ~= K.session then
      reject(id, req, "SESSION_MISMATCH", "The request was addressed to an earlier REAPER bridge session.", "Assist reconnects automatically; try again.", started)
      return false
    end
    if type(req.expiresAt) == "number" and K.epoch_ms() > req.expiresAt + 1000 then
      reject(id, req, "EXPIRED", "The request expired before REAPER could run it, so it was not run.", nil, started)
      return false
    end
    if type(req.expectProject) == "string" and req.expectProject ~= project_key() then
      reject(id, req, "PROJECT_CHANGED", "A different project is open in REAPER than the one this was planned for.", "Assist will refresh; check the project tab and try again.", started)
      return false
    end
  end
  local result
  if req.kind == "hello" then
    result = hello()
  elseif req.kind == "batch" then
    result = run_batch(req)
  elseif req.kind == "command" then
    if type(req.command) ~= "string" or not H[req.command] then
      result = { status = "unsupported", error = { code = "UNSUPPORTED", message = "The REAPER bridge does not implement " .. tostring(req.command) } }
    else
      local label = type(req.undoLabel) == "string" and req.undoLabel or ("Assist: " .. req.command)
      result = run_handler(req.command, req.args, label, nil)
    end
  else
    result = { status = "rejected", error = { code = "INVALID_ARGS", message = "Unknown request kind " .. tostring(req.kind) } }
  end
  if is_pending(result) then
    B.pending = { id = id, req = req, started = started, deadline = reaper.time_precise() + result.timeout, check = result.check, on_timeout = result.on_timeout }
    return true
  end
  respond(id, req, result, started)
  return false
end
K.process = process

local function poll_pending()
  local p = B.pending
  if not p then return end
  local ok, res = pcall(p.check)
  if not ok then
    B.pending = nil
    respond(p.id, p.req, error_result(res), p.started)
  elseif res then
    B.pending = nil
    respond(p.id, p.req, res, p.started)
  elseif reaper.time_precise() > p.deadline then
    B.pending = nil
    local r = p.on_timeout and p.on_timeout() or { status = "unverified", message = "The command was sent but its effect could not be confirmed in time." }
    respond(p.id, p.req, r, p.started)
  end
end

local function poll_inbox()
  local budget = reaper.time_precise() + 0.03
  for _, name in ipairs(list_files(join(B.dir, "inbox"))) do
    if B.pending or reaper.time_precise() > budget then break end
    if name:sub(-5) == ".json" then
      -- Claim first: the app can still cancel an unclaimed request by deleting it.
      if os.rename(join(B.dir, "inbox", name), join(B.dir, "processing", name)) then
        process(name)
      end
    end
  end
end

local function ensure_dirs()
  for _, sub in ipairs({ "inbox", "outbox", "processing", "tmp", "events" }) do
    reaper.RecursiveCreateDirectory(join(B.dir, sub), 0)
  end
end
K.ensure_dirs = ensure_dirs

local function write_status(state)
  B.seq = B.seq + 1
  if B.seq % 4 == 0 then ensure_dirs() end
  local _, path = reaper.EnumProjects(-1)
  local pname = reaper.GetProjectName(0)
  local st = {
    bridge = "reaper-assist", bridgeVersion = BRIDGE_VERSION, protocol = PROTOCOL, session = K.session, seq = B.seq,
    state = state or "running", startedAt = B.started_ms, now = K.epoch_ms(), reaperVersion = reaper.GetAppVersion(),
    project = { key = project_key(), name = pname ~= "" and pname or "Untitled project", path = (path and path ~= "") and path or json.null },
    playState = transport_name(reaper.GetPlayState()), busy = B.pending ~= nil,
    lastRecording = recording.last_report and { newTakes = #recording.last_report.newTakes, startedAt = recording.last_report.startedAt } or json.null,
  }
  write_atomic(join(B.dir, "tmp"), join(B.dir, "status.json"), json.encode(st))
  if K.instance then
    reaper.SetExtState("ReaperAssist", "bridge_owner", K.instance, false)
    reaper.SetExtState("ReaperAssist", "bridge_beat", string.format("%.3f", reaper.time_precise()), false)
  end
end

-- One bridge per REAPER instance: a second copy (e.g. autostart plus a manual run)
-- would otherwise compete for the same inbox.
function K.other_instance_running()
  local owner = reaper.GetExtState("ReaperAssist", "bridge_owner")
  local beat = tonumber(reaper.GetExtState("ReaperAssist", "bridge_beat")) or -1e9
  return owner ~= "" and owner ~= K.instance and (reaper.time_precise() - beat) < 2.0
end

-- Notice recordings started/stopped in REAPER itself, so "keep that take" also works for them.
local function watch_transport()
  local ps = reaper.GetPlayState()
  local was = B.last_ps & 4 ~= 0
  local is = ps & 4 ~= 0
  if is and not was and not recording.snapshot then
    recording.snapshot = snapshot_armed()
    recording.snapshot.manual = true
  elseif was and not is and recording.snapshot and not B.pending then
    recording.last_report = recording_report(recording.snapshot)
    recording.snapshot = nil
  end
  B.last_ps = ps
end

local function loop()
  local now = reaper.time_precise()
  if now - B.last_poll >= 0.02 then
    B.last_poll = now
    local ok, e = pcall(function()
      watch_transport()
      poll_pending()
      if not B.pending then poll_inbox() end
    end)
    if not ok then
      local f = io.open(join(B.dir, "bridge.log"), "a")
      if f then f:write(os.date("!%Y-%m-%dT%H:%M:%SZ"), " loop error: ", tostring(e), "\n"); f:close() end
    end
  end
  if now - B.last_status >= 0.5 then
    B.last_status = now
    pcall(write_status)
  end
  reaper.defer(loop)
end

local function recover_interrupted()
  for _, name in ipairs(list_files(join(B.dir, "processing"))) do
    if name:sub(-5) == ".json" then
      local id = name:sub(1, -6)
      if id:match(ID_PATTERN) then
        local data = json.encode({ v = 1, id = id, session = K.session, status = "unknown",
          error = { code = "INTERRUPTED", message = "REAPER or the bridge stopped while this command was running. It was not re-run; check the project before trying again." } })
        write_atomic(join(B.dir, "tmp"), join(B.dir, "outbox", id .. ".json"), data)
        remember(id, data, "unknown")
      end
      os.remove(join(B.dir, "processing", name))
    end
  end
end

function K.default_dir()
  local env = os.getenv("REAPER_ASSIST_BRIDGE_DIR")
  if env and env ~= "" then return env end
  return join(join(reaper.GetResourcePath(), "ReaperAssist"), "bridge")
end

function K.init(dir)
  B.dir = dir or K.default_dir()
  for _, sub in ipairs({ "", "inbox", "outbox", "processing", "tmp", "events" }) do
    reaper.RecursiveCreateDirectory(sub == "" and B.dir or join(B.dir, sub), 0)
  end
  K.session = new_session_id()
  B.started_ms = K.epoch_ms()
  load_journal()
  recover_interrupted()
end

function K.start()
  K.instance = string.format("%08x%06x", math.floor(reaper.time_precise() * 1000) % 0xffffffff, math.random(0, 0xffffff))
  if K.other_instance_running() then
    reaper.ShowConsoleMsg("REAPER Assist: the bridge is already running in this REAPER instance.\n")
    return
  end
  K.init()
  if reaper.set_action_options then reaper.set_action_options(1 | 4) end
  write_status("running")
  reaper.atexit(function()
    pcall(write_status, "stopped")
    if reaper.GetExtState("ReaperAssist", "bridge_owner") == K.instance then
      reaper.DeleteExtState("ReaperAssist", "bridge_owner", false)
      reaper.DeleteExtState("ReaperAssist", "bridge_beat", false)
    end
    if reaper.set_action_options then reaper.set_action_options(8) end
  end)
  reaper.defer(loop)
end

if REAPER_ASSIST_BRIDGE_TEST then
  return K
end
K.start()
