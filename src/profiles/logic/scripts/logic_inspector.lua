-- REAPER Assist, "Coming from Logic Pro": Inspector (I).
-- REAPER has no inspector pane: a selected region opens its properties (Region inspector),
-- otherwise the selected track's plug-ins (its channel strip).
if reaper.CountSelectedMediaItems(0) > 0 then
  reaper.Main_OnCommand(40009, 0)
else
  reaper.Main_OnCommand(40291, 0)
end
