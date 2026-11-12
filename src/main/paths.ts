import { app } from "electron";
import { join } from "node:path";

/*
 * Files Assist reads from its own source tree at run time (the bridge, the profile scripts, the skills).
 * app.getAppPath() is the repo root in development and app.asar once packaged; the installers unpack these
 * files next to it (package.json build.asarUnpack), so they are plain files REAPER-bound copies can use.
 */
const root = () => app.getAppPath().replace(/app\.asar$/, "app.asar.unpacked");

/** The Lua bridge copied into REAPER's Scripts folder. */
export const bridgeLua = () => join(root(), "src", "daw", "reaper", "bridge", "assist_bridge.lua");

/** A DAW profile's Lua scripts (src/profiles/<id>/scripts). */
export const profileScriptsDir = (id: string) => join(root(), "src", "profiles", id, "scripts");
