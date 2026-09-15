import { useEffect, useRef, useState } from "react";

import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNewRounded";
import ReloadIcon from "@mui/icons-material/RefreshRounded";

import {
  isBridgeMessage,
  PATHBUILDER_ORIGINS,
  requestFromDump,
  requestFromHistory,
} from "../pathbuilder/protocol";
import { dispatchRoll } from "./dispatch";

const PATHBUILDER_URL = "https://pathbuilder2e.com/app.html";
/** Pathbuilder can emit both a structured event and a history entry */
const DUPLICATE_WINDOW_MS = 2500;
const BRIDGE_TIMEOUT_MS = 12000;

type BridgeState = "waiting" | "connected" | "missing";

export function PathbuilderFrame() {
  const [bridge, setBridge] = useState<BridgeState>("waiting");
  const [character, setCharacter] = useState<string>();
  const [lastRoll, setLastRoll] = useState<string>();
  const [frameKey, setFrameKey] = useState(0);
  const lastDumpAt = useRef(0);

  useEffect(() => {
    setBridge("waiting");
    const timeout = window.setTimeout(
      () => setBridge((state) => (state === "connected" ? state : "missing")),
      BRIDGE_TIMEOUT_MS
    );
    return () => window.clearTimeout(timeout);
  }, [frameKey]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!PATHBUILDER_ORIGINS.includes(event.origin) || !isBridgeMessage(event.data)) {
        return;
      }
      const message = event.data;
      setBridge("connected");
      if (message.character) {
        setCharacter(message.character);
      }
      let request = null;
      if (message.kind === "dump") {
        lastDumpAt.current = Date.now();
        request = requestFromDump(message.data, message.character);
      } else if (message.kind === "history") {
        if (Date.now() - lastDumpAt.current < DUPLICATE_WINDOW_MS) {
          return;
        }
        request = requestFromHistory(message);
      }
      if (request) {
        setLastRoll(request.label);
        dispatchRoll(request);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function openPopup() {
    window.open(PATHBUILDER_URL, "pathbuilder2e", "popup,width=1100,height=900");
  }

  return (
    <Stack sx={{ height: "100%" }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.5, py: 0.75 }}>
        {bridge === "connected" && <Chip size="small" color="success" label="Puente conectado" />}
        {bridge === "waiting" && <Chip size="small" label="Conectando…" />}
        {bridge === "missing" && <Chip size="small" color="warning" label="Sin puente" />}
        {character && (
          <Typography variant="body2" noWrap>
            {character}
          </Typography>
        )}
        {lastRoll && (
          <Typography variant="caption" color="text.secondary" noWrap>
            Última tirada: {lastRoll}
          </Typography>
        )}
        <Box component="div" sx={{ flexGrow: 1 }} />
        <Tooltip title="Recargar Pathbuilder">
          <IconButton size="small" onClick={() => setFrameKey((k) => k + 1)}>
            <ReloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Abrir Pathbuilder en una ventana (si el panel no carga)">
          <IconButton size="small" onClick={openPopup}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {bridge === "missing" && <BridgeHelp onPopup={openPopup} />}
      <Box
        component="iframe"
        key={frameKey}
        src={PATHBUILDER_URL}
        title="Pathbuilder 2e"
        allow="clipboard-read; clipboard-write"
        sx={{ flexGrow: 1, border: 0, width: "100%", bgcolor: "#fff" }}
      />
    </Stack>
  );
}

function BridgeHelp({ onPopup }: { onPopup: () => void }) {
  const zipUrl = new URL("companion.zip", window.location.href).href;
  return (
    <Alert severity="warning" sx={{ mx: 1.5, mb: 1, borderRadius: 2 }}>
      <AlertTitle>Falta la extensión compañera del navegador</AlertTitle>
      Pathbuilder no permite mostrarse dentro de otras webs ni compartir sus tiradas. La extensión
      compañera (Chrome/Edge) lo habilita solo para este panel.
      <ol style={{ margin: "6px 0", paddingLeft: 20 }}>
        <li>
          Descarga <Link href={zipUrl}>companion.zip</Link> y descomprímelo.
        </li>
        <li>
          Abre <code>chrome://extensions</code> (o <code>edge://extensions</code>) y activa el
          modo desarrollador.
        </li>
        <li>Pulsa «Cargar descomprimida», elige la carpeta y recarga Owlbear Rodeo.</li>
      </ol>
      Si ya la tienes y el panel sigue en blanco, prueba{" "}
      <Button size="small" onClick={onPopup} sx={{ py: 0 }}>
        abrir en ventana
      </Button>{" "}
      o usa la pestaña <b>Hoja nativa</b>, que no necesita extensión.
    </Alert>
  );
}
