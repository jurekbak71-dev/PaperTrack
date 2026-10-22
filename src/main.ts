import { SCORE_RULES } from "./game/scoring";
import "./styles/main.css";
import { type Kind, type Track } from "./generator";
import { Game, STAR_THRESHOLDS, CRASH_PENALTY } from "./game";
import { render } from "./rendering";
import { bindNodeClicks } from "./input";
import { load, save, record, type Records, RECORDS_KEY } from "./storage";
const root = document.querySelector<HTMLDivElement>("#app")!;
const names = { oval: "Żużlowy", circuit: "Samochodowy", rally: "Rajdowy" };
let game: Game | undefined,
  track: Track,
  solution: {
    score: number;
    lengthSegments: number;
    clicks: number;
    path: number[];
  },
  level = 0,
  code = "",
  zoom = 1,
  invalid = false;
let pan = { x: 0, y: 0 };
const worker = new Worker(new URL("./generator/worker.ts", import.meta.url), {
  type: "module",
});
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function shell(content: string) {
  root.innerHTML = `<header><div><span class="eyebrow">Wyścig na kartce · 01</span><h1>Paper Track<span style="color:#b64e42">.</span></h1></div><small>Geometria zamiast prędkości</small></header>${content}<footer>Osiem kierunków. Jedna najkrótsza droga. &nbsp; / &nbsp; Papier · atrament · logika · sterowanie kliknięciami</footer>`;
}
function button(id: string, fn: () => void) {
  document.getElementById(id)?.addEventListener("click", fn);
}
let awaiting = false,
  requestId = 0;
function menu() {
  awaiting = false;
  shell(
    `<section class="hero"><span class="eyebrow">Zeszyt do zadań specjalnych</span><h2>Narysuj drogę.<br>Zaoszczędź każdą kratkę.</h2><p>Kliknij START. Proste pionowe i poziome mogą mieć dowolną długość, a przekątne — jedną kratkę. Unikaj band: kontakt to wypadek i kara. Od STARTU do METY, po przecięciach siatki. Zmierz się z geometrią toru i znajdź najkrótszą legalną trasę.</p><div class="actions"><button class="primary" id="new">Nowa gra</button><button id="random">Losowy tor</button><button id="campaign">Kampania</button><button id="records">Moje rekordy</button><button id="settings">Ustawienia</button></div><p class="note">Wynik = długość w segmentach × kliknięcia. Najmniejszy wynik wygrywa. Na torze zamkniętym pokonaj pełne okrążenie przez kolejne numery →.</p></section>`,
  );
  button("new", () => start("oval", 1, String(Date.now())));
  button("random", randomMenu);
  button("campaign", campaignMenu);
  button("records", recordsMenu);
  button("settings", settings);
}
function randomMenu() {
  shell(
    `<h2>Nowy arkusz</h2><label>Rodzaj toru<select id="kind"><option value="oval">Żużlowy</option><option value="circuit">Samochodowy</option><option value="rally">Rajdowy</option></select></label><label>Trudność<select id="difficulty">${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join("")}</select></label><label>Kod identycznej planszy (opcjonalnie)<input id="seed" maxlength="120" placeholder="PT1-…"></label><div class="actions"><button id="generate" class="primary">Generuj tor</button><button id="menu">Menu</button></div><p id="error" role="alert"></p>`,
  );
  button("menu", menu);
  button("generate", () => {
    const input = (
      document.querySelector("#seed") as HTMLInputElement
    ).value.trim();
    if (input) {
      try {
        const match = /^PT1-(oval|circuit|rally)-([1-5])-(.+)$/.exec(input);
        if (!match) throw Error();
        start(match[1] as Kind, +match[2], decodeURIComponent(match[3]));
      } catch {
        document.querySelector("#error")!.textContent =
          "Niepoprawny kod planszy.";
      }
    } else
      start(
        (document.querySelector("#kind") as HTMLSelectElement).value as Kind,
        +(document.querySelector("#difficulty") as HTMLSelectElement).value,
        String(Date.now()),
      );
  });
}
function campaignMenu() {
  const records = load<Records>(RECORDS_KEY, {});
  shell(
    `<h2>Kampania · 100 kartek</h2><p>Każdy poziom ma stały seed. Możesz ćwiczyć dowolną planszę.</p><div class="actions"><button id="menu">Menu</button></div><div class="levels">${Array.from({ length: 100 }, (_, i) => `<button data-level="${i + 1}">${i + 1}<br><small>${"★".repeat(records[`level-${i + 1}`]?.stars ?? 0)}</small></button>`).join("")}</div>`,
  );
  root
    .querySelectorAll<HTMLButtonElement>("[data-level]")
    .forEach(
      (b) => (b.onclick = () => start("oval", 1, "", +b.dataset.level!)),
    );
  button("menu", menu);
}
function recordsMenu() {
  const records = load<Records>(RECORDS_KEY, {});
  shell(
    `<h2>Moje rekordy</h2>${
      Object.keys(records).length
        ? Object.entries(records)
            .map(
              ([key, r]) =>
                `<p>${escape(key)} · <b>wynik ${r.score} (${r.lengthSegments} × ${r.clicks}); kary: ${r.penaltyPoints} pkt</b> · ${"★".repeat(r.stars)}</p>`,
            )
            .join("")
        : "<p>Jeszcze czysta kartka. Ukończ pierwszy tor!</p>"
    }<button id="menu">Menu</button>`,
  );
  button("menu", menu);
}
function settings() {
  shell(
    `<h2>Ustawienia</h2><label><input type="checkbox" id="ink" ${load("largeInk", false) ? "checked" : ""}> Powiększone oznaczenia / wysoki kontrast</label><p>Instalacja: w Safari wybierz Udostępnij → Do ekranu początkowego. W Chrome / Edge wybierz Zainstaluj aplikację. Po pełnym wczytaniu gra działa offline.</p><p>Rekordy są przechowywane na tym urządzeniu. Tryb prywatny może ograniczać zapis.</p><button id="menu">Menu</button>`,
  );
  document.querySelector("#ink")!.addEventListener("change", (e) => {
    save("largeInk", (e.target as HTMLInputElement).checked);
  });
  button("menu", menu);
}
function start(kind: Kind, difficulty: number, seed: string, l = 0) {
  invalid = false;
  awaiting = true;
  level = l;
  game = undefined;
  zoom = 1;
  pan = { x: 0, y: 0 };
  shell(
    '<h2>Rysuję tor…</h2><p role="status">Sprawdzam graf ruchów i obliczam najkrótszą trasę.</p><button id="menu">Menu</button>',
  );
  button("menu", menu);
  worker.postMessage({
    seed,
    kind,
    difficulty,
    level: l,
    requestId: ++requestId,
  });
}
worker.onmessage = (event) => {
  if (!awaiting || event.data.requestId !== requestId) return;
  awaiting = false;
  if (event.data.error) {
    shell(
      `<h2>Nie udało się przygotować toru</h2><p>${escape(event.data.error)}</p><button id="menu">Menu</button>`,
    );
    button("menu", menu);
    return;
  }
  track = event.data.track;
  solution = event.data.solution;
  code = `PT1-${track.kind}-${track.difficulty}-${encodeURIComponent(track.seed)}`;
  game = new Game(track, load<number>(`penalties:${code}`, 0));
  screen();
};
function draw() {
  const canvas = document.querySelector<HTMLCanvasElement>("canvas");
  if (canvas && game)
    render(
      canvas,
      track,
      game.path,
      invalid,
      zoom,
      pan,
      load("largeInk", false),
      game.started,
      game.crashPoint,
    );
}
function screen() {
  shell(
    `<div class="actions"><button id="menu">← Menu</button><button id="share">Udostępnij kod</button></div><span class="eyebrow">${names[track.kind]} · ${level ? `Poziom ${level}` : `Trudność ${track.difficulty}`}</span><div class="layout"><div><p class="click-help"><b>1.</b> Kliknij czerwony START. <b>2.</b> Kliknij koniec odcinka. <b>Pion / poziom: dowolna długość. Przekątna: jedna kratka.</b></p><canvas aria-label="Tor: kliknij START, potem końce odcinków pionowych, poziomych lub jednokratkowych przekątnych" id="board"></canvas><div class="actions"><button id="zoomout" aria-label="Oddal">−</button><button id="zoomin" aria-label="Przybliż">+</button><button id="fit">Dopasuj</button><button id="left" aria-label="Przesuń w lewo">←</button><button id="right" aria-label="Przesuń w prawo">→</button><button id="up" aria-label="Przesuń w górę">↑</button><button id="down" aria-label="Przesuń w dół">↓</button></div></div><aside><small>Wynik · mniej znaczy lepiej</small><p class="metric" id="score">0</p><p><span id="length-segments">0</span> segmentów × <span id="clicks">0</span> kliknięć</p><p id="penalties">Kary na tym torze: ${game!.penaltyPoints} pkt</p><p class="note">${track.kind === "rally" ? "Przejdź kolejne bramki do mety." : "Pełne okrążenie zgodnie z numerami →."} Prosto w pionie lub poziomie możesz pokonać wiele kratek jednym kliknięciem. Przekątna ma najwyżej jedną kratkę. Długość to liczba jednostkowych segmentów siatki (przekątna: ${SCORE_RULES.diagonalLength === 1 ? "1" : "√2"}). Wynik = długość × liczba kliknięć rysujących odcinki. Kontakt z bandą kończy próbę: −${CRASH_PENALTY} pkt. Na telefonie dotykaj punktów. Do małych kratek użyj przycisku +.</p><div class="actions"><button id="undo">Cofnij</button><button id="undo5">Cofnij 5</button><button id="clear">Wyczyść</button><button id="restart">Restart</button></div><p id="status" class="status" role="status">Kliknij czerwony punkt START.</p><div id="result"></div><div class="actions"><button id="next">${level ? "Następny poziom" : "Następny tor"}</button></div><small style="word-break:break-all">${escape(code)}</small></aside></div>`,
  );
  button("menu", menu);
  button("undo", () => undo(1));
  button("undo5", () => undo(5));
  button("clear", reset);
  button("restart", reset);
  button("next", next);
  button("zoomin", () => {
    zoom = Math.min(2.5, zoom + 0.25);
    draw();
  });
  button("zoomout", () => {
    zoom = Math.max(1, zoom - 0.25);
    draw();
  });
  button("fit", () => {
    zoom = 1;
    pan = { x: 0, y: 0 };
    draw();
  });
  for (const [id, x, y] of [
    ["left", 3, 0],
    ["right", -3, 0],
    ["up", 0, 3],
    ["down", 0, -3],
  ] as const)
    button(id, () => {
      pan.x = Math.max(-20, Math.min(20, pan.x + x));
      pan.y = Math.max(-20, Math.min(20, pan.y + y));
      draw();
    });
  button("share", () => {
    const url = new URL(location.href);
    url.hash = code;
    if (navigator.clipboard)
      navigator.clipboard
        .writeText(url.href)
        .then(() => status("Link skopiowany."))
        .catch(() => status(code));
    else status(code);
  });
  const canvas = document.querySelector("canvas")!;
  const point = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.round(
        (((e.clientX - r.left) / r.width) * track.size - track.size / 2) /
          zoom +
          track.size / 2 -
          pan.x,
      ),
      y: Math.round(
        (((e.clientY - r.top) / r.height) * track.size - track.size / 2) /
          zoom +
          track.size / 2 -
          pan.y,
      ),
    };
  };
  bindNodeClicks(
    canvas,
    point,
    (node) => {
      if (!game) return;
      const result = game.select(node);
      invalid = [
        "need-start",
        "direction",
        "illegal",
        "crash",
        "crashed",
      ].includes(result);
      const messages = {
        start: "START wybrany. Kliknij koniec swojego pierwszego odcinka.",
        move: "Segment dodany.",
        same: "To aktualny koniec trasy. Kliknij inny punkt.",
        "need-start": "Najpierw kliknij czerwony punkt START.",
        direction:
          "Długa prosta może być tylko pionowa lub pozioma. Przekątna ma najwyżej jedną kratkę.",
        illegal: "Ten ruch omija wymaganą bramkę. Trasa nie została zmieniona.",
        done: "Tor ukończony!",
        crash: `Wypadek! Dotknięcie bandy: −${CRASH_PENALTY} pkt. Rozpocznij ponowną próbę.`,
        crashed: "Próba zakończyła się wypadkiem. Kliknij Restart.",
      };
      status(messages[result]);
      if (result === "crash") save(`penalties:${code}`, game.penaltyPoints);
      update();
    },
    () => status("Klikaj pojedyncze punkty. Przeciąganie nie dodaje odcinków."),
  );
  draw();
}
function status(text: string) {
  const el = document.querySelector("#status");
  if (el) el.textContent = text;
}
function formatScore(value: number) {
  return value.toLocaleString("pl-PL", { maximumFractionDigits: 3 });
}
function update() {
  if (!game) return;
  document.querySelector("#score")!.textContent = formatScore(game.score);
  document.querySelector("#length-segments")!.textContent = formatScore(
    game.lengthSegments,
  );
  document.querySelector("#clicks")!.textContent = String(game.clicks);
  document.querySelector("#penalties")!.textContent =
    `Kary na tym torze: ${game.penaltyPoints} pkt`;
  draw();
  if (game.crashed) {
    document.querySelector("#result")!.innerHTML =
      `<h2>Wypadek!</h2><p>Próba przerwana po ${formatScore(game.lengthSegments)} segmentach (${game.clicks} kliknięć).<br>Punkty karne: <b>${game.penaltyPoints} pkt</b>. Kara −${CRASH_PENALTY} pkt za wypadek pozostaje po restarcie.</p><button id="again">Zagraj ponownie</button>`;
    button("again", reset);
    return;
  }
  if (game.done) {
    const ratio = game.score / solution.score,
      stars =
        ratio <= STAR_THRESHOLDS[0] + 1e-9
          ? 3
          : ratio <= STAR_THRESHOLDS[1] + 1e-9
            ? 2
            : 1;
    const key = level ? `level-${level}` : code;
    const saved = record(key, {
        score: game.score,
        lengthSegments: game.lengthSegments,
        clicks: game.clicks,
        stars,
        level,
        penaltyPoints: game.penaltyPoints,
      }),
      best = load<Records>(RECORDS_KEY, {})[key];
    document.querySelector("#result")!.innerHTML =
      `<h2>Meta! ${"★".repeat(stars)}</h2><p>Wynik: <b>${formatScore(game.score)}</b> = ${formatScore(game.lengthSegments)} segmentów × ${game.clicks} kliknięć<br>Najmniejszy możliwy wynik: ${formatScore(solution.score)}<br>Rekord: ${best ? formatScore(best.score) : "—"}<br>Punkty karne: ${game.penaltyPoints} pkt</p><button id="again">Zagraj ponownie</button>${saved ? "" : "<p>Nie udało się zapisać rekordu.</p>"}`;
    button("again", reset);
  }
}

function undo(n: number) {
  if (!game) return;
  if (game.crashed) {
    status("Wypadek zakończył próbę. Kliknij Restart. Kara pozostaje.");
    return;
  }
  while (n--) game.undo();
  invalid = false;
  status(
    game.started
      ? "Kliknij koniec następnego odcinka."
      : "Kliknij czerwony punkt START.",
  );
  document.querySelector("#result")!.innerHTML = "";
  update();
}
function reset() {
  game?.clear();
  invalid = false;
  document.querySelector("#result")!.innerHTML = "";
  status("Kliknij czerwony punkt START.");
  update();
}
function next() {
  if (level) start("oval", 1, "", level === 100 ? 1 : level + 1);
  else start(track.kind, track.difficulty, String(Date.now()));
}
window.addEventListener("resize", draw);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {}),
  );
try {
  const match = /^PT1-(oval|circuit|rally)-([1-5])-(.+)$/.exec(
    location.hash.slice(1),
  );
  if (match) start(match[1] as Kind, +match[2], decodeURIComponent(match[3]));
  else menu();
} catch {
  menu();
}
