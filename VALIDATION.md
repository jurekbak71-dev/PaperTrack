# Weryfikacja — 22 października 2026

- `npm ci --cache /tmp/papertrack-npm`: zakończone powodzeniem, instalacja z lockfile.
- `npm run lint`: ESLint i TypeScript strict — poprawne.
- `npm run build`: produkcyjny build, osobny Worker generatora, manifest, ikony i service worker — poprawne.
- `npm test`: 10/10 testów, w tym 1000 seedów żużlowych, 1000 samochodowych, 1000 rajdowych i 100 poziomów kampanii. Końcowy pełny przebieg: 108,95 s. Test sprawdza też ponad 950 różnych geometrii na kategorię i mniej niż 20 użyć wariantu zapasowego na 1000 seedów.
- Po zmianie interpolacji gestów powtórzono grupę `geometria`: 7/7; trzy testy obciążeniowe pominięte wyłącznie w tym celowo zawężonym przebiegu (pełny przebieg powyżej zakończył się powodzeniem).
- `SYSTEM_CHROMIUM=1 npm run test:e2e`: 12/12 — desktop i mobilne rozmiary iPhone/iPad w systemowym Chromium, ukończenie i gwiazdki, podgląd rozwiązania, rekord, restart, offline z nową planszą, kampania, orientacja, anulowanie dotyku, wznowienie, cofanie, krawędź i responsywność podczas generowania.
- Sprawdzono uruchomienie serwera deweloperskiego i renderowanie planszy w przeglądarce.

## WebKit i GitHub Actions

Po zastosowaniu dostępu sieciowego pobrano Chromium i WebKit. Biblioteki WebKit zainstalowano lokalnie bez konta administratora, z podpisanego repozytorium Debian trixie. Sprawdzono wszystkie zależności headless WPE przez `ldd` i załadowanie `libGLESv2` przez `dlopen`. Lokalny walidator Playwright opiera wykrywanie tej biblioteki na systemowym cache `ldconfig`, dlatego w tym wariancie użyto `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` po niezależnym potwierdzeniu dostępności bibliotek. Żadne testy ani weryfikacja podpisów, checksum i TLS nie zostały wyłączone.

Pełny lokalny przebieg Chromium + profile iPhone/iPad w WebKit: **12/12**, 19,9 s. Komenda dla przygotowanego środowiska:

```sh
LD_LIBRARY_PATH=/workspace/.cache/papertrack-browser-libs/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm run test:e2e
```

[GitHub Actions: przebieg 39732088110](https://github.com/jurekbak71-dev/PaperTrack/actions/runs/39732088110) potwierdził sukces całego joba `test`: instalacja, ESLint, typy, 3000 seedów, kampania, build oraz E2E Chromium/WebKit. W CI użyto standardowej instalacji systemowej, bez pomijania walidatora bibliotek.

**Publikacja nie powiodła się:** osobny job `deploy` zwrócił 404 z komunikatem „Ensure GitHub Pages has been enabled”. Repozytorium zgłaszało `has_pages: false`, a próba utworzenia strony przez API zwróciła `403 Resource not accessible by integration`. Użytkownik musi włączyć **Settings → Pages → Source → GitHub Actions**, a następnie ponowić nieudany job publikacji. Nie potwierdzono działającego adresu gry.

Nie wykonano testów na fizycznych urządzeniach iPhone/iPad. Emulacja WebKit nie zastępuje weryfikacji sprzętowej.

## Poprawka sterowania: pojedyncze kliknięcia

Zastąpiono przeciąganie wyborem kolejnych punktów. Osobny klik STARTU rozpoczyna próbę; każdy następny klik sąsiedniego węzła dodaje dokładnie jeden odcinek. Dalsze punkty, przeciąganie, anulowany gest i odcinki poza torem nie modyfikują trasy. Ekran zawiera instrukcję i podświetla wszystkie legalne sąsiednie węzły.

- ESLint i TypeScript strict: poprawne.
- Grupa jednostkowa `geometria`: 8/8, w tym wszystkie osiem kierunków, odrzucanie skoków i pełna kampania. Trzech długich testów seedów nie powtarzano dla zmiany sterowania — generator nie został zmieniony; ich wcześniejszy pełny wynik opisano powyżej.
- E2E Chromium + profile iPhone/iPad w WebKit: **15/15**, 27,5 s. Faktyczne kliknięcia myszą i dotknięcia obejmują pełne ukończenie toru, offline, odmowę skoku, ponowny klik tego samego punktu, przeciąganie, anulowanie, cofanie, restart oraz powiększenie i przesunięcie planszy.
- `npm run package` odtwarza plik HTML i ZIP bez zagnieżdżania wcześniejszych paczek; źródła w ZIP pochodzą z aktualnych plików roboczych.

## Długie proste, wypadki i iloczyn długości oraz kliknięć

Zasady ustalone z użytkownikiem: pion/poziom o dowolnej długości w jednym kliknięciu, przekątna wyłącznie o jedną kratkę; przekątna ma długość 1 segmentu; START nie wchodzi do liczby kliknięć. Wynik jest iloczynem sumy jednostkowych segmentów i kliknięć tworzących odcinki aktualnej trasy. Wygrywa mniejszy iloczyn.

Usunięto podświetlenia i pokazywanie rozwiązania. Samo dotknięcie bandy, także stycznie lub końcem odcinka, kończy próbę wypadkiem i nalicza −5 pkt. Przekroczenie granicy jest sprawdzane na całym długim odcinku. Kary pozostają po restarcie i ponownym otwarciu planszy. Próba z wypadkiem nie zapisuje ukończonego wyniku. Rekordy iloczynu mają osobną przestrzeń zapisu.

- `npm test`: **20/20**, 163,43 s. Obejmuje 3000 seedów, wszystkie 100 poziomów kampanii i odtworzenie optymalnego iloczynu na każdym poziomie, długie proste w czterech kierunkach, przekątne, kontakt z bandą, cofanie, bramki pośrednie, rekordy i niezależne przykłady kompromisu długość/kliknięcia.
- Pełne E2E Chromium + iPhone/iPad w WebKit: **18/18**, 49,2 s. Weryfikują rzeczywiste kliknięcia/dotknięcia, iloczyn, optimum, pełne ukończenie, brak podpowiedzi, wypadek i trwałość kary, offline, kampanię, orientację, cofanie, anulowanie gestu i dopasowanie współrzędnych po powiększeniu/przesunięciu.
- Optimum iloczynu liczy dokładny solver etykiet Pareto (długość, kliknięcia), z kierunkiem i bramkami w stanie; nie jest estymowane na podstawie starej długości ani minimalnej liczby odcinków.

Ograniczenie pozostaje bez zmian: brak testów na fizycznych urządzeniach iOS.

## Iloraz, czerwony przeciwnik, odbicie i progresja kampanii

Aktualna punktacja to **długość ÷ kliknięcia**, nie iloczyn. START nie jest liczony; przekątna ma długość 1. Niebieski gracz i czerwone AI grają naprzemiennie. Zakazane są przecięcia między węzłami, przechodzenie przez zajęte punkty i nakładanie linii. Zakończenie ruchu na punkcie przeciwnika wymusza odbicie; jedynym dopuszczonym nałożeniem jest obowiązkowe cofnięcie po własnym ostatnim odcinku. Po obu ukończeniach porównywane są ilorazy; blokada lub wypadek przegrywa pojedynek.

Nielegalny kierunek, przecięcie, pominięcie bramki lub złe odbicie: **−1 pkt i utrata tury**. Banda: **−5 pkt i przegrana**. Cofanie odtwarza obie strony tury, ale nie anuluje kar. AI nie wykonuje tur po zakończeniu meczu ani po wyjściu do menu.

Domyślne szerokości i marginesy zmniejszono o 10%. Kampania zwęża się monotonicznie od 6,30 do 4,00 kratek; trudniejsze tory samochodowe otrzymały drugi nawrót, rajdy większą krętość, zwiększono liczbę bramek i skrócono ruchy AI na wyższych trudnościach. Naprawiono rozmieszczenie bramek: progres jest liczony względem rzutu na odcinki osi i długości łukowej. Trudne plansze z dwoma nawrotami przechodzą walidację zamiast wracać do prostego wariantu zapasowego.

- `npm test`: **31/31**, 149,31 s. W tym 3000 seedów, 100 poziomów z dwoma osobnymi przejezdnymi startami, monotoniczna szerokość, rzeczywista zmiana geometrii/bramek, tury, przecięcia, odbicie i wyjątek powrotu, niedozwolone nakładanie, wypadek, blokada, zwycięzca i cofanie z zachowaniem kar.
- Pełne E2E Chromium + iPhone/iPad w WebKit: **21/21**, 44,8 s. Pełne przejazdy obu stron, niższy iloraz jako zwycięzca, rekordy, oba kolory, offline z działającym AI, kara i utrata tury, odbicie, trwałość kar, kampania, orientacja i współrzędne po powiększeniu/przesunięciu.
- Nadal bez testów na fizycznym iPhonie/iPadzie. Testy WebKit są testami przeglądarkowymi.

Dodatkowo sprawdzono następujące po sobie odbicia: wolno cofnąć się w obrębie własnego ostatniego odcinka także wtedy, gdy pod nim znajduje się wcześniejsza kopia linii z poprzedniego odbicia. Nowy test regresji oraz ponowne 12/12 testów pojedynku przeszły; ponowiono też scenariusz odbicia w trzech profilach przeglądarkowych (3/3). Obecny zestaw zawiera 32 testy logiki. Samodzielny HTML sprawdzono offline w Chromium i WebKit: oba kolory, pełne przejazdy, zwycięzca według ilorazu, odbicie, kara i utrata tury.
