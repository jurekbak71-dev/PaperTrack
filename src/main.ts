import { Duel, ILLEGAL_PENALTY, type GameMode } from "./game/duel";
import { SCORE_RULES } from "./game/scoring";
import "./styles/main.css";
import { type Kind, type Track } from "./generator";
import { Game, STAR_THRESHOLDS, CRASH_PENALTY } from "./game";
import { camera, nodeAt } from "./rendering/camera";
import { render } from "./rendering";
import { bindNodeClicks } from "./input";
import { load, save, record, type Records, RECORDS_KEY } from "./storage";
const root = document.querySelector<HTMLDivElement>("#app")!;
const names = { oval: "Żużlowy", circuit: "Samochodowy", rally: "Rajdowy" };
let game: Game | undefined,
  track: Track,
  level = 0,
  code = "",
  zoom = 1,
  invalid = false;
let duel: Duel | undefined;
let opponentTimer: ReturnType<typeof setTimeout> | null = null;
let recorded = false;
const requestedMode =
  new URLSearchParams(location.search).get("mode") ??
  load<string>("gameMode", "duel");
let selectedMode: GameMode = requestedMode === "solo" ? "solo" : "duel";
function modeChoice() {
  return `<label>Tryb gry<select id="game-mode"><option value="solo" ${selectedMode === "solo" ? "selected" : ""}>Gra solo</option><option value="duel" ${selectedMode === "duel" ? "selected" : ""}>Z wirtualnym przeciwnikiem</option></select></label>`;
}
function bindMode(refresh?: () => void) {
  document
    .querySelector<HTMLSelectElement>("#game-mode")
    ?.addEventListener("change", (e) => {
      selectedMode = (e.target as HTMLSelectElement).value as GameMode;
      save("gameMode", selectedMode);
      const url = new URL(location.href);
      url.searchParams.set("mode", selectedMode);
      history.replaceState(null, "", url);
      refresh?.();
    });
}
function recordKey() {
  const key = level ? `level-${level}` : code;
  return duel?.mode === "solo" ? `solo:${key}` : key;
}
function penaltyKey() {
  return `penalties:${duel?.mode === "solo" ? "solo:" : ""}${code}`;
}

let mobileCell = 36,
  viewMode: "follow" | "manual" | "overview" = "follow";
const mobile = () =>
  matchMedia("(pointer: coarse) and (max-width: 1200px)").matches;
let offlineReady = location.protocol === "file:";
let offlineError = false;
function offlineText() {
  if (offlineError)
    return "Tryb offline niedostępny — sprawdź połączenie i odśwież stronę.";
  return offlineReady
    ? "Gotowa do gry offline"
    : "Pobieranie gry do trybu offline…";
}
function offlineLabels() {
  document
    .querySelectorAll("[data-offline]")
    .forEach((el) => (el.textContent = offlineText()));
}
function installGuide() {
  document.querySelector("#install-guide")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "install-guide";
  dialog.innerHTML = `<button id="close-install" class="close-guide">Zamknij</button><h2>Gra na iPhonie — instalacja</h2><ol><li>Otwórz <a href="https://jurekbak71-dev.github.io/PaperTrack/">Paper Track</a> w <b>Safari</b>. Jeśli jesteś w aplikacji ChatGPT, wybierz „Otwórz w Safari”.</li><li>Naciśnij <b>Udostępnij</b> — kwadrat ze strzałką w górę. Przycisk może być w menu Safari.</li><li>Wybierz <b>Do ekranu początkowego</b>, potem <b>Dodaj</b>. Jeśli pojawi się „Otwieraj jako aplikację”, pozostaw włączone.</li><li>Uruchom ikonę Paper Track przy włączonym internecie. Poczekaj na komunikat <b>„Gotowa do gry offline”</b>. Potem możesz grać bez internetu.</li><li>Obróć iPhone’a <b>poziomo</b>. Jeżeli ekran się nie obraca, wyłącz blokadę orientacji w Centrum sterowania.</li></ol><p data-offline role="status">${offlineText()}</p><p>Dotykaj kolejnych punktów. Przesuwaj kartkę palcem, aby oglądać dalszy fragment. „Twój punkt” przywraca kamerę, „Cały tor” pokazuje całą planszę. Nie potrzebujesz App Store ani pliku ZIP.</p>`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector("button")!.onclick = () => dialog.close();
}

function cancelOpponent() {
  if (opponentTimer !== null) clearTimeout(opponentTimer);
  opponentTimer = null;
}
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
  document.body.classList.remove("playing", "solo-game");
  root.innerHTML = `<header><div><span class="eyebrow">Wyścig na kartce · 01</span><h1>Paper Track<span style="color:#b64e42">.</span></h1></div><small>Geometria zamiast prędkości</small></header>${content}<footer>Graj solo lub z wirtualnym przeciwnikiem. &nbsp; / &nbsp; Papier · atrament · logika · sterowanie kliknięciami</footer>`;
}
function button(id: string, fn: () => void) {
  document.getElementById(id)?.addEventListener("click", fn);
}
let awaiting = false,
  requestId = 0;
function menu() {
  awaiting = false;
  cancelOpponent();
  duel = undefined;
  shell(
    `<section class="hero"><span class="eyebrow">Zeszyt do zadań specjalnych</span><h2>Sam lub przeciw AI.<br>Wyznacz swoją trasę.</h2><p>Kliknij START. Proste pionowe i poziome mogą mieć dowolną długość, a przekątne — jedną kratkę. Unikaj band: kontakt to wypadek i kara. Od STARTU do METY, po przecięciach siatki. Wybierz grę solo i poprawiaj rekord albo graj naprzemiennie z czerwonym przeciwnikiem. Unikaj przecięć. Wyższy iloraz długości do kliknięć jest lepszy.</p>${modeChoice()}<div class="actions"><button class="primary" id="new">Nowa gra</button><button id="random">Losowy tor</button><button id="campaign">Kampania</button><button id="records">Moje rekordy</button><button id="settings">Ustawienia</button><button id="install">Jak zainstalować na iPhonie?</button></div><p data-offline role="status">${offlineText()}</p><p class="note">Wynik = długość w segmentach ÷ kliknięcia. Większy wynik jest lepszy. Na torze zamkniętym pokonaj pełne okrążenie w kierunku strzałki.</p></section>`,
  );
  bindMode();
  button("new", () => start("oval", 1, String(Date.now())));
  button("random", randomMenu);
  button("campaign", campaignMenu);
  button("records", recordsMenu);
  button("settings", settings);
  button("install", installGuide);
}
function randomMenu() {
  shell(
    `<h2>Nowy arkusz</h2>${modeChoice()}<label>Rodzaj toru<select id="kind"><option value="oval">Żużlowy</option><option value="circuit">Samochodowy</option><option value="rally">Rajdowy</option></select></label><label>Trudność<select id="difficulty">${Array.from(
      { length: 10 },
      (_, i) => i + 1,
    )
      .map((n) => `<option>${n}</option>`)
      .join(
        "",
      )}</select></label><label>Kod identycznej planszy (opcjonalnie)<input id="seed" maxlength="120" placeholder="PT1-…"></label><div class="actions"><button id="generate" class="primary">Generuj tor</button><button id="menu">Menu</button></div><p id="error" role="alert"></p>`,
  );
  button("menu", menu);
  bindMode();
  button("generate", () => {
    const input = (
      document.querySelector("#seed") as HTMLInputElement
    ).value.trim();
    if (input) {
      try {
        const match = /^PT1-(oval|circuit|rally)-(10|[1-9])-(.+)$/.exec(input);
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
    `<h2>Kampania · 100 kartek</h2>${modeChoice()}<p>Każdy poziom ma stały seed. 10 stopni trudności, po 10 poziomów. Coraz węższe tory, więcej zakrętów i przeszkód oraz silniejsze AI. Trudność 10: szerokość najwyżej 2 kratki i ruchy wyłącznie po przekątnych.</p><div class="actions"><button id="menu">Menu</button></div><div class="levels">${Array.from({ length: 100 }, (_, i) => `<button data-level="${i + 1}">${i + 1}<br><small>${"★".repeat(records[`${selectedMode === "solo" ? "solo:" : ""}level-${i + 1}`]?.stars ?? 0)}</small></button>`).join("")}</div>`,
  );
  bindMode(campaignMenu);
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
                `<p>${escape(key)} · <b>wynik ${r.score} (${r.lengthSegments} ÷ ${r.clicks}); kary: ${r.penaltyPoints} pkt</b> · ${"★".repeat(r.stars)}</p>`,
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
  cancelOpponent();
  duel = undefined;
  recorded = false;
  invalid = false;
  awaiting = true;
  level = l;
  game = undefined;
  zoom = 1;
  viewMode = "follow";
  mobileCell = 36;
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

  code = `PT1-${track.kind}-${track.difficulty}-${encodeURIComponent(track.seed)}`;
  duel = new Duel(
    track,
    load<number>(
      `penalties:${selectedMode === "solo" ? "solo:" : ""}${code}`,
      0,
    ),
    event.data.redTrack,
    selectedMode,
  );
  game = duel.player;
  screen();
};
function draw() {
  const canvas = document.querySelector<HTMLCanvasElement>("canvas");
  if (canvas && game) {
    if (mobile()) {
      const rect = canvas.getBoundingClientRect();
      zoom =
        viewMode === "overview"
          ? Math.min(1, rect.height / rect.width)
          : (mobileCell * track.size) / rect.width;
      if (viewMode === "follow") {
        const p = track.nodes[game.last];
        pan = { x: track.size / 2 - p.x, y: track.size / 2 - p.y };
      }
    }
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
      duel?.mode === "duel"
        ? {
            path: duel.opponent.path,
            start: duel.opponent.track.start,
            finish: duel.opponent.track.finish,
          }
        : null,
    );
  }
}
function screen() {
  shell(
    `<div class="actions game-menu"><button id="menu">← Menu</button><button id="share">Udostępnij kod</button><button id="install">Instalacja / offline</button><button id="rules">Zasady</button><span data-offline class="offline-badge">${offlineText()}</span></div><div class="rotate-screen" role="status"><span class="rotate-icon">↻</span><h2>Obróć iPhone’a poziomo</h2><p>Większe kratki i wygodniejsza plansza.<br>Wyłącz blokadę orientacji w Centrum sterowania, jeśli ekran się nie obraca.</p><button id="rotate-install">Jak zainstalować grę offline?</button><button id="rotate-menu">Wróć do menu</button></div><span class="eyebrow track-info">${duel!.mode === "solo" ? "Gra solo" : "Pojedynek z AI"} · ${names[track.kind]} · ${level ? `Poziom ${level} · ` : ""}Trudność ${track.difficulty}/10 · szerokość ${track.width.toFixed(2)} kr.</span><div class="layout"><div class="board-panel"><p class="click-help"><b>1.</b> Kliknij niebieski START. <b>2.</b> Kliknij koniec odcinka. <b>${track.difficulty === 10 ? "Trudność 10: wyłącznie przekątne o jedną kratkę." : "Pion / poziom: dowolna długość. Przekątna: jedna kratka."}</b></p><canvas aria-label="Tor: kliknij START, potem końce odcinków pionowych, poziomych lub jednokratkowych przekątnych" id="board"></canvas><div class="actions view-controls"><button id="zoomout" aria-label="Oddal">−</button><button id="zoomin" aria-label="Przybliż">+</button><button id="fit">Cały tor</button><button id="follow">Twój punkt</button><button id="left" aria-label="Przesuń w lewo">←</button><button id="right" aria-label="Przesuń w prawo">→</button><button id="up" aria-label="Przesuń w górę">↑</button><button id="down" aria-label="Przesuń w dół">↓</button></div></div><aside><p class="players"><b style="color:#173d8a">${duel!.mode === "solo" ? "Gra solo — niebieski" : "● Ty — niebieski"}</b>${duel!.mode === "duel" ? ' · <b style="color:#c33131">● AI — czerwony</b>' : ""}</p><p id="turn" role="status">Twoja tura</p><small>Twój iloraz · więcej znaczy lepiej</small><p class="metric" id="score">0</p><p><span id="length-segments">0</span> segmentów ÷ <span id="clicks">0</span> kliknięć</p><p class="opponent-stat" style="color:#c33131">Przeciwnik: <b id="opponent-score">0</b> = <span id="opponent-length">0</span> ÷ <span id="opponent-clicks">0</span></p><p id="penalties">Kary na tym torze: ${game!.penaltyPoints} pkt</p><p class="note">${track.kind === "rally" ? "Dotrzyj do mety, zaczynając w kierunku strzałki." : "Pokonaj pełne okrążenie w kierunku strzałki."} Prosto w pionie lub poziomie możesz pokonać wiele kratek jednym kliknięciem. Przekątna ma najwyżej jedną kratkę. Długość to liczba jednostkowych segmentów siatki (przekątna: ${SCORE_RULES.diagonalLength === 1 ? "1" : "√2"}). Wynik = długość ÷ liczba kliknięć rysujących odcinki. ${duel!.mode === "duel" ? "Ruchy na zmianę. Linie nie mogą się przecinać. Dotknięcie zajętego punktu przeciwnika wymusza powrót o jedną kratkę." : "Gra solo: rysujesz sam. Własna linia nie może się przecinać."} Możesz cofnąć się raz o jedną kratkę, potem musisz odejść nową ścieżką. Pętle są zabronione. ${duel!.mode === "duel" ? "Blokada jednej strony oznacza jej przegraną. Obie strony bez ruchu: PAT — remis. Obaj startujecie z tej samej kropki." : "Brak ruchu bez zapętlenia kończy próbę porażką. Ukończ tor i poprawiaj swój rekord."} Trudność 10: tylko jednokratkowe przekątne. Kontakt z bandą: −${CRASH_PENALTY} pkt i przegrana. Nielegalny ruch: −${ILLEGAL_PENALTY} pkt${duel!.mode === "duel" ? " i utrata tury" : ""}. Na telefonie dotykaj punktów. Do małych kratek użyj przycisku +.</p><div class="actions duel-actions"><button id="undo">Cofnij</button><button id="undo5">Cofnij 5</button><button id="clear">Wyczyść</button><button id="restart">Restart</button></div><p id="status" class="status" role="status">Kliknij niebieski punkt START.</p><div id="result"></div><div id="match-result" role="status"></div><div class="actions"><button id="next">${level ? "Następny poziom" : "Następny tor"}</button></div><small class="track-code" style="word-break:break-all">${escape(code)}</small></aside></div>`,
  );
  document.body.classList.add("playing");
  document.body.classList.toggle("solo-game", duel!.mode === "solo");
  if (mobile())
    document
      .querySelector("aside")!
      .prepend(document.querySelector("#match-result")!);
  button("install", installGuide);
  button("rotate-install", installGuide);
  button("rotate-menu", menu);
  button("rules", () => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = `<h2>Jak grać</h2><p>${document.querySelector("aside .note")!.textContent}</p><button>Zamknij</button>`;
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector("button")!.onclick = () => dialog.remove();
  });
  button("menu", menu);
  button("undo", () => undo(1));
  button("undo5", () => undo(5));
  button("clear", reset);
  button("restart", reset);
  button("next", next);
  button("zoomin", () => {
    if (mobile()) {
      mobileCell = Math.min(56, mobileCell + 4);
      viewMode = "follow";
    } else zoom = Math.min(2.5, zoom + 0.25);
    draw();
  });
  button("zoomout", () => {
    if (mobile()) {
      mobileCell = Math.max(28, mobileCell - 4);
      viewMode = "follow";
    } else zoom = Math.max(1, zoom - 0.25);
    draw();
  });
  button("fit", () => {
    viewMode = "overview";
    zoom = 1;
    pan = { x: 0, y: 0 };
    draw();
  });
  button("follow", () => {
    viewMode = "follow";
    if (!mobile()) {
      const p = track.nodes[game!.last];
      pan = { x: 26 - p.x, y: 26 - p.y };
    }
    draw();
  });
  for (const [id, x, y] of [
    ["left", 3, 0],
    ["right", -3, 0],
    ["up", 0, 3],
    ["down", 0, -3],
  ] as const)
    button(id, () => {
      viewMode = "manual";
      pan.x = Math.max(-20, Math.min(20, pan.x + x));
      pan.y = Math.max(-20, Math.min(20, pan.y + y));
      draw();
    });
  button("share", () => {
    const url = new URL(location.href);
    url.hash = code;
    url.searchParams.set("mode", duel!.mode);
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
    return nodeAt(
      e.clientX - r.left,
      e.clientY - r.top,
      camera(r.width, r.height, track.size, zoom, pan),
    );
  };
  bindNodeClicks(
    canvas,
    point,
    (node) => {
      if (!game || !duel) return;
      const before = game.penaltyPoints;
      const result = duel.select(node);
      game = duel.player;
      if (["move", "bounce", "start"].includes(result) && mobile())
        viewMode = "follow";
      invalid = [
        "need-start",
        "direction",
        "illegal",
        "crash",
        "crashed",
        "crossing",
        "reverse",
        "loop",
      ].includes(result);
      const messages = {
        start: "START wybrany. Kliknij koniec swojego pierwszego odcinka.",
        turn: "Teraz ruch przeciwnika. Poczekaj na swoją turę.",
        crossing: `Linie nie mogą się przecinać ani nakładać: −${ILLEGAL_PENALTY} pkt i utrata tury.`,
        loop: `Po cofnięciu musisz zmienić ścieżkę — kolejne cofanie lub pętla: −${ILLEGAL_PENALTY} pkt i utrata tury.`,
        reverse: `Powrót po śladzie: tylko jedna kratka; po odbiciu w przeciwnym kierunku: −${ILLEGAL_PENALTY} pkt i utrata tury.`,
        bounce:
          "Odbicie! W następnej turze cofnij się dokładnie w przeciwnym kierunku po ostatnim odcinku.",
        finished: "Pojedynek zakończony. Wybierz Restart albo następny tor.",
        move: "Segment dodany.",
        same: "To aktualny koniec trasy. Kliknij inny punkt.",
        "need-start": "Najpierw kliknij niebieski punkt START.",
        direction:
          "Długa prosta może być tylko pionowa lub pozioma. Przekątna ma najwyżej jedną kratkę. −1 pkt i utrata tury.",
        illegal: `Ten ruch jest niezgodny z przebiegiem toru: −${ILLEGAL_PENALTY} pkt i utrata tury.`,
        done: "Tor ukończony!",
        crash: `Wypadek! Dotknięcie bandy: −${CRASH_PENALTY} pkt. Rozpocznij ponowną próbę.`,
        crashed: "Próba zakończyła się wypadkiem. Kliknij Restart.",
      };
      status(
        duel.mode === "solo"
          ? messages[result]
              .replaceAll(" i utrata tury", "")
              .replace("Pojedynek zakończony", "Próba zakończona")
          : messages[result],
      );
      if (game.penaltyPoints !== before) save(penaltyKey(), game.penaltyPoints);
      update();
    },
    () =>
      status(
        mobile()
          ? "Kartka przesunięta. Dotknij punktu, aby wykonać ruch. Przeciąganie nie dodaje odcinków."
          : "Klikaj pojedyncze punkty. Przeciąganie nie dodaje odcinków.",
      ),
    (dx, dy) => {
      if (!mobile() || viewMode === "overview") return;
      const cell = (canvas.getBoundingClientRect().width / track.size) * zoom;
      viewMode = "manual";
      pan.x = Math.max(-26, Math.min(26, pan.x + dx / cell));
      pan.y = Math.max(-26, Math.min(26, pan.y + dy / cell));
      draw();
    },
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
  if (!game || !duel) return;
  game = duel.player;
  document.querySelector("#opponent-score")!.textContent = formatScore(
    duel.opponent.score,
  );
  document.querySelector("#opponent-length")!.textContent = formatScore(
    duel.opponent.lengthSegments,
  );
  document.querySelector("#opponent-clicks")!.textContent = String(
    duel.opponent.clicks,
  );
  document.querySelector("#turn")!.textContent = duel.winner
    ? duel.mode === "solo"
      ? "Próba zakończona"
      : "Pojedynek zakończony"
    : duel.turn === "player"
      ? "Twoja tura — niebieski"
      : "Tura przeciwnika — czerwony";
  document.querySelector("#match-result")!.textContent =
    duel.mode === "solo"
      ? duel.winner
        ? `${duel.winner === "player" ? "Tor ukończony!" : "Próba zakończona."} ${duel.reason}. Wynik: ${formatScore(game.score)}.`
        : ""
      : duel.winner
        ? `${duel.winner === "draw" ? (duel.pat ? "PAT — remis." : "Remis") : duel.winner === "player" ? "Wygrywasz!" : "Wygrywa przeciwnik."} ${duel.reason}. Ty: ${formatScore(game.score)}, AI: ${formatScore(duel.opponent.score)}.`
        : "";
  if (duel.winner && mobile()) document.querySelector("aside")!.scrollTo(0, 0);
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
    const ratio = game.score,
      stars =
        ratio >= STAR_THRESHOLDS[1] - 1e-9
          ? 3
          : ratio >= STAR_THRESHOLDS[0] - 1e-9
            ? 2
            : 1;
    const key = recordKey();
    const saved =
      recorded ||
      record(key, {
        score: game.score,
        lengthSegments: game.lengthSegments,
        clicks: game.clicks,
        stars,
        level,
        penaltyPoints: game.penaltyPoints,
      });
    recorded = saved;
    const best = load<Records>(RECORDS_KEY, {})[key];
    document.querySelector("#result")!.innerHTML =
      `<h2>Meta! ${"★".repeat(stars)}</h2><p>Wynik: <b>${formatScore(game.score)}</b> = ${formatScore(game.lengthSegments)} segmentów ÷ ${game.clicks} kliknięć<br>Rekord: ${best ? formatScore(best.score) : "—"}<br>Punkty karne: ${game.penaltyPoints} pkt</p><button id="again">Zagraj ponownie</button>${saved ? "" : "<p>Nie udało się zapisać rekordu.</p>"}`;
    button("again", reset);
  }
  scheduleOpponent();
}

function scheduleOpponent() {
  if (
    !duel ||
    duel.mode === "solo" ||
    duel.winner ||
    duel.turn !== "opponent" ||
    opponentTimer !== null
  )
    return;
  const current = duel;
  opponentTimer = setTimeout(
    () => {
      opponentTimer = null;
      if (duel !== current) return;
      duel.playOpponent();
      game = duel.player;
      if (duel.reverse.player)
        status(
          "Odbicie: następny ruch musi iść dokładnie przeciwnie do poprzedniego.",
        );
      else if (duel.mustBranch.player)
        status(
          "Po cofnięciu wybierz nową ścieżkę. Ponowne cofanie jest zabronione.",
        );
      update();
    },
    duel.player.done ? 50 : 350,
  );
}

function undo(n: number) {
  if (!game || !duel) return;
  if (game.crashed) {
    status("Wypadek zakończył próbę. Kliknij Restart. Kara pozostaje.");
    return;
  }
  cancelOpponent();
  while (n--) duel.undo();
  game = duel.player;
  recorded = false;
  invalid = false;
  status(
    game.started
      ? "Kliknij koniec następnego odcinka."
      : "Kliknij niebieski punkt START.",
  );
  if (duel.reverse.player)
    status(
      "Odbicie: następny ruch musi iść dokładnie przeciwnie do poprzedniego.",
    );
  document.querySelector("#result")!.innerHTML = "";
  update();
}
function reset() {
  viewMode = "follow";
  cancelOpponent();
  duel?.clear();
  game = duel?.player;
  recorded = false;
  invalid = false;
  document.querySelector("#result")!.innerHTML = "";
  status("Kliknij niebieski punkt START.");
  update();
}
function next() {
  if (level) start("oval", 1, "", level === 100 ? 1 : level + 1);
  else start(track.kind, track.difficulty, String(Date.now()));
}
window.addEventListener("resize", draw);
window.visualViewport?.addEventListener("resize", draw);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        offlineReady = true;
        offlineLabels();
      })
      .catch(() => {
        offlineError = true;
        offlineLabels();
      });
  });
try {
  const match = /^PT1-(oval|circuit|rally)-(10|[1-9])-(.+)$/.exec(
    location.hash.slice(1),
  );
  if (match) start(match[1] as Kind, +match[2], decodeURIComponent(match[3]));
  else menu();
} catch {
  menu();
}
