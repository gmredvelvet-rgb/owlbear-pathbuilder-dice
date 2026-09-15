import OBR from "@owlbear-rodeo/sdk";
import { useEffect } from "react";
import create from "zustand";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { RollResult } from "../pathbuilder/protocol";
import { RESULT_CHANNEL } from "../pathbuilder/queue";
import { getPluginId } from "../plugin/getPluginId";

const LOG_KEY = getPluginId("roll-log");
const MAX_ENTRIES = 50;

function loadLog(): RollResult[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

interface LogState {
  entries: RollResult[];
  add: (result: RollResult) => void;
  clear: () => void;
}

const useLog = create<LogState>((set, get) => ({
  entries: loadLog(),
  add(result) {
    if (get().entries.some((e) => e.id === result.id && e.player === result.player)) {
      return;
    }
    const entries = [result, ...get().entries].slice(0, MAX_ENTRIES);
    set({ entries });
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(entries));
    } catch {
      // The log still works for this session
    }
  },
  clear() {
    set({ entries: [] });
    try {
      localStorage.removeItem(LOG_KEY);
    } catch {
      // Nothing stored
    }
  },
}));

/** Keep collecting results while the sheet is open, whatever tab is shown */
export function useRollLogListener() {
  const add = useLog((state) => state.add);
  useEffect(
    () => OBR.broadcast.onMessage(RESULT_CHANNEL, (event) => add(event.data as RollResult)),
    [add]
  );
}

export function RollLog() {
  const entries = useLog((state) => state.entries);
  const clear = useLog((state) => state.clear);

  return (
    <Stack gap={1} sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6">Registro de tiradas</Typography>
        <Button size="small" onClick={clear} disabled={entries.length === 0}>
          Vaciar
        </Button>
      </Stack>
      {entries.length === 0 && (
        <Typography color="text.secondary">
          Aún no hay tiradas. Tira desde Pathbuilder o desde la hoja nativa.
        </Typography>
      )}
      {entries.map((entry) => (
        <Box
          component="div"
          key={`${entry.player}-${entry.id}`}
          sx={{
            borderLeft: 4,
            borderColor: entry.playerColor || "primary.main",
            bgcolor: "action.hover",
            borderRadius: 1,
            px: 1.5,
            py: 1,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={1}>
            <Typography variant="body2" noWrap>
              <b>{entry.character || entry.player}</b> · {entry.label}
              {entry.hidden && " (oculta)"}
            </Typography>
            <Typography
              variant="h6"
              color={
                entry.natural === "nat20"
                  ? "success.main"
                  : entry.natural === "nat1"
                  ? "error.main"
                  : "text.primary"
              }
            >
              {entry.total}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {new Date(entry.at).toLocaleTimeString()} · {entry.breakdown}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
