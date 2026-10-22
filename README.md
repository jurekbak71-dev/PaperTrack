# Paper Track — pojedynek na kartce

[Uruchom grę w Safari / przeglądarce](https://jurekbak71-dev.github.io/PaperTrack/). Na iPhonie: Udostępnij → Do ekranu początkowego.

Logiczna gra PWA po polsku, bez pojazdów i fizyki. Gracz rysuje **niebieską**, a wirtualny przeciwnik **czerwoną** linię. Ruchy są naprzemienne, linie ograniczają sobie przejazd.

## Sterowanie

Kliknij **niebieski START**, potem koniec odcinka na przecięciu siatki. Pionowo lub poziomo można pokonać dowolną liczbę kratek jednym kliknięciem. Przekątna może mieć tylko jedną kratkę. Na telefonie dotykaj kolejnych punktów. Przeciąganie nie rysuje. Podczas tury AI kliknięcia planszy nie wykonują ruchu i nie są karane.

Przyciski + / − powiększają widok, strzałki przesuwają kartkę, „Dopasuj” przywraca całość. Nie ma podświetlania legalnych ruchów ani pokazywania rozwiązania. Obok toru jest jedna strzałka kierunku startu. Numery i strzałki bramek nie są rysowane; wewnętrzne bramki nadal sprawdzają pełne okrążenie.

## iPhone: poziomo i offline

Nie trzeba pobierać ZIP ani korzystać z App Store. Otwórz https://jurekbak71-dev.github.io/PaperTrack/ **w Safari**, wybierz **Udostępnij → Do ekranu początkowego → Dodaj**. Uruchom ikonę przy włączonym internecie i poczekaj na **„Gotowa do gry offline”**. Następne rozgrywki działają bez sieci. Przyciski „Jak zainstalować na iPhonie?” w menu i „Instalacja / offline” podczas gry zawierają instrukcję krok po kroku.

Na telefonie i tablecie gra jest przeznaczona do orientacji **poziomej**. W pionie planszę zasłania instrukcja obrotu; można wrócić do menu lub otworzyć instalację. Safari może ignorować blokadę orientacji z manifestu — wtedy obróć telefon ręcznie i wyłącz blokadę orientacji w Centrum sterowania. Układ używa dynamicznej wysokości okna i bezpiecznych obszarów iOS.

Kratka ma domyślnie **36 CSS px**, regulacja 28–56 px. Kamera pokazuje fragment toru i podąża za niebieskim końcem po zaakceptowanym ruchu. Przeciągnięcie jednym palcem przesuwa kartkę i nigdy nie rysuje. **„Cały tor”** oddala całą planszę, aby obejrzeć trasę lub wybrać daleki koniec prostej. **„Twój punkt”** przywraca duże kratki i śledzenie. Osiem kierunków, koszty i reguły pojedynku pozostają takie same. Kratki są kwadratowe także na prostokątnym Canvas.

## Wynik to ILORAZ

**Wynik = długość trasy w jednostkowych segmentach ÷ liczba kliknięć rysujących odcinki. Większy wynik wygrywa.**

Jedna kratka prosto lub po przekątnej ma długość 1. START nie zwiększa liczby kliknięć. Nietrafione kliknięcia i przyciski interfejsu nie zwiększają licznika odcinków. Przed pierwszym odcinkiem wynik to 0, nie NaN lub nieskończoność.

Przykład: odcinki długości 5 i 3 narysowane dwoma kliknięciami dają **8 ÷ 2 = 4**. Ta sama długość narysowana ośmioma jednokratkowymi ruchami daje **8 ÷ 8 = 1**. Przy tych zasadach długie proste poprawiają iloraz, ale po każdym ruchu swoją turę dostaje przeciwnik, który może zablokować drogę.

Gdy jeden gracz ukończy przejazd, drugi kończy swoje tury. Po obu przejazdach porównywane są ilorazy; przy remisie decyduje mniejsza kara (0 pkt przed −1 pkt), a potem jest remis. Zakończony przejazd gracza zapisuje rekord lokalny. Gwiazdki: wynik co najmniej 4 — ★★★, co najmniej 2 — ★★, poniżej 2 — ★ (`STAR_THRESHOLDS` w `src/game/index.ts`). Na trudności 10 wszystkie ruchy są jednostkowe, więc iloraz wynosi 1: o wygranej decyduje przede wszystkim blokada lub wypadek, potem kary. Nie są prognozą wygranej przeciw poruszającemu się AI.

Nowe rekordy mają przestrzeń `records-quotient-no-loops-v3`, oddzielną od poprzednich wyników iloczynu. Punkty karne są prezentowane osobno i rozstrzygają remis; iloraz zachowuje dokładnie wzór długość ÷ kliknięcia.

## Linie i odbicie

Nie wolno przecinać czerwonej ani własnej wcześniejszej linii, również między węzłami siatki. Zabronione jest nakładanie odcinków. Kolejne własne odcinki mogą mieć wspólny punkt początku/końca.

Można **zakończyć odcinek w punkcie zajętym przez przeciwnika**, także na środku jego długiej prostej. Jest to odbicie, a nie przecięcie. W swojej następnej turze trzeba wykonać ruch **dokładnie w przeciwnym kierunku**, dokładnie o jedną kratkę. Można też dobrowolnie cofać po własnym śladzie, tylko raz o jedną kratkę (również po przekątnej). Następny ruch musi odejść na nową ścieżkę — dalsze cofanie lub powrót do przodu po starym śladzie są zabronione. Po odejściu na nową ścieżkę można ponownie skorzystać z jednego cofnięcia. Reguła dotyczy także obowiązkowego odbicia i AI. Nie można przejechać przez zajęty punkt i pojechać dalej.

Zamknięcie pełnego okrążenia może dotknąć własnego STARTU/METY. Odcinek kończący poprawny przejazd kończy obowiązek ruchu tego gracza. Obaj zawodnicy startują z tej samej kropki i mają wspólną metę. Samo wyjście ze wspólnego startu nie jest odbiciem. Przez cały przejazd nie wolno nakładać linii; dojście do wspólnej mety po poprawnym przejeździe jest dozwolone.

## Kary i cofanie

- **Banda: −5 pkt i przegrany pojedynek.** Sprawdzany jest cały odcinek, końce, styczność i pokrywanie z bandą. Czerwony znak wskazuje pierwszy kontakt.
- **Nielegalny ruch: −1 pkt i utrata tury.** Dotyczy długiej przekątnej, nieprawidłowego kierunku, przecięcia/nakładania linii, pominięcia wymaganej bramki lub złamania obowiązkowego odbicia. Linia gracza nie jest wtedy dodawana; AI wykonuje swoją turę.
- Brak jakiegokolwiek ruchu bez zapętlenia przegrywa pojedynek. Cofnięcie nie jest wyjściem, jeśli po nim nie ma nowej ścieżki; nie można w nieskończoność odbijać się między zajętymi punktami. **Gdy obie nieukończone strony są zablokowane jednocześnie, jest PAT — remis**, bez rozstrzygania ilorazem lub karami. Sprawdzane są obie strony, więc wynik nie zależy od kolejności tur. Ukończenie przejazdu nie jest blokadą. Limit tur zabezpiecza przed niekończącą się partią.
- Wybór STARTU, kliknięcie aktualnego końca, anulowany gest i kliknięcia podczas oczekiwania na AI nie są karane.

„Cofnij” odtwarza stan sprzed ostatniej akcji gracza, razem z odpowiedzią AI. „Cofnij 5” cofa kilka takich akcji. Kary pozostają naliczone. Wypadku nie można cofnąć. Restart przywraca wspólny start dla obu stron i pierwszą turę, zachowując kary na tym torze. Są one zapisywane także po ponownym otwarciu planszy.

## Kampania i przeciwnik

Kampania ma 100 deterministycznych poziomów. W ekranie gry widać trudność i szerokość.

Trudność wzrasta od 1 do 10, co 10 poziomów. Szerokość maleje od 6,30 do 1,90 kratki. Przybywa łuków, nawrotów i bramek. Od trudności 3 pojawiają się wysepki i krótkie ściany: docelowo `floor(trudność / 2)` przeszkód. Generator sprawdza całe odcinki i zachowuje sprawdzoną trasę omijającą przeszkody. Kontakt z przeszkodą jest wypadkiem jak kontakt z bandą.

Na trudności 10 stosowana jest osobna kręta geometria na diagonalnej siatce: wyłącznie jednokratkowe przekątne, bez pionów i poziomów. Dwa kolory siatki mają oddzielne komponenty; graf zawiera komponent startu. Wysepki na tym wąskim torze leżą przy krawędziach i nie odcinają jedynej ciągłej linii przejazdu. Szerokość nominalna opisuje korytarz przed dodaniem przeszkód, nie prześwit obok wysepki. Ze wspólnego startu istnieje sprawdzony pełny przejazd, bez gwarancji przejezdności po wzajemnym blokowaniu.

AI planuje po legalnym grafie z bramkami i aktualnymi liniami. Na niższych stopniach czasem wybiera lokalny wariant, coraz rzadziej wraz ze wzrostem trudności. Od trudności 6 wyszukuje drogę po całych prostych, minimalizując liczbę kliknięć w planie. Wydłuża proste, aby poprawiać iloraz. Poziom 10 nie popełnia losowych błędów wyboru. Jeśli nie ma pełnej zaplanowanej trasy, AI preferuje nowy ślad zamiast cofania; od trudności 3 bierze pod uwagę własne wyjścia i postęp, a od 6 także wyjścia gracza. Odrzuca odbicia i cofnięcia prowadzące jedynie do zapętlenia. AI nie ma dostępu do przyszłych ruchów gracza.

Tryb losowy ma trzy typy torów i dziesięć trudności. Kod `PT1-typ-trudność-seed` odtwarza planszę według bieżącej wersji zasad. W kampanii używane są seedy `kampania-v3-numer`.

## Gotowa gra do pobrania

`downloads/PaperTrack.html` działa po otwarciu dwuklikiem w Chrome/Edge, bez internetu i instalowania Node.js. ZIP `downloads/PaperTrack-gotowa-gra.zip` zawiera HTML, instrukcję i pełne źródła. Na iPhone/iPad instalacja PWA wymaga wersji hostowanej przez HTTPS; podgląd pobranego pliku nie zastępuje instalacji webowej.

## Rozwój i testowanie

Wymagane Node.js 24 i npm 11:

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run preview
```

Baza aplikacji: `/PaperTrack/`. Lint uruchamia ESLint i TypeScript strict. Testy obejmują po 1000 seedów każdego typu, 100 poziomów, przejezdność obu startów, progresję szerokości, geometrię, iloraz, tury, odbicie, przecięcia, blokadę, AI, zwycięzcę, kary, cofanie i zapis rekordów.

```sh
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

E2E testuje desktop Chromium oraz profile iPhone/iPad w WebKit: pełny pojedynek, ilorazy obu graczy, zmianę tur, odbicie, utratę tury, karę i wypadek, oba ukończenia, rekordy, offline, kampanię i skalowanie. Wariant `SYSTEM_CHROMIUM=1 npm run test:e2e` korzysta wyłącznie z systemowego Chromium i nie zastępuje testów WebKit.

Odświeżenie plików do pobrania (wymaga także Python 3):

```sh
npm run package
```

## Architektura i PWA

- `src/game/duel.ts`: tury, wspólny start i meta, legalność kontaktu między liniami, odbicie, planowanie AI, wynik pojedynku i historia całych tur.
- `src/game/index.ts`: pojedynczy przejazd, długie proste, bramki pośrednie, banda, długość i kliknięcia.
- `src/game/scoring.ts`: iloraz i koszt przekątnej 1.
- `src/geometry`: analityczna geometria, pierwszy kontakt z bandą i dokładne przecięcia/nałożenia linii.
- `src/generator`: oś, granice, kontrola topologii/szerokości, graf i przejezdność. Bramki wynikają z rzutowania na odcinki osi oraz jej długości łukowej, nie z nieregularnej gęstości punktów łuków. Najwyżej pięć prób i zweryfikowany wariant zapasowy.
- `src/solver`: Dijkstra do walidacji przejazdu. Każda jednostkowa trasa ma iloraz 1; nie stosuje się starego solvera iloczynu ani nie obiecuje optimum przeciw dynamicznemu AI.
- `src/input`, `src/rendering`, `src/storage`: kliknięcia/touch, Canvas HiDPI bez podpowiedzi, osobne rekordy i kary.

Generowanie działa w Web Workerze. AI uruchamia się tylko podczas swojej tury. Renderowanie odbywa się po zmianach, bez ciągłej pętli 60 FPS. Reset, cofanie i menu anulują oczekującą odpowiedź AI.

Manifest, ikony 192/512 px, service worker i cache umożliwiają instalację i grę offline po pierwszym pełnym wczytaniu. Układ obsługuje safe areas, orientacje i kwadratową siatkę. Fizycznych urządzeń iOS nie testowano.

Workflow `.github/workflows/pages.yml` uruchamia instalację, lint, testy, build, E2E i publikację `dist`. W GitHub wymagane jest **Settings → Pages → Source → GitHub Actions**. Sukces buildu nie dowodzi publikacji; potwierdza ją job `deploy`. Pull requesty nie publikują.
