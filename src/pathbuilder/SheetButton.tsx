import OBR from "@owlbear-rodeo/sdk";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import SheetIcon from "@mui/icons-material/AssignmentIndRounded";

import { getPluginId } from "../plugin/getPluginId";

export const SHEET_POPOVER_ID = getPluginId("sheet");

/** Width of the dice tray popover plus Owlbear's toolbar */
const TRAY_SPACE = 480;

function describeError(error: unknown) {
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function getViewportSize() {
  try {
    const [width, height] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
    return { width: Math.round(width), height: Math.round(height) };
  } catch (error) {
    console.warn("[Pathbuilder Dice] viewport size unavailable", describeError(error));
    // The popover lives inside Owlbear's window, so this is a close estimate
    return { width: window.screen.availWidth, height: window.screen.availHeight - 120 };
  }
}

export async function openSheet() {
  const url = new URL("sheet.html", window.location.href).href;
  const viewport = await getViewportSize();
  // Owlbear validates sizes and positions as integers
  const width = Math.round(Math.max(420, Math.min(1100, viewport.width - TRAY_SPACE)));
  const height = Math.round(Math.max(400, viewport.height - 90));
  try {
    await OBR.popover.open({
      id: SHEET_POPOVER_ID,
      url,
      width,
      height,
      anchorReference: "POSITION",
      // Pin to the right so the dice tray (top left) stays visible
      anchorPosition: { left: Math.round(viewport.width - 12), top: 64 },
      anchorOrigin: { horizontal: "RIGHT", vertical: "TOP" },
      transformOrigin: { horizontal: "RIGHT", vertical: "TOP" },
      disableClickAway: true,
    });
    return;
  } catch (error) {
    console.error("[Pathbuilder Dice] popover.open failed", describeError(error));
  }
  try {
    await OBR.modal.open({ id: SHEET_POPOVER_ID, url, width, height });
  } catch (error) {
    const detail = describeError(error);
    console.error("[Pathbuilder Dice] modal.open failed", detail);
    OBR.notification.show(`No se pudo abrir la hoja: ${detail}`, "ERROR");
  }
}

export function SheetButton() {
  return (
    <Tooltip title="Hoja de personaje (Pathbuilder)" placement="right" disableInteractive>
      <IconButton onClick={() => openSheet()} color="primary">
        <SheetIcon />
      </IconButton>
    </Tooltip>
  );
}
