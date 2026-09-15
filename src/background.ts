import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "./plugin/getPluginId";
import { RollResult } from "./pathbuilder/protocol";
import { RESULT_CHANNEL } from "./pathbuilder/queue";
import { formatResult } from "./pathbuilder/announce";
import { loadSettings } from "./pathbuilder/settings";

OBR.onReady(() => {
  OBR.popover.open({
    id: getPluginId("popover"),
    // Absolute URL so the extension also works from a sub path
    url: new URL("popover.html", window.location.href).href,
    width: 0,
    height: 0,
    anchorOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    disableClickAway: true,
    hidePaper: true,
    marginThreshold: 0,
  });

  OBR.broadcast.onMessage(RESULT_CHANNEL, (event) => {
    const result = event.data as RollResult;
    if (!result?.label || !loadSettings().showNotifications) {
      return;
    }
    const variant =
      result.natural === "nat20" ? "SUCCESS" : result.natural === "nat1" ? "ERROR" : "DEFAULT";
    OBR.notification.show(formatResult(result), variant);
  });
});
