// Pathbuilder Dice Bridge — runs inside Pathbuilder 2e.
// Forwards Pathbuilder's rolls to the Owlbear Rodeo sheet panel that embeds it
// (or opened it as a popup). It does nothing on a normal Pathbuilder tab.
(() => {
  "use strict";

  const VERSION = "1.0.0";
  const SOURCE = "pb-obr-bridge";
  // Origins allowed to embed Pathbuilder and receive rolls
  const ALLOWED_PARENTS = [
    /^https:\/\/gmredvelvet-rgb\.github\.io$/,
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  ];

  const debug = (() => {
    try {
      return localStorage.getItem("pbObrDebug") === "1";
    } catch {
      return false;
    }
  })();
  const log = (...args) => debug && console.log("[PB Dice Bridge]", ...args);

  let target = null;
  let targetOrigin = "*";

  if (window !== window.top) {
    const parentOrigin = location.ancestorOrigins && location.ancestorOrigins[0];
    if (!parentOrigin || !ALLOWED_PARENTS.some((re) => re.test(parentOrigin))) {
      return;
    }
    target = window.parent;
    targetOrigin = parentOrigin;
  } else if (window.opener) {
    // Popup opened by the sheet panel. The opener's origin cannot be read
    // cross-origin; roll data is not sensitive.
    target = window.opener;
  } else {
    return;
  }

  function getCharacter() {
    const builds = document.querySelectorAll("#active-builds .button-active-build.button-text");
    if (builds.length >= 2) {
      return builds[1].textContent.split("-")[0].trim() || undefined;
    }
    const name = document.querySelector("#character-name, .character-name");
    return name ? name.textContent.trim() || undefined : undefined;
  }

  function post(message) {
    const payload = { source: SOURCE, character: getCharacter(), ...message };
    log("post", payload);
    try {
      target.postMessage(payload, targetOrigin);
    } catch (error) {
      log("postMessage failed", error);
    }
  }

  // Handshake so the panel can show "bridge connected"
  post({ kind: "hello", version: VERSION });
  let helloCount = 0;
  const helloTimer = setInterval(() => {
    post({ kind: "hello", version: VERSION });
    if (++helloCount >= 30) clearInterval(helloTimer);
  }, 10000);

  // 1) Structured roll events Pathbuilder posts to its own window
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || !Array.isArray(data.rollDiceDump) || data.status !== "pending") return;
    post({
      kind: "dump",
      data: {
        rollDiceDump: data.rollDiceDump.map((die) => ({
          numDice: Number(die.numDice),
          diceSize: Number(die.diceSize),
          extraCritDice: die.extraCritDice === true,
        })),
        rollBonus: Number(data.rollBonus) || 0,
        type: typeof data.type === "string" ? data.type : undefined,
        title: typeof data.title === "string" ? data.title : undefined,
      },
    });
  });

  // 2) Fallback: watch the dice history list
  function textOf(element) {
    if (!element) return "";
    const clone = element.cloneNode(true);
    clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    return (clone.textContent || "").trim();
  }

  function summaryText() {
    const summary = document.getElementById("dice-summary");
    if (!summary) return "";
    return Array.from(summary.childNodes)
      .map((node) => (node.nodeType === Node.TEXT_NODE ? node.textContent.trim() : ""))
      .join("");
  }

  function latestHistoryItem() {
    return document.querySelector("#dice-history .dice-history-item:not(.dddice), .dice-history-item:not(.dddice)");
  }

  let lastHtml = latestHistoryItem()?.innerHTML || "";
  let scheduled = false;

  function checkHistory() {
    scheduled = false;
    const item = latestHistoryItem();
    if (!item || item.innerHTML === lastHtml) return;
    lastHtml = item.innerHTML;
    log("history item html", item.innerHTML);
    post({
      kind: "history",
      title: document.getElementById("dice-title")?.textContent?.trim() || undefined,
      summary: summaryText() || undefined,
      text: textOf(item),
    });
  }

  new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      setTimeout(checkHistory, 150);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  log("ready", { targetOrigin, version: VERSION });
})();
