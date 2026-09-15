import { useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import {
  CharacterSummary,
  CheckStat,
  extractExportId,
  multipleAttackPenalty,
  parseExport,
  PathbuilderBuild,
  StrikeStat,
  summarize,
} from "../pathbuilder/character";
import { DiceTerm, newRequestId } from "../pathbuilder/protocol";
import { getPluginId } from "../plugin/getPluginId";
import { dispatchRoll } from "./dispatch";

const CHARACTER_KEY = getPluginId("native-character");
const AGILE_KEY = getPluginId("agile-overrides");

interface StoredCharacter {
  exportId?: string;
  build: PathbuilderBuild;
  importedAt: number;
}

function loadStored(): StoredCharacter | null {
  try {
    const raw = localStorage.getItem(CHARACTER_KEY);
    return raw ? (JSON.parse(raw) as StoredCharacter) : null;
  } catch {
    return null;
  }
}

function store(value: StoredCharacter | null) {
  try {
    if (value) localStorage.setItem(CHARACTER_KEY, JSON.stringify(value));
    else localStorage.removeItem(CHARACTER_KEY);
  } catch {
    // Keeps working for this session
  }
}

async function fetchExport(exportId: string) {
  const response = await fetch(`https://pathbuilder2e.com/json.php?id=${exportId}`);
  if (!response.ok) {
    throw new Error(`Pathbuilder respondió ${response.status}`);
  }
  return parseExport(await response.text());
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function NativeSheet() {
  const [stored, setStored] = useState<StoredCharacter | null>(loadStored);

  function save(value: StoredCharacter | null) {
    store(value);
    setStored(value);
  }

  const summary = useMemo(() => {
    if (!stored) return null;
    try {
      return summarize(stored.build);
    } catch {
      return null;
    }
  }, [stored]);

  if (!stored || !summary) {
    return <ImportForm onImported={save} />;
  }
  return <CharacterView stored={stored} summary={summary} onChange={save} />;
}

function ImportForm({ onImported }: { onImported: (value: StoredCharacter) => void }) {
  const [idText, setIdText] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPaste, setShowPaste] = useState(false);

  async function importById() {
    const exportId = extractExportId(idText);
    if (!exportId) {
      setError("Escribe el número de exportación de Pathbuilder (por ejemplo 123456).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      onImported({ exportId, build: await fetchExport(exportId), importedAt: Date.now() });
    } catch (e) {
      setShowPaste(true);
      setError(
        `No se pudo descargar el personaje (${(e as Error).message}). Abre ` +
          `https://pathbuilder2e.com/json.php?id=${exportId} en otra pestaña, copia todo el texto y pégalo abajo.`
      );
    } finally {
      setLoading(false);
    }
  }

  function importJson() {
    try {
      onImported({ exportId: extractExportId(idText) || undefined, build: parseExport(jsonText), importedAt: Date.now() });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Stack gap={2} sx={{ p: 2, maxWidth: 640 }}>
      <Typography variant="h6">Importar personaje de Pathbuilder</Typography>
      <Typography variant="body2" color="text.secondary">
        En Pathbuilder abre el menú ☰ → <b>Export</b> → <b>Export JSON</b>. Te dará un número: pégalo
        aquí. Esta hoja funciona sin la extensión del navegador y tira directamente en la bandeja 3D.
      </Typography>
      <Stack direction="row" gap={1}>
        <TextField
          size="small"
          label="ID de exportación o enlace"
          value={idText}
          onChange={(e) => setIdText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && importById()}
          sx={{ flexGrow: 1 }}
        />
        <Button variant="contained" onClick={importById} disabled={loading}>
          {loading ? "Importando…" : "Importar"}
        </Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {showPaste ? (
        <Stack gap={1}>
          <TextField
            multiline
            minRows={6}
            maxRows={12}
            label="JSON de Pathbuilder"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          <Button variant="outlined" onClick={importJson} disabled={!jsonText.trim()}>
            Importar JSON pegado
          </Button>
        </Stack>
      ) : (
        <Button size="small" onClick={() => setShowPaste(true)} sx={{ alignSelf: "start" }}>
          Prefiero pegar el JSON
        </Button>
      )}
    </Stack>
  );
}

type Fortune = "normal" | "fortune" | "misfortune";

function loadAgile(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(AGILE_KEY) || "{}");
  } catch {
    return {};
  }
}

function CharacterView({
  stored,
  summary,
  onChange,
}: {
  stored: StoredCharacter;
  summary: CharacterSummary;
  onChange: (value: StoredCharacter | null) => void;
}) {
  const [situational, setSituational] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [fortune, setFortune] = useState<Fortune>("normal");
  const [agile, setAgile] = useState<Record<string, boolean>>(loadAgile);
  const [refreshError, setRefreshError] = useState("");

  function d20(): DiceTerm {
    if (fortune === "normal") return { count: 1, sides: 20 };
    return { count: 2, sides: 20, keep: fortune === "fortune" ? "highest" : "lowest" };
  }

  function roll(label: string, dice: DiceTerm[], bonus: number) {
    dispatchRoll({
      id: newRequestId(),
      label,
      character: summary.name,
      dice,
      bonus,
      hidden,
      source: "native-sheet",
    });
  }

  function rollCheck(stat: CheckStat, label = stat.label) {
    roll(label, [d20()], stat.modifier + situational);
  }

  function isAgile(strike: StrikeStat) {
    return agile[strike.name] ?? strike.agile;
  }

  function toggleAgile(strike: StrikeStat) {
    const next = { ...agile, [strike.name]: !isAgile(strike) };
    setAgile(next);
    try {
      localStorage.setItem(AGILE_KEY, JSON.stringify(next));
    } catch {
      // Only a preference
    }
  }

  function rollStrike(strike: StrikeStat, attackIndex: number) {
    const map = multipleAttackPenalty(attackIndex, isAgile(strike));
    const suffix = attackIndex === 0 ? "To Hit" : `To Hit (MAP ${map})`;
    roll(`${strike.name}: ${suffix}`, [d20()], strike.attack + map + situational);
  }

  function rollDamage(strike: StrikeStat, critical: boolean) {
    // A critical hit doubles all damage: dice are doubled and so is the bonus
    const dice = strike.damage.map((term) => ({ ...term, doubled: critical || undefined }));
    const bonus = strike.damageBonus * (critical ? 2 : 1);
    roll(`${strike.name}: ${critical ? "Critical" : "Damage"}`, dice, bonus);
  }

  async function refresh() {
    if (!stored.exportId) return;
    setRefreshError("");
    try {
      onChange({ ...stored, build: await fetchExport(stored.exportId), importedAt: Date.now() });
    } catch (e) {
      setRefreshError((e as Error).message);
    }
  }

  return (
    <Stack gap={2} sx={{ p: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} flexWrap="wrap">
        <Box component="div">
          <Typography variant="h5">{summary.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {summary.subtitle}
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          {stored.exportId && (
            <Tooltip title="Volver a descargar desde Pathbuilder">
              <Button size="small" onClick={refresh}>
                Actualizar
              </Button>
            </Tooltip>
          )}
          <Button size="small" color="warning" onClick={() => onChange(null)}>
            Cambiar personaje
          </Button>
        </Stack>
      </Stack>
      {refreshError && <Alert severity="error">{refreshError}</Alert>}

      <Stack direction="row" gap={1} flexWrap="wrap">
        <Stat label="PG" value={summary.hp} />
        <Stat label="CA" value={summary.ac ?? "—"} />
        <Stat label="Velocidad" value={`${summary.speed} ft`} />
        {summary.classDC !== null && <Stat label="CD de clase" value={summary.classDC} />}
        {summary.spells.map((s) => (
          <Stat key={s.key} label={s.label.replace("Spell Attack", "CD conjuros")} value={s.dc} />
        ))}
      </Stack>

      <Stack
        direction="row"
        gap={2}
        alignItems="center"
        flexWrap="wrap"
        sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2 }}
      >
        <TextField
          size="small"
          type="number"
          label="Modificador situacional"
          value={situational}
          onChange={(e) => setSituational(Number(e.target.value) || 0)}
          sx={{ width: 170 }}
        />
        <ToggleButtonGroup size="small" exclusive value={fortune} onChange={(_, v) => v && setFortune(v)}>
          <ToggleButton value="normal">Normal</ToggleButton>
          <ToggleButton value="fortune">Fortuna</ToggleButton>
          <ToggleButton value="misfortune">Infortunio</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={<Checkbox checked={hidden} onChange={(e) => setHidden(e.target.checked)} />}
          label="Tirada oculta"
        />
      </Stack>

      <Section title="Percepción y salvaciones">
        <CheckButton stat={summary.perception} onRoll={rollCheck} />
        {summary.saves.map((stat) => (
          <CheckButton key={stat.key} stat={stat} onRoll={(s) => rollCheck(s, `${s.label} Save`)} />
        ))}
      </Section>

      {summary.strikes.length > 0 && (
        <Section title="Golpes" column>
          {summary.strikes.map((strike) => {
            const agileNow = isAgile(strike);
            return (
              <Stack key={strike.key} direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Typography sx={{ minWidth: 160, flexGrow: 1 }} noWrap>
                  {strike.name}
                </Typography>
                <ButtonGroup size="small" variant="outlined">
                  {[0, 1, 2].map((i) => (
                    <Button key={i} onClick={() => rollStrike(strike, i)}>
                      {signed(strike.attack + multipleAttackPenalty(i, agileNow))}
                    </Button>
                  ))}
                </ButtonGroup>
                <ButtonGroup size="small" variant="contained">
                  <Button onClick={() => rollDamage(strike, false)}>
                    Daño {strike.damage.map((d) => `${d.count}d${d.sides}`).join("+")}
                    {strike.damageBonus ? signed(strike.damageBonus) : ""}
                  </Button>
                  <Button color="secondary" onClick={() => rollDamage(strike, true)}>
                    Crítico
                  </Button>
                </ButtonGroup>
                <FormControlLabel
                  sx={{ ml: 0 }}
                  control={<Checkbox size="small" checked={agileNow} onChange={() => toggleAgile(strike)} />}
                  label="Ágil"
                />
              </Stack>
            );
          })}
        </Section>
      )}

      <Section title="Habilidades">
        {summary.skills.map((stat) => (
          <CheckButton key={stat.key} stat={stat} onRoll={rollCheck} />
        ))}
      </Section>

      {summary.lores.length > 0 && (
        <Section title="Saberes">
          {summary.lores.map((stat) => (
            <CheckButton key={stat.key} stat={stat} onRoll={rollCheck} />
          ))}
        </Section>
      )}

      {summary.spells.length > 0 && (
        <Section title="Conjuros">
          {summary.spells.map((spell) => (
            <Button
              key={spell.key}
              variant="outlined"
              onClick={() => roll(spell.label, [d20()], spell.attack + situational)}
            >
              {spell.label} {signed(spell.attack)}
            </Button>
          ))}
        </Section>
      )}

      <Divider />
      <Typography variant="caption" color="text.secondary">
        Los modificadores se calculan desde la exportación de Pathbuilder (nivel, competencia, atributo,
        runas y bonos de objeto). Efectos temporales, estados y dotes situacionales van en el modificador
        situacional.
      </Typography>
    </Stack>
  );
}

const RANKS = ["", "", "T", "", "E", "", "M", "", "L"];

function CheckButton({ stat, onRoll }: { stat: CheckStat; onRoll: (stat: CheckStat) => void }) {
  return (
    <Button
      variant="outlined"
      onClick={() => onRoll(stat)}
      sx={{ justifyContent: "space-between", minWidth: 170, textTransform: "none" }}
    >
      <span>
        {stat.label}
        {RANKS[stat.rank] && (
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
            {RANKS[stat.rank]}
          </Typography>
        )}
      </span>
      <b style={{ marginLeft: 12 }}>{signed(stat.modifier)}</b>
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Box component="div" sx={{ px: 1.5, py: 0.75, bgcolor: "action.selected", borderRadius: 2, textAlign: "center" }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h6" lineHeight={1.2}>
        {value}
      </Typography>
    </Box>
  );
}

function Section({
  title,
  children,
  column,
}: {
  title: string;
  children: React.ReactNode;
  column?: boolean;
}) {
  return (
    <Stack gap={1}>
      <Typography variant="overline" color="text.secondary">
        {title}
      </Typography>
      <Stack direction={column ? "column" : "row"} gap={1} flexWrap="wrap">
        {children}
      </Stack>
    </Stack>
  );
}
