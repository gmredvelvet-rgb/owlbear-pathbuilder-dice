import OBR from "@owlbear-rodeo/sdk";
import { useState } from "react";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/CloseRounded";

import { SHEET_POPOVER_ID } from "../pathbuilder/SheetButton";
import { PathbuilderFrame } from "./PathbuilderFrame";
import { NativeSheet } from "./NativeSheet";
import { RollLog, useRollLogListener } from "./RollLog";
import { SettingsPanel } from "./SettingsPanel";

type TabId = "pathbuilder" | "native" | "log" | "settings";

const TAB_KEY = "pb-dice-sheet-tab";

function initialTab(): TabId {
  try {
    return (localStorage.getItem(TAB_KEY) as TabId) || "pathbuilder";
  } catch {
    return "pathbuilder";
  }
}

export function SheetApp() {
  const [tab, setTab] = useState<TabId>(initialTab);
  useRollLogListener();

  function changeTab(value: TabId) {
    setTab(value);
    try {
      localStorage.setItem(TAB_KEY, value);
    } catch {
      // Remembering the tab is only a convenience
    }
  }

  return (
    <Paper
      square
      elevation={0}
      sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      <Stack direction="row" alignItems="center" sx={{ borderBottom: 1, borderColor: "divider", pr: 1 }}>
        <Tabs
          value={tab}
          onChange={(_, value) => changeTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flexGrow: 1, minHeight: 44, "& .MuiTab-root": { minHeight: 44 } }}
        >
          <Tab value="pathbuilder" label="Pathbuilder" />
          <Tab value="native" label="Hoja nativa" />
          <Tab value="log" label="Registro" />
          <Tab value="settings" label="Ajustes" />
        </Tabs>
        <Tooltip title="Cerrar hoja">
          <IconButton onClick={() => OBR.popover.close(SHEET_POPOVER_ID)}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box component="div" sx={{ flexGrow: 1, position: "relative", minHeight: 0 }}>
        {/* Pathbuilder stays mounted so switching tabs keeps its state */}
        <Box component="div" sx={{ position: "absolute", inset: 0, display: tab === "pathbuilder" ? "block" : "none" }}>
          <PathbuilderFrame />
        </Box>
        {tab !== "pathbuilder" && (
          <Box component="div" sx={{ position: "absolute", inset: 0, overflowY: "auto" }}>
            {tab === "native" && <NativeSheet />}
            {tab === "log" && <RollLog />}
            {tab === "settings" && <SettingsPanel />}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
