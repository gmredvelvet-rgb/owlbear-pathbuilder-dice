# Pathbuilder Dice Bridge (extensión compañera)

Extensión para Chrome y Edge (Manifest V3) que usa **Pathbuilder Dice** para Owlbear Rodeo.

## Qué hace
1. **Deja mostrar Pathbuilder dentro del panel.** Quita `X-Frame-Options` y
   `Content-Security-Policy` de las respuestas de `pathbuilder2e.com`, pero **solo** cuando las
   carga un iframe abierto desde el sitio de la extensión (`gmredvelvet-rgb.github.io` o
   `localhost`). Pathbuilder abierto en una pestaña normal no cambia.
2. **Reenvía las tiradas.** Un script dentro de Pathbuilder escucha sus eventos de tirada y su
   historial de dados, y los manda al panel con `postMessage`. Solo actúa si Pathbuilder está
   embebido en un origen permitido o abierto como ventana emergente desde el panel.

No lee ni envía nada más: no toca cookies, credenciales ni tus personajes. Tampoco hace
peticiones de red propias.

## Instalación
1. Descarga `companion.zip` desde el panel (pestaña Ajustes) o desde
   <https://gmredvelvet-rgb.github.io/owlbear-pathbuilder-dice/companion.zip>, y descomprímelo.
2. Abre `chrome://extensions` o `edge://extensions`.
3. Activa el **Modo de desarrollador**.
4. Pulsa **Cargar descomprimida** y elige la carpeta.
5. Recarga Owlbear Rodeo.

## Depuración
En la consola del iframe de Pathbuilder (DevTools → selector de contexto → `pathbuilder2e.com`):

```js
localStorage.pbObrDebug = "1"; location.reload();
```

El puente registrará cada mensaje y el HTML de cada entrada del historial de dados.
