import React from "react";
import ReactDOM from "react-dom/client";

import CssBaseline from "@mui/material/CssBaseline";

import "./../fonts/fonts.css";
import { GlobalStyles } from "../GlobalStyles";
import { PluginThemeProvider } from "../plugin/PluginThemeProvider";
import { PluginGate } from "../plugin/PluginGate";
import { SheetApp } from "./SheetApp";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PluginThemeProvider>
      <CssBaseline />
      <GlobalStyles />
      <PluginGate>
        <SheetApp />
      </PluginGate>
    </PluginThemeProvider>
  </React.StrictMode>
);
