import { defineConfig, Plugin } from "vite";
// @ts-ignore
import { resolve } from "path";
import react from "@vitejs/plugin-react";

declare var __dirname: string;
declare var process: { env: Record<string, string | undefined> };

const PKG_VERSION = "1.0.0";

/**
 * Owlbear Rodeo resolves manifest paths against the site origin, not the
 * manifest location, so every URL is written as an absolute URL.
 * Set SITE_URL when building for a sub path (e.g. GitHub Pages).
 */
function obrManifest(): Plugin {
  let siteUrl = "";
  const build = () => {
    const url = (path: string) => new URL(path, siteUrl).href;
    return JSON.stringify(
      {
        name: "Pathbuilder Dice",
        version: PKG_VERSION,
        manifest_version: 1,
        author: "TheGmStudio",
        homepage_url: "https://github.com/gmredvelvet-rgb/owlbear-pathbuilder-dice",
        icon: url("logo.png"),
        description:
          "3D dice tray + Pathbuilder 2e character sheet. Pathbuilder rolls land in the Owlbear dice tray.",
        action: {
          title: "Pathbuilder Dice",
          icon: url("icon.svg"),
          popover: url("index.html"),
          height: 700,
          width: 375,
        },
        background_url: url("background.html"),
      },
      null,
      2
    );
  };
  return {
    name: "obr-manifest",
    configResolved(config) {
      const fallback =
        config.command === "serve" ? "http://localhost:5173/" : "http://localhost:4173/";
      siteUrl = process.env.SITE_URL || fallback;
      if (!siteUrl.endsWith("/")) siteUrl += "/";
    },
    configureServer(server) {
      server.middlewares.use("/manifest.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(build());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "manifest.json", source: build() });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), obrManifest()],
  assetsInclude: ["**/*.glb", "**/*.hdr"],
  server: { cors: true },
  preview: { cors: true },
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        popover: resolve(__dirname, "popover.html"),
        background: resolve(__dirname, "background.html"),
        sheet: resolve(__dirname, "sheet.html"),
      },
    },
  },
});
