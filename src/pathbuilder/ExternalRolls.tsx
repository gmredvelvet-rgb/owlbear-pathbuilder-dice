import { useEffect, useRef } from "react";

import { useDiceRollStore } from "../dice/store";
import { useDiceControlsStore } from "../controls/store";
import { getDieFromDice } from "../helpers/getDieFromDice";
import { RollRequest } from "./protocol";
import { removePending, subscribeRollRequests, takePendingRolls } from "./queue";
import { requestToDiceRoll } from "./toDiceRoll";
import { announceResult, buildResult } from "./announce";

/** Minimum time a finished roll stays on screen before the next queued one */
const MIN_DISPLAY_MS = 1800;

/**
 * Receives roll requests from the character sheet and rolls them in this
 * tray one after another, then announces each labelled result to the room.
 */
export function ExternalRolls() {
  const queue = useRef<RollRequest[]>([]);
  const seen = useRef(new Set<string>());
  const lastFinishedAt = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    function isBusy() {
      const { roll, rollValues } = useDiceRollStore.getState();
      return Boolean(roll) && Object.values(rollValues).some((v) => v === null);
    }

    function processNext() {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      if (queue.current.length === 0 || isBusy()) {
        return;
      }
      const wait = lastFinishedAt.current + MIN_DISPLAY_MS - Date.now();
      if (wait > 0) {
        timer.current = window.setTimeout(processNext, wait);
        return;
      }
      const request = queue.current.shift()!;
      const hidden = useDiceControlsStore.getState().diceHidden;
      useDiceRollStore.getState().startRoll(requestToDiceRoll(request, hidden));
    }

    function enqueue(request: RollRequest) {
      if (!request?.id || seen.current.has(request.id)) {
        return;
      }
      seen.current.add(request.id);
      removePending(request.id);
      queue.current.push(request);
      processNext();
    }

    const unsubscribeChannel = subscribeRollRequests(enqueue);
    takePendingRolls().forEach(enqueue);

    let announcedKey = "";
    const unsubscribeStore = useDiceRollStore.subscribe((state) => {
      const values = Object.values(state.rollValues);
      const finished =
        state.roll !== null && values.length > 0 && values.every((v) => v !== null);
      if (!finished || !state.roll) {
        return;
      }
      const key = getDieFromDice(state.roll)
        .map((die) => die.id)
        .join(",");
      if (key === announcedKey) {
        return;
      }
      announcedKey = key;
      lastFinishedAt.current = Date.now();
      if (state.roll.label) {
        buildResult(state.roll, state.rollValues as Record<string, number>, key).then(
          (result) => result && announceResult(result)
        );
      }
      processNext();
    });

    return () => {
      unsubscribeChannel();
      unsubscribeStore();
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, []);

  return null;
}
