import OBR from "@owlbear-rodeo/sdk";

import { getPluginId } from "../plugin/getPluginId";
import { RollRequest } from "./protocol";

/**
 * The sheet and the tray are separate iframes on the same origin.
 * Requests go through a BroadcastChannel for live delivery and are also
 * queued in localStorage so a tray that is still opening picks them up.
 */
const CHANNEL = getPluginId("roll-requests");
const PENDING_KEY = getPluginId("pending-rolls");
const MAX_AGE_MS = 15000;

type Pending = RollRequest & { sentAt: number };

function readPending(): Pending[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const list = raw ? (JSON.parse(raw) as Pending[]) : [];
    return list.filter((p) => Date.now() - p.sentAt < MAX_AGE_MS);
  } catch {
    return [];
  }
}

function writePending(list: Pending[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    // Live delivery through the channel still works
  }
}

export async function sendRollRequest(request: RollRequest) {
  writePending([...readPending(), { ...request, sentAt: Date.now() }]);
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage(request);
  channel.close();
  if (OBR.isAvailable && !(await OBR.action.isOpen())) {
    await OBR.action.open();
  }
}

/** Remove and return queued requests that are still fresh */
export function takePendingRolls(): RollRequest[] {
  const list = readPending();
  writePending([]);
  return list;
}

export function removePending(id: string) {
  writePending(readPending().filter((p) => p.id !== id));
}

export function subscribeRollRequests(callback: (request: RollRequest) => void) {
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event) => callback(event.data as RollRequest);
  return () => channel.close();
}

/** Room wide channel for finished roll results */
export const RESULT_CHANNEL = getPluginId("roll-result");
