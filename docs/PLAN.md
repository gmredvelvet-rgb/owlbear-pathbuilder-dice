# Plan: Pathbuilder Dice para Owlbear Rodeo

Objetivo: abrir Pathbuilder 2e como hoja de personaje **dentro** de Owlbear Rodeo
(un botón abre la hoja en un panel) y que cada tirada caiga como **dados 3D en
la bandeja de dados de Owlbear**, visible para toda la mesa, con su etiqueta
("Fortitude", "Longsword: To Hit", etc.).

## Fase 0 — Investigación (hecha)

| Pregunta | Hallazgo | Consecuencia |
|---|---|---|
| ¿Tiene Owlbear una bandeja de dados nativa con API? | No. "Dice" es una extensión de Owlbear (GPL-3.0) sin API externa. Las tiradas viajan en la metadata del jugador (`rodeo.owlbear.dice/*`). | Hacemos un **fork** del Dice oficial y le añadimos una entrada de tiradas externas. Namespace propio para convivir con el Dice oficial. |
| ¿Se puede meter Pathbuilder en un iframe? | `pathbuilder2e.com` responde con `X-Frame-Options: SAMEORIGIN` y está detrás de Cloudflare. | Hace falta una **extensión de navegador compañera** que quite esas cabeceras solo cuando el iframe lo abre nuestra extensión. |
| ¿Puede la página de Owlbear leer las tiradas del iframe? | No (orígenes distintos). | La extensión compañera inyecta un content script dentro del iframe de Pathbuilder y reenvía cada tirada con `postMessage` al panel. |
| ¿Qué formato tienen las tiradas de Pathbuilder? | Pathbuilder emite `window.postMessage({rollDiceDump:[{numDice,diceSize,extraCritDice}], rollBonus, type, title, status:"pending"})` (lo usa la extensión de dddice). También pinta `#dice-title`, `#dice-summary` y `.dice-history-item`. | Dos capturas: mensaje estructurado (preferente) y lectura del historial del DOM (respaldo). |
| ¿Hay alternativa sin extensión de navegador? | Pathbuilder exporta JSON (`json.php?id=…`, `{success, build}`) con nivel, atributos, competencias, armas con `attack`/`damageBonus`, AC, etc. | **Hoja nativa** dentro de Owlbear: importa el JSON y tira salvaciones, habilidades, golpes (MAP, crítico) sin extensión de navegador. |
| SDK | El Dice usa `@owlbear-rodeo/sdk` 1.3.9; la última es 3.1.0 y compila sin cambios. | Se actualiza a 3.x (trae `OBR.broadcast`). |

### Riesgos conocidos (se validan en la Fase 7)
1. **Cloudflare dentro del iframe**: el reto anti-bots podría no resolverse en contexto de terceros. Mitigación: botón "Abrir en ventana" (popup con `window.opener`) y la hoja nativa.
2. **Almacenamiento particionado**: Chrome separa el `localStorage` de un iframe de terceros. Los personajes guardados en la pestaña normal de Pathbuilder pueden no aparecer en el iframe → iniciar sesión dentro del iframe una vez, o usar la hoja nativa.
3. **API `postMessage` de Pathbuilder no documentada**: puede cambiar. Por eso existe el respaldo por DOM y el modo "solo registro".
4. **Resultado distinto**: la bandeja 3D hace su propia tirada física (la de Pathbuilder se ignora). Es intencionado: todos ven los mismos dados caer. Opción para anunciar el resultado de Pathbuilder sin tirar 3D.

## Arquitectura

```
Owlbear Rodeo (owlbear.rodeo)
├── Action popover  index.html  ← bandeja 3D (fork de Dice) + botón "Hoja"
│      ▲  BroadcastChannel + cola en localStorage (mismo origen)
├── Popover hoja    sheet.html  ← pestañas: Pathbuilder (iframe) · Hoja nativa · Ajustes
│      ▲  window.postMessage  (origen verificado: pathbuilder2e.com)
│      └── iframe https://pathbuilder2e.com/app.html
│              └── content script de la extensión compañera
└── Background      background.html ← popovers de otros jugadores + notificaciones
```

Mensaje interno (`src/pathbuilder/protocol.ts`):

```ts
interface RollRequest {
  id: string;            // para deduplicar
  label: string;         // "Will", "Longsword: To Hit"
  character?: string;
  dice: { count: number; sides: 4|6|8|10|12|20|100; doubled?: boolean }[];
  bonus: number;
  hidden?: boolean;
  source: "pathbuilder" | "native-sheet" | "manual";
  externalTotal?: number; // total que calculó Pathbuilder, si se conoce
}
```

## Fase 1 — Base del fork
- Importar Dice (commit exacto en `.upstream-commit`), mantener GPL-3.0 y créditos.
- Namespace `com.thegmstudio.pathbuilder-dice/*` para no chocar con el Dice oficial.
- Rutas relativas (`base: "./"`, manifest sin `/` inicial) para servir desde GitHub Pages en subruta.
- SDK 3.x.
- **Hecho cuando:** `npm run build` pasa y la extensión carga desde `manifest.json`.

## Fase 2 — Motor de tiradas externas en la bandeja
- `protocol.ts`, `toDiceRoll.ts` (petición → `DiceRoll` con el set de dados activo, d100 = d100+d10, críticos con `multiplier`).
- `queue.ts`: la hoja escribe la petición en `localStorage` + `BroadcastChannel` y abre la bandeja (`OBR.action.open()`); la bandeja consume al montarse (peticiones < 15 s) y en vivo.
- La etiqueta viaja dentro de `DiceRoll.label` → se ve en la bandeja propia y en las bandejas flotantes de los demás.
- Anunciador: al terminar una tirada con etiqueta, notificación en Owlbear para toda la sala (`OBR.broadcast`) y reenvío opcional a Discord (webhook, como el bookmarklet original).
- **Hecho cuando:** una petición de prueba lanza dados 3D con etiqueta y los demás ven el total.

## Fase 3 — Hoja en panel dentro de Owlbear
- Botón "Hoja de personaje" en la barra lateral de la bandeja → `OBR.popover.open` grande a la izquierda.
- Pestaña **Pathbuilder**: iframe + indicador de puente (handshake `hello`), ayuda de instalación si no hay puente, botón "Abrir en ventana".
- Pestaña **Ajustes**: webhook de Discord, modo de tirada (3D / solo anunciar), nombre del personaje.
- **Hecho cuando:** el panel abre/cierra y recibe mensajes del puente.

## Fase 4 — Extensión compañera (Chrome/Edge MV3) — `companion/`
- `declarativeNetRequest`: quitar `X-Frame-Options` y `Content-Security-Policy` **solo** para `sub_frame` de `pathbuilder2e.com` iniciados desde el dominio de la extensión (GitHub Pages / localhost).
- Content script (`all_frames`) en Pathbuilder, activo solo si está embebido en un origen permitido o abierto como popup:
  - escucha `rollDiceDump` (estructurado);
  - observa `#dice-history` y lee `#dice-title` / `#dice-summary` (respaldo, con deduplicación);
  - lee el nombre del personaje activo;
  - reenvía a `window.parent` / `window.opener`.
- **Hecho cuando:** carga "sin empaquetar" y el panel muestra "Puente conectado".

## Fase 5 — Hoja nativa (sin extensión de navegador)
- Importar por ID de exportación (fetch a `json.php`) o pegando el JSON.
- Cálculos PF2e: modificador = ⌊(valor−10)/2⌋; competencia = rango>0 ? rango+nivel : 0; bonos de objeto de `mods`; runas *resilient* en salvaciones; AC y armas desde los totales que exporta Pathbuilder.
- Tiradas: Percepción, salvaciones, habilidades, saberes, DC de clase, ataque de conjuros, golpes (MAP 0/−5/−10 y ágil −4/−8), daño y crítico. Bono situacional global y tirada oculta.
- Personaje guardado en `localStorage`.
- Pruebas unitarias de parser y cálculos con `node --test`.

## Fase 6 — Publicación
- GitHub repo público (GPL exige código abierto) + GitHub Actions → GitHub Pages.
- `companion.zip` descargable desde la misma web.
- `docs/store.md` listo; PR a `owlbear-rodeo/extensions` **solo tras validar la Fase 7 y con capturas reales** (lo abre el autor).
- Opcional: publicar la compañera en Chrome Web Store.

## Fase 7 — Validación manual (checklist en `docs/TESTING.md`)
Requiere navegador real con sesión de Pathbuilder: iframe + Cloudflare, login dentro del iframe, captura de cada tipo de tirada, bandejas de otros jugadores, notificaciones, Discord, hoja nativa con un personaje real. Los fallos de formato se corrigen con muestras del modo depuración del puente.
