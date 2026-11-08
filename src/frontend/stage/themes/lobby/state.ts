/**
 * The geometry of the Lobby battle on screen now. The stage asks the theme for its layout just before it places
 * the HUD pieces (BattleStage.resize), so the pieces read the same geometry the layout came from.
 */
import { lobbyGeom, type LobbyGeom } from "./geom.js";

let geom: LobbyGeom | null = null;

export function setGeom(w: number, h: number, party: number): LobbyGeom {
  geom = lobbyGeom(w, h, party);
  return geom;
}

export function currentGeom(): LobbyGeom | null {
  return geom;
}
