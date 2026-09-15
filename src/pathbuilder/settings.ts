import { getPluginId } from "../plugin/getPluginId";

export interface Settings {
  /** Discord webhook URL. Rolls are forwarded when set */
  discordWebhook: string;
  /**
   * "3d": Pathbuilder rolls are re-rolled with 3D dice in the tray.
   * "announce": Pathbuilder's own result is announced without 3D dice.
   */
  pathbuilderMode: "3d" | "announce";
  /** Show an Owlbear notification when anyone finishes a labelled roll */
  showNotifications: boolean;
}

const KEY = getPluginId("settings");
const DEFAULTS: Settings = {
  discordWebhook: "",
  pathbuilderMode: "3d",
  showNotifications: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode); settings then last one session
  }
}
