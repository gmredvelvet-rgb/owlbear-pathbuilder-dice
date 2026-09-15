import OBR from "@owlbear-rodeo/sdk";

import { announceResult } from "../pathbuilder/announce";
import { formatRequest, RollRequest } from "../pathbuilder/protocol";
import { sendRollRequest } from "../pathbuilder/queue";
import { loadSettings } from "../pathbuilder/settings";

/**
 * Send a roll to the 3D tray, or, in "announce" mode, publish the total
 * Pathbuilder already rolled without re-rolling it.
 */
export async function dispatchRoll(request: RollRequest) {
  const { pathbuilderMode } = loadSettings();
  if (
    request.source === "pathbuilder" &&
    pathbuilderMode === "announce" &&
    request.externalTotal !== undefined
  ) {
    await announceResult({
      id: request.id,
      player: await OBR.player.getName(),
      playerColor: await OBR.player.getColor(),
      character: request.character,
      label: request.label,
      total: request.externalTotal,
      breakdown: `${formatRequest(request)} (Pathbuilder)`,
      hidden: request.hidden,
      at: Date.now(),
    });
    return;
  }
  await sendRollRequest(request);
}
