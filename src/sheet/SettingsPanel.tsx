import { useState } from "react";

import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { loadSettings, saveSettings, Settings } from "../pathbuilder/settings";

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [status, setStatus] = useState("");

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  }

  async function testWebhook() {
    setStatus("Enviando…");
    try {
      const response = await fetch(settings.discordWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "🎲 Pathbuilder Dice conectado con Owlbear Rodeo." }),
      });
      setStatus(response.ok ? "Mensaje enviado ✔" : `Discord respondió ${response.status}`);
    } catch {
      setStatus("No se pudo contactar con Discord");
    }
  }

  return (
    <Stack gap={3} sx={{ p: 2, maxWidth: 640 }}>
      <Stack gap={1}>
        <Typography variant="h6">Tiradas de Pathbuilder</Typography>
        <RadioGroup
          value={settings.pathbuilderMode}
          onChange={(e) => update({ pathbuilderMode: e.target.value as Settings["pathbuilderMode"] })}
        >
          <FormControlLabel
            value="3d"
            control={<Radio />}
            label="Tirar dados 3D en la bandeja de Owlbear (todos ven caer los dados)"
          />
          <FormControlLabel
            value="announce"
            control={<Radio />}
            label="Solo anunciar el resultado que calculó Pathbuilder"
          />
        </RadioGroup>
        <FormControlLabel
          control={
            <Switch
              checked={settings.showNotifications}
              onChange={(e) => update({ showNotifications: e.target.checked })}
            />
          }
          label="Mostrar notificación en Owlbear cuando alguien tira"
        />
      </Stack>

      <Stack gap={1}>
        <Typography variant="h6">Discord (opcional)</Typography>
        <Typography variant="body2" color="text.secondary">
          Pega un webhook del canal y cada tirada con nombre se enviará también a Discord. Se guarda
          solo en este navegador.
        </Typography>
        <TextField
          type="password"
          size="small"
          label="URL del webhook"
          value={settings.discordWebhook}
          onChange={(e) => update({ discordWebhook: e.target.value.trim() })}
          placeholder="https://discord.com/api/webhooks/…"
        />
        <Stack direction="row" gap={2} alignItems="center">
          <Button
            variant="outlined"
            size="small"
            onClick={testWebhook}
            disabled={!settings.discordWebhook.startsWith("https://")}
          >
            Probar
          </Button>
          <Typography variant="body2">{status}</Typography>
        </Stack>
      </Stack>

      <Stack gap={0.5}>
        <Typography variant="h6">Ayuda</Typography>
        <Link href={new URL("companion.zip", window.location.href).href}>
          Descargar la extensión compañera (companion.zip)
        </Link>
        <Link href="https://github.com/gmredvelvet-rgb/owlbear-pathbuilder-dice" target="_blank" rel="noreferrer">
          Código fuente, instrucciones y reportar problemas
        </Link>
        <Typography variant="caption" color="text.secondary">
          Extensión no oficial. Pathbuilder 2e pertenece a su autor; los dados 3D provienen de
          Owlbear Rodeo Dice (GPL-3.0).
        </Typography>
      </Stack>
    </Stack>
  );
}
