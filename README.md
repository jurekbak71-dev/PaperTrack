# Paper Track — pojedynek na kartce

Logiczna gra PWA po polsku, bez pojazdów i fizyki. Gracz rysuje **niebieską**, a wirtualny przeciwnik **czerwoną** linię. Ruchy są naprzemienne, linie ograniczają sobie przejazd.

## Sterowanie

Kliknij **niebieski START**, potem koniec odcinka na przecięciu siatki. Pionowo lub poziomo można pokonać dowolną liczbę kratek jednym kliknięciem. Przekątna może mieć tylko jedną kratkę. Na telefonie dotykaj kolejnych punktów. Przeciąganie nie rysuje. Podczas tury AI kliknięcia planszy nie wykonują ruchu i nie są karane.

Przyciski + / − powiększają widok, strzałki przesuwają kartkę, „Dopasuj” przywraca całość. Nie ma podświetlania legalnych ruchów ani pokazywania rozwiązania. Numery bramek określają obowiązkową kolejność przejazdu.

## Wynik to ILORAZ

**Wynik = długość trasy w jednostkowych segmentach ÷ liczba kliknięć rysujących odcinki. Mniejszy wynik wygrywa.**

Jedna kratka prosto lub po przekątnej ma długość 1. START nie zwiększa mnożnika. Nietrafione kliknięcia i przyciski interfejsu nie zwiększają licznika odcinków. Przed pierwszym odcinkiem wynik to 0, nie NaN lub nieskończoność.

Przykład: odcinki długości 5 i 3 narysowane dwoma kliknięciami dają **8 ÷ 2 = 4**. Ta sama długość narysowana ośmioma jednokratkowymi ruchami daje **8 ÷ 8 = 1**. Przy tych zasadach wiele krótkich ruchów poprawia iloraz, ale po każdym ruchu swoją turę dostaje przeciwnik, który może zablokować drogę.

Gdy jeden gracz ukończy przejazd, drugi kończy swoje tury. Po obu przejazdach porównywane są ilorazy; przy remisie decyduje mniejsza kara (0 pkt przed −1 pkt), a potem jest remis. Zakończony przejazd gracza zapisuje rekord lokalny. Gwiazdki porównują iloraz do matematycznej dolnej granicy 1: do 1,02 — ★★★, do 1,10 — ★★, powyżej — ★. Nie są prognozą wygranej przeciw poruszającemu się AI.

Nowe rekordy mają przestrzeń `records-quotient-duel-v1`, oddzielną od poprzednich wyników iloczynu. Punkty karne są prezentowane osobno; nie odejmuje się ich od ilorazu, co premiowałoby karane ruchy.

## Linie i odbicie

Nie wolno przecinać czerwonej ani własnej wcześniejszej linii, również między węzłami siatki. Zabronione jest nakładanie odcinków. Kolejne własne odcinki mogą mieć wspólny punkt początku/końca.

Można **zakończyć odcinek w punkcie zajętym przez przeciwnika**, także na środku jego długiej prostej. Jest to odbicie, a nie przecięcie. W swojej następnej turze trzeba wykonać ruch **dokładnie w przeciwnym kierunku**, nie dalej niż długość własnego odcinka, którym dojechano do kontaktu. Jedynym wyjątkiem od zakazu nakładania jest to obowiązkowe cofnięcie po własnym ostatnim odcinku. Potem można odejść w inną stronę. Nie można przejechać przez zajęty punkt i pojechać dalej.

Zamknięcie pełnego okrążenia może dotknąć własnego STARTU/METY. Odcinek kończący poprawny przejazd kończy obowiązek ruchu tego gracza. Każdy gracz ma osobny start; na rajdzie także osobną metę.

## Kary i cofanie

- **Banda: −5 pkt i przegrany pojedynek.** Sprawdzany jest cały odcinek, końce, styczność i pokrywanie z bandą. Czerwony znak wskazuje pierwszy kontakt.
- **Nielegalny ruch: −1 pkt i utrata tury.** Dotyczy długiej przekątnej, nieprawidłowego kierunku, przecięcia/nakładania linii, pominięcia wymaganej bramki lub złamania obowiązkowego odbicia. Linia gracza nie jest wtedy dodawana; AI wykonuje swoją turę.
- Brak jakiegokolwiek legalnego ruchu przegrywa pojedynek. Limit tur zabezpiecza przed niekończącą się partią.
- Wybór STARTU, kliknięcie aktualnego końca, anulowany gest i kliknięcia podczas oczekiwania na AI nie są karane.

„Cofnij” odtwarza stan sprzed ostatniej akcji gracza, razem z odpowiedzią AI. „Cofnij 5” cofa kilka takich akcji. Kary pozostają naliczone. Wypadku nie można cofnąć. Restart przywraca oba starty i pierwszą turę, zachowując kary na tym torze. Są one zapisywane także po ponownym otwarciu planszy.

## Kampania i przeciwnik

Kampania ma 100 deterministycznych poziomów. W ekranie gry widać trudność, szerokość oraz liczbę bramek.

| Poziomy | Zmiana trudności                                                                  |
| ------- | --------------------------------------------------------------------------------- |
| 1–10    | łagodne owale, mniej bramek, AI dopuszcza dłuższe proste                          |
| 11–25   | więcej łuków, tory samochodowe i rajdowe                                          |
| 26–50   | nawrót i bardziej kręte rajdy                                                     |
| 51–75   | dwa nawroty w torach samochodowych, więcej bramek, krótsze ruchy AI               |
| 76–100  | najwęższe konfiguracje, silniejsze zakręty rajdowe, AI stawia jednostkowe odcinki |

Szerokość nominalna maleje na **każdym** poziomie: od 6,30 do 4,00 kratek. Domyślne tory są co najmniej 10% węższe od poprzedniej wersji; przeskalowano także margines geometryczny. Zawężenie nie omija walidacji szerokości, spójności i pełnego przejazdu. Oba osobne starty są sprawdzane pod kątem przejezdności. Nie oznacza to gwarantowanej wygranej — blokowanie drogi jest częścią pojedynku.

AI planuje po legalnym grafie, uwzględnia bramki, aktualne linie obu graczy i obowiązek odbicia. Nie wykonuje ruchów przez bandę ani przez zajęte odcinki. Wybór długości prostych zależy od trudności i deterministycznego seeda partii.

Tryb losowy ma trzy typy torów i pięć trudności. Kod `PT1-typ-trudność-seed` odtwarza planszę według bieżącej wersji zasad. W kampanii używane są seedy `kampania-v2-numer`.

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

- `src/game/duel.ts`: tury, osobne starty/mety, legalność kontaktu między liniami, odbicie, planowanie AI, wynik pojedynku i historia całych tur.
- `src/game/index.ts`: pojedynczy przejazd, długie proste, bramki pośrednie, banda, długość i kliknięcia.
- `src/game/scoring.ts`: iloraz i koszt przekątnej 1.
- `src/geometry`: analityczna geometria, pierwszy kontakt z bandą i dokładne przecięcia/nałożenia linii.
- `src/generator`: oś, granice, kontrola topologii/szerokości, graf i przejezdność. Bramki wynikają z rzutowania na odcinki osi oraz jej długości łukowej, nie z nieregularnej gęstości punktów łuków. Najwyżej pięć prób i zweryfikowany wariant zapasowy.
- `src/solver`: Dijkstra do walidacji przejazdu. Każda jednostkowa trasa ma iloraz 1; nie stosuje się starego solvera iloczynu ani nie obiecuje optimum przeciw dynamicznemu AI.
- `src/input`, `src/rendering`, `src/storage`: kliknięcia/touch, Canvas HiDPI bez podpowiedzi, osobne rekordy i kary.

Generowanie działa w Web Workerze. AI uruchamia się tylko podczas swojej tury. Renderowanie odbywa się po zmianach, bez ciągłej pętli 60 FPS. Reset, cofanie i menu anulują oczekującą odpowiedź AI.

Manifest, ikony 192/512 px, service worker i cache umożliwiają instalację i grę offline po pierwszym pełnym wczytaniu. Układ obsługuje safe areas, orientacje i kwadratową siatkę. Fizycznych urządzeń iOS nie testowano.

Workflow `.github/workflows/pages.yml` uruchamia instalację, lint, testy, build, E2E i publikację `dist`. W GitHub wymagane jest **Settings → Pages → Source → GitHub Actions**. Sukces buildu nie dowodzi publikacji; potwierdza ją job `deploy`. Pull requesty nie publikują.
