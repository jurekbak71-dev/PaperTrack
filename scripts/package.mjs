import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Export the same production game as a self-contained local HTML document.
const assets = "dist/assets",
  files = readdirSync(assets);
const worker = readFileSync(
  `${assets}/${files.find((f) => /^worker-.*\.js$/.test(f))}`,
  "utf8",
);
let js = readFileSync(
  `${assets}/${files.find((f) => /^index-.*\.js$/.test(f))}`,
  "utf8",
);
let replacements = 0;
js = js.replace(
  /new URL\("\/PaperTrack\/assets\/worker-[^"]+\.js",import\.meta\.url\)/g,
  () => {
    replacements++;
    return `URL.createObjectURL(new Blob([${JSON.stringify(worker)}],{type:"text/javascript"}))`;
  },
);
if (replacements !== 1 || js.includes("import.meta"))
  throw Error("Nieznany format buildu: nie można osadzić Workera.");
// A classic Blob Worker also works with opaque file:// origins; the compiled worker is an IIFE.
js = js
  .replaceAll('{type:"module"}', '{type:"classic"}')
  .replaceAll(
    '"serviceWorker"in navigator',
    'location.protocol!=="file:"&&"serviceWorker"in navigator',
  );
const css = readFileSync(
  `${assets}/${files.find((f) => /^index-.*\.css$/.test(f))}`,
  "utf8",
);
const html = `<!doctype html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Paper Track — klikaj punkty</title><style>${css}</style></head><body><div id="app"></div><script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
mkdirSync("downloads", { recursive: true });
writeFileSync("downloads/PaperTrack.html", html);
writeFileSync(
  "downloads/INSTRUKCJA.txt",
  `PAPER TRACK — POJEDYNEK, ILORAZ = DŁUGOŚĆ ÷ KLIKNIĘCIA\n\n1. Otwórz PaperTrack.html dwuklikiem w Chrome lub Edge.\n2. Wybierz Nowa gra albo Kampania.\n3. Kliknij niebieski punkt START. Ty jesteś niebieski, wirtualny przeciwnik czerwony. Ruchy są naprzemienne. Startujecie z tej samej kropki; jedna strzałka obok toru wskazuje kierunek startu.\n4. Kliknij koniec odcinka: pionowo lub poziomo na dowolną liczbę kratek; po przekątnej tylko o jedną kratkę.\n5. Każda kratka albo jednokratkowa przekątna ma długość 1 segmentu. Wynik = suma długości ÷ kliknięcia rysujące odcinki. START nie jest liczony. Największy wynik wygrywa.\n6. Nie ma podpowiedzi. Banda: -5 pkt i przegrana. Nielegalny ruch: -1 pkt i utrata tury. Kary pozostają po restarcie.\n7. Linie nie mogą się przecinać ani nakładać. Możesz dojechać do zajętego punktu przeciwnika, ale potem musisz cofnąć się dokładnie w przeciwnym kierunku o jedną kratkę po swoim śladzie. Dobrowolne cofanie również tylko raz o jedną kratkę. Potem trzeba zejść na nową ścieżkę; dalsze cofanie lub powrót po tym samym śladzie są zabronione. Dotyczy to także odbicia i AI.\n8. Po obu ukończonych przejazdach wygrywa wyższy iloraz; przy remisie decydują kary. Jednostronna blokada oznacza przegraną, także jeśli jedyne ruchy prowadzą do zapętlenia. Obie strony bez ruchu: PAT — remis, niezależnie od punktów. Ukończony przejazd nie jest blokadą. Trudność 1–10: węższe tory, więcej zakrętów, wysepki i ściany oraz silniejsze AI. Stopień 10: szerokość 1,90 kratki, tylko jednokratkowe przekątne.\n\nNie przeciągaj myszy. Na telefonie dotykaj kolejnych punktów. Przyciskiem + powiększysz planszę.\nCofnij cofa ostatnią akcję gracza i odpowiedź AI, Cofnij 5 cofa kilka tur, Restart rozpoczyna próbę od nowa.\n\nGra HTML działa bez internetu, bez Node.js i bez serwera.\nZIP zawiera także pełne źródła w folderze kod-zrodlowy. W tym folderze: npm ci, następnie npm run dev (Node.js 24).\nNa iPhone otwórz w Safari https://jurekbak71-dev.github.io/PaperTrack/ → Udostępnij → Do ekranu początkowego → Dodaj. Uruchom ikonę z internetem, poczekaj na „Gotowa do gry offline”, potem graj bez sieci. Obróć telefon poziomo (wyłącz blokadę orientacji). Domyślna kratka: 36 px. Przesuwaj kartkę palcem, „Cały tor” oddala, „Twój punkt” przywraca duże kratki. ZIP i lokalny plik z aplikacji Pliki nie zastępują instalacji PWA na iPhonie.\n`,
);
execFileSync(
  "python3",
  [
    "-c",
    String.raw`
from pathlib import Path
import subprocess,zipfile
root=Path.cwd()
files=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z']).decode().split('\0')
with zipfile.ZipFile('downloads/PaperTrack-gotowa-gra.zip','w',zipfile.ZIP_DEFLATED) as archive:
 for filename in ['PaperTrack.html','INSTRUKCJA.txt']:
  archive.write(root/'downloads'/filename,'PaperTrack/'+filename)
 for filename in sorted(set(files)):
  if not filename or filename.startswith('downloads/') or not (root/filename).is_file(): continue
  archive.write(root/filename,'PaperTrack/kod-zrodlowy/'+filename)
`,
  ],
  { stdio: "inherit" },
);
console.log(
  "Gotowe: downloads/PaperTrack.html i downloads/PaperTrack-gotowa-gra.zip",
);
