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

## Aktualizacja po haśle „start”: trudność 1–10 i wyższy iloraz

Zaimplementowano komplet zapisanych zmian: wyższy iloraz wygrywa; wyniki obu stron i zwycięzca; dobrowolny powrót i obowiązkowe odbicie wyłącznie o jedną kratkę; przegrana strony bez legalnych ruchów (z uwzględnieniem cofania); progresja 1–10, szerokości 6,30 → 1,90; wysepki i ściany; silniejsze AI. Od trudności 6 AI planuje całe proste, a prawdopodobieństwo lokalnego odejścia od planu maleje do zera na trudności 10. Osobny test porównuje obie strategie na tej samej planszy.

Na trudności 10 obowiązują wyłącznie jednokratkowe przekątne. Generator używa specjalnych krętych korytarzy dopasowanych do diagonalnego komponentu siatki. Wysepki przy bandzie nie odcinają przejazdu. Przy samych ruchach jednostkowych iloraz wynosi zawsze 1, więc rozstrzygają blokada, wypadek albo kary. Nominalna szerokość odnosi się do korytarza przed przeszkodami.

- ESLint i TypeScript strict: poprawne. Produkcyjny build i eksport HTML/ZIP: poprawne.
- Pełne E2E: **27/27**, desktop Chromium oraz profile iPhone/iPad w WebKit, 60 s. Nowe scenariusze obejmują kod trudności 10, odrzucenie prostej, poprawną przekątną, dobrowolne cofanie i karę za cofnięcie o dwie kratki. Po końcowym doprecyzowaniu przecięć przy cofaniu ponowiono 9/9 scenariuszy kampanii, odbicia i cofania oraz 14/14 testów pojedynku.
- Samodzielny `file://` HTML: pełny pojedynek offline, wygrana wyższym wynikiem i otwarcie trudności 10 potwierdzone w Chromium i WebKit; bez błędów JavaScript.
- Fizycznego iPhone/iPada nie testowano. GitHub Pages pozostaje wyłączone (`has_pages: false`, adres zwraca 404); API Pages zwraca 403 z powodu uprawnień integracji. Włączenie wymaga Settings → Pages → GitHub Actions. Pliki do pobrania działają bez publikacji Pages.

Końcowy pełny `npm test`: **37/37**, 157,27 s. Generator sprawdzony na **1000 seedach każdego typu** (łącznie 3000), z trudnością cyklicznie 1–10; minimum szerokości, brak przecięć, spójność, różnorodność (>950 unikalnych geometrii na kategorię), limit wariantów zapasowych (<20 na kategorię) i legalność całej znalezionej trasy przeszły. Osobno zweryfikowano 100 poziomów, oba starty, przeszkody i 60 torów trudności 10. Wcześniejszy wykryty brak przeszkód przy trudności 10 naprawiono; ponowny pełny zestaw jest zielony.

## Wspólny start, jednorazowy powrót i zakaz zapętlenia

Obie strony korzystają z tej samej kropki startu i tej samej mety. Wyjazd ze wspólnego startu nie jest odbiciem. Usunięto numerowane strzałki i etykiety dodatkowego startu/mety AI; pozostała jedna strzałka obok nawierzchni, zgodna z kierunkiem osi. Bramki kontrolują pełny przejazd wewnętrznie, bez rysowania oznaczeń.

Po dobrowolnym albo wymuszonym cofnięciu o jedną kratkę trzeba odejść nową ścieżką. Kolejne cofanie oraz powrót do przodu po zajętym śladzie są zabronione. Reguła dotyczy gracza i AI. Wykrywanie blokady zagląda przez odbicie/cofnięcie do wymaganego nowego wyjścia; samo cofnięcie prowadzące wyłącznie do dalszej pętli nie zapobiega przegranej. Stan obowiązku zmiany ścieżki jest zapisywany w historii i czyszczony przy restarcie. Zwykłe zamknięcie pełnego okrążenia na mecie nadal jest legalne.

- Pełne `npm test`: **41/41**, 166,20 s, w tym ponownie **3000 seedów** i 100 poziomów. Nowe testy obejmują wspólny start, zakaz oscylacji, zmianę ścieżki, blokadę obu stron, odtwarzanie stanu przez undo/reset i poprawny kierunek strzałki poza torem na 100 poziomach.
- Pełne E2E: **30/30**, około 66 s, desktop Chromium i profile iPhone/iPad w WebKit. Testy obejmują oba ukończenia, wynik zwycięzcy, offline, wspólny start, faktycznie rysowane etykiety Canvas (brak numerowanych strzałek i START AI), odbicie, powtórne cofnięcie z karą, restart i trudność 10. Błędne założenie testu, że kara za prostą zawsze natychmiast blokuje gracza na trudności 10, skorygowano po sprawdzeniu istniejącego legalnego wyjścia; zachowano sprawdzenie kary i legalnej przekątnej.
- ESLint, TypeScript strict, build i eksport HTML/ZIP: poprawne.
- Końcowy samodzielny HTML otwarty przez `file://`, bez internetu: pełny pojedynek, wyższy iloraz jako wygrana, wspólny start i brak starych etykiet potwierdzone osobno w Chromium i WebKit, bez błędów JavaScript.
- Nadal bez testów na fizycznym iPhonie/iPadzie. Na iOS zalecana jest instalacja PWA przez Safari z adresu HTTPS; pobrany lokalny plik HTML z aplikacji Pliki nie jest odpowiednikiem instalacji PWA. GitHub Pages wymaga włączenia w ustawieniach repozytorium; poprzednio potwierdzone ograniczenie uprawnień integracji pozostaje.

## PAT i poprawa decyzji awaryjnych AI

Zasada zakończenia jest teraz symetryczna: obie nieukończone strony bez legalnych ruchów oznaczają PAT — remis, niezależnie od ilorazów i kar. Dopiero po wykluczeniu PAT blokada strony, na którą przypada tura, oznacza przegraną. Ukończony przejazd nie jest blokadą; wypadek nadal oznacza natychmiastową przegraną. Sprawdzenie działa przy starcie, zmianie tury i wejściu w ruch AI. Stan PAT jest odtwarzany przy undo i czyszczony przy restarcie. Brak klikniętego STARTU nie jest traktowany jako brak możliwości rysowania.

Przegląd grywalności ujawnił dwie konkretne niespójności: rozstrzyganie obustronnej blokady według kolejności sprawdzania oraz awaryjny wybór pierwszego sąsiada przez AI, często cofnięcia. Dodano wspólne sprawdzenie blokad i preferowanie nowych ścieżek. Od trudności 3 awaryjna decyzja AI uwzględnia wyjścia i postęp; od 6 także wyjścia przeciwnika. Najbliższy ruch AI przechodzi tę samą kontrolę wyjścia z odbicia/cofnięcia co wykrywanie blokady.

Lokalnie ESLint i TypeScript przeszły. Testy logiki: 35/35 poza plikiem core oraz 8/8 grupy geometria w core. Trzy testy stresowe generatora nie były powtarzane lokalnie dla tej poprawki — generator nie został zmieniony; zostają w pełnym workflow CI, a poprzedni pełny przebieg 39752732398 przeszedł również te testy.

GitHub Pages zostało faktycznie włączone przez właściciela repozytorium. Ponowienie publikacji przebiegu https://github.com/jurekbak71-dev/PaperTrack/actions/runs/39752732398 zakończyło się sukcesem. Publiczny adres https://jurekbak71-dev.github.io/PaperTrack/ zwraca grę; uruchomienie planszy i aktywacja service workera potwierdzone przez WebKit z profilem iPhone 13. Nadal nie wykonano testów na fizycznym iPhonie.

Pełne lokalne E2E po poprawce PAT: **33/33**, około 66 s, Chromium i profile iPhone/iPad w WebKit. Osobny scenariusz przez komunikację Web Workera wymusza obustronnie zablokowany graf i sprawdza napis „PAT — remis”, zatrzymanie AI, brak naliczania kar oraz reset. Pozostałe scenariusze pełnego pojedynku, odbicia, cofania, offline i wyników również przeszły.

## Mobilny widok poziomy i instalacja offline

Usunięto przyczynę nieczytelności na telefonie: dopasowanie całej siatki 52×52 do wąskiego ekranu. Na urządzeniu dotykowym gra zajmuje dynamiczną wysokość okna, działa w poziomie i ma prostokątny Canvas. W pionie nakładka prosi o obrót i wyłączenie blokady orientacji; pozwala otworzyć instrukcję instalacji lub wrócić do menu. Manifest preferuje landscape, ale nie zakłada się, że Safari honoruje blokadę z manifestu.

Domyślny rozmiar kratki: **36 CSS px**, regulacja 28–56. Kamera podąża za niebieskim końcem po zaakceptowanym ruchu; przeciąganie przesuwa kartkę i nie dodaje odcinków. „Cały tor” udostępnia świadome oddalenie do przeglądu, a „Twój punkt” przywraca duże kratki. Cała geometria używa tej samej skali X/Y. Desktop zachowuje pełną planszę i sterowanie kliknięciami. Wynik końcowy na telefonie jest na początku przewijanego panelu. Duże przyciski i bezpieczne obszary nie zajmują pola Canvas.

Dodano dostępną z menu, gry i nakładki obrotu instrukcję: Safari → Udostępnij → Do ekranu początkowego → Dodaj. Status „Gotowa do gry offline” pojawia się po gotowości service workera; eksport lokalnego HTML ma ten status od razu, bo zawiera całą grę. ZIP pozostaje wariantem na komputer, a instalacja iPhone korzysta z publicznej wersji HTTPS, bez App Store i pobierania ZIP.

- ESLint/TypeScript i build: poprawne.
- Lokalne testy jednostkowe poza niezmienionym `core.test.ts`: **36/36**, w tym nowy test kamery, proporcji i trafiania w węzły na prostokątnych ekranach.
- Pełne lokalne E2E: **38 przeszło, 1 pominięto jako nieadekwatny do desktopu**, 60 s. Pominięcie dotyczy wyłącznie nowego scenariusza mobilnej orientacji w desktopowym profilu Chromium; oba profile dotykowe WebKit wykonały go w całości. Żaden istniejący scenariusz nie został wyłączony.
- Dodatkowo po końcowej poprawce panelu instalacji powtórzono scenariusze mobilne: **5 przeszło, 1 desktopowy przypadek nieadekwatny**, 13,3 s. Sprawdzono pion 390×844, poziom 844×390 oraz mniejszy ekran 667×320, 36-pikselową kratkę, rzeczywisty tap STARTU i sąsiada, śledzenie końca, przesunięcie bez ruchu, widok całości/powrót, instrukcję oraz gotowość offline po przeładowaniu bez sieci. Długa prosta: po czterech przeciągnięciach widoku o łącznej odległości 40 kratek nadal 0 kliknięć rysujących, a tap końca daje 40 segmentów i jedno kliknięcie, przy niezmienionej kratce 36 px.
- Obejrzano zrzut WebKit iPhone w poziomie: plansza ma **648×279 CSS px**, kratkę 36 px, widoczne przyciski i brak poziomego przepełnienia.
- Generator, reguły i solver nie zmieniły się; pełny workflow CI nadal uruchamia wszystkie testy, w tym 3000 seedów. Nie wykonano testów na fizycznym iPhonie ani fizycznej instalacji z Safari; emulacja WebKit nie zastępuje tej weryfikacji.

Końcowy eksport HTML sprawdzono offline przez `file://`: pełny pojedynek i instrukcja instalacji przeszły w desktop Chromium oraz WebKit z profilem iPhone’a w poziomie. Wariant mobilny zachowuje kratkę 36 px, a po wybraniu „Cały tor” umożliwia długą prostą do mety. Brak błędów JavaScript. ZIP zawiera ten sam HTML i aktualne źródła.
