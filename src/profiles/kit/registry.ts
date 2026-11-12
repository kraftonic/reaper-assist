import type { SkinUi } from "../skins";
import ableton from "../ableton/kit";
import cubase from "../cubase/kit";
import fl from "../fl/kit";
import logic from "../logic/kit";
import protools from "../protools/kit";
import studioone from "../studioone/kit";
import type { Kit, KitDef, KitId } from "./types";

/** Every kit, by "Coming from…" profile id. Shared code finds a DAW's kit only through here. */
export const KITS: Record<KitId, KitDef> = { fl, ableton, logic, protools, cubase, studioone };

/** A kit's palette for the profile's panel colours. */
export const kitFor = (id: KitId, ui: SkinUi): Kit => KITS[id].palette(ui);
