# Fase 7: validación manual

Las pruebas automáticas (`npm test`) cubren el parser de tiradas y los cálculos del personaje.
Lo que sigue necesita un navegador real, una sala de Owlbear Rodeo y, si es posible, dos
jugadores (puede ser una ventana de incógnito como segundo jugador).

## Preparación
- [ ] La extensión está añadida con `…/manifest.json` y activada en la sala.
- [ ] La extensión compañera está cargada en Chrome o Edge.
- [ ] Para capturar muestras: abre la consola del iframe de Pathbuilder y ejecuta
      `localStorage.pbObrDebug = "1"`, y después recarga. El puente registra el HTML de cada tirada.

## A. Bandeja y sala
- [ ] El icono dorado abre la bandeja y las tiradas manuales funcionan igual que en el Dice oficial.
- [ ] Con el Dice oficial también activado, cada bandeja muestra solo sus propias tiradas.
- [ ] El segundo jugador ve la bandeja flotante con `Personaje · Etiqueta | total`.

## B. Hoja nativa (sin extensión compañera)
- [ ] Importar por ID funciona. Si falla, pegar el JSON funciona.
- [ ] PG, CA, velocidad y CD de clase coinciden con Pathbuilder.
- [ ] Percepción, las 3 salvaciones y 5 habilidades al azar coinciden con Pathbuilder.
- [ ] Un golpe muestra `+X / +X-5 / +X-10`. «Ágil» cambia a −4/−8 y se recuerda.
- [ ] El daño tira los dados correctos (con *striking*). El crítico muestra ×2 en el desglose.
- [ ] Fortuna tira 2d20 y se queda con el mayor. Infortunio se queda con el menor.
- [ ] Una tirada oculta no aparece a los demás ni en Discord.
- [ ] Varias tiradas seguidas (ataque + daño) se ejecutan en orden, sin perder ninguna.
- [ ] Hay notificación en ambos jugadores. Un 20 natural sale en verde y un 1 natural en rojo.

## C. Pathbuilder dentro del panel (con extensión compañera)
- [ ] El iframe carga Pathbuilder. Anota si aparece el reto de Cloudflare y si se resuelve.
- [ ] El indicador cambia a **Puente conectado**.
- [ ] ¿Aparecen tus personajes guardados? Si no, anota si iniciar sesión dentro del iframe lo resuelve (riesgo de almacenamiento particionado).
- [ ] Tirada de salvación → dados 3D con etiqueta correcta.
- [ ] Tirada de habilidad → ídem.
- [ ] Ataque (1.º, 2.º y 3.º MAP) → bono correcto.
- [ ] Daño normal y crítico → dados correctos. Anota si el bono de Pathbuilder ya viene doble.
- [ ] Conjuro con daño → ídem.
- [ ] Una tirada no se duplica (estructurada + historial).
- [ ] En Ajustes, el modo «Solo anunciar» publica el total de Pathbuilder sin dados 3D.
- [ ] Sin extensión compañera: tras unos 12 s aparece la ayuda de instalación.
- [ ] «Abrir en ventana»: las tiradas del popup también llegan a la bandeja.

## D. Discord
- [ ] «Probar» envía el mensaje de prueba.
- [ ] Las tiradas llegan con nombre, total y desglose.

## Si algo falla
Abre un issue con:
1. El paso que falla.
2. El HTML registrado por el modo depuración (sección Preparación).
3. La consola del panel (clic derecho en el panel → Inspeccionar).

Con esas muestras se ajustan `requestFromHistory` / `requestFromDump` en
`src/pathbuilder/protocol.ts` y se añade el caso a `tests/pathbuilder.test.ts`.
