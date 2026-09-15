import OBR from "@owlbear-rodeo/sdk";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import SheetIcon from "@mui/icons-material/AssignmentIndRounded";

import { getPluginId } from "../plugin/getPluginId";

export const SHEET_POPOVER_ID = getPluginId("sheet");

/** Width of the dice tray popover plus Owlbear's toolbar */
const TRAY_SPACE = 480;

export async function openSheet() {
  const [viewportWidth, viewportHeight] = await Promise.all([
    OBR.viewport.getWidth(),
    OBR.viewport.getHeight(),
  ]);
  const width = Math.max(420, Math.min(1100, viewportWidth - TRAY_SPACE));
  const height = Math.max(400, viewportHeight - 90);
  await OBR.popover.open({
    id: SHEET_POPOVER_ID,
    url: new URL("sheet.html", window.location.href).href,
    width,
    height,
    anchorReference: "POSITION",
    // Pin to the right so the dice tray (top left) stays visible
    anchorPosition: { left: viewportWidth - 12, top: 64 },
    anchorOrigin: { horizontal: "RIGHT", vertical: "TOP" },
    transformOrigin: { horizontal: "RIGHT", vertical: "TOP" },
    disableClickAway: true,
    marginThreshold: 8,
  });
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
