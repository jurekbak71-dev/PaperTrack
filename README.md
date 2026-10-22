# Paper Track — Wyścig na kartce

Gra logiczna PWA po polsku: znajdź trasę po torze narysowanym na kartce w kratkę. Bez pojazdów, fizyki i prędkości. TypeScript, Canvas, Vite, Vitest i Playwright; bez backendu.

## Zasady i sterowanie

1. Kliknij czerwony punkt **START**.
2. Kliknij koniec odcinka na przecięciu siatki.
3. W pionie albo poziomie odcinek może mieć **dowolną liczbę kratek**. Przekątna może pokonać **tylko jedną kratkę**.
4. Na torze zamkniętym przejdź przez kolejne bramki w kolejności numerów i wróć do STARTU/METY. Na rajdzie dotrzyj do osobnej METY.

Każdy odcinek powstaje przez osobne kliknięcie albo dotknięcie, nie przez przeciąganie. Nie ma podświetlanych ruchów, podpowiedzi trasy ani przycisku pokazującego rozwiązanie. Numeracja bramek określa obowiązkową kolejność okrążenia, nie linię przejazdu.

Cały odcinek musi mieścić się wewnątrz toru. **Dotknięcie bandy, przejście przez nią lub ścinanie przez wyspę to wypadek.** Próba kończy się i otrzymuje −5 pkt kary. Czerwony znak wskazuje pierwszy kontakt z bandą. Nie można anulować wypadku cofnięciem. Restart rozpoczyna nową próbę, ale kary na tym samym torze pozostają, również po ponownym otwarciu planszy.

„Cofnij” usuwa cały ostatni narysowany odcinek, „Cofnij 5” usuwa kilka. Przeliczane są długość i kliknięcia pozostałej trasy. Przyciski + / − powiększają widok, strzałki przesuwają kartkę, „Dopasuj” przywraca całość. Na telefonie dotykaj kolejnych punktów; rysowanie nie przewija strony.

## Wynik — najmniejszy wygrywa

**Wynik = długość trasy w jednostkowych segmentach × liczba kliknięć rysujących odcinki.**

- Jedna kratka pionowo lub poziomo: 1 segment długości.
- Jednokratkowa przekątna: również 1 segment długości.
- Prosta przez 5 kratek: długość 5, narysowana jednym kliknięciem.
- START nie jest liczony jako kliknięcie do wyniku.
- Nietrafione kliknięcia, wybór tego samego punktu i przyciski interfejsu nie tworzą odcinków i nie zwiększają mnożnika.

Przykład: odcinki o długościach 5 i 3 narysowane dwoma kliknięciami dają **(5 + 3) × 2 = 16**. Ta sama trasa podzielona na osiem jednokratkowych odcinków daje **8 × 8 = 64**.

Punkty karne są prezentowane osobno od iloczynu. Próba zakończona wypadkiem nie zapisuje wyniku jako ukończonego toru. Kary nie obniżają iloczynu, co byłoby premią przy zasadzie „najmniejszy wygrywa”.

Rekord aktualizuje się przy niższym iloczynie; przy remisie preferowana jest mniejsza kara (np. 0 pkt przed −5 pkt). Nowe rekordy mają osobną przestrzeń zapisu `records-product-v1`; dawnych rekordów długości nie porównuje się z iloczynem. Po ukończeniu widać oba składniki, wynik, rekord i minimalny możliwy wynik. Nie jest pokazywana optymalna linia.

Progi gwiazdek w `STAR_THRESHOLDS`, `src/game/index.ts`:

| Ocena | Wynik względem minimalnego iloczynu |
| ----- | ----------------------------------- |
| ★★★   | do 102% włącznie                    |
| ★★    | do 110% włącznie                    |
| ★     | powyżej 110%, poprawne ukończenie   |

Definicja długości i sposób liczenia STARTU są zapisane w `src/game/scoring.ts`. Kara za wypadek to `CRASH_PENALTY` w `src/game/index.ts`.

## Tryby

Losowe tory: żużlowy, samochodowy lub rajdowy, pięć trudności. Kod `PT1-typ-trudność-seed` oraz link z fragmentem URL odtwarzają planszę. Kampania ma 100 stałych poziomów, od szerokich owali do węższych tras z nawrotami. Poziomy można ćwiczyć bez blokad; gwiazdki zapisują postęp. Ustawienia i rekordy są lokalne dla urządzenia i originu.

## Gotowy plik do otwarcia dwuklikiem

Pobierz `downloads/PaperTrack.html` i otwórz w Chrome/Edge. Działa bez serwera, Node.js i internetu. `downloads/PaperTrack-gotowa-gra.zip` zawiera HTML, instrukcję i pełne źródła. Na iPhone/iPad instalacja PWA wymaga wersji hostowanej przez HTTPS; samo otwarcie pobranego HTML w systemowym podglądzie plików nie zastępuje instalacji webowej.

## Lokalnie i testy

Wymagany Node.js 24 i npm 11:

```sh
npm ci
npm run dev
```

Aplikacja ma bazę `/PaperTrack/`. Walidacja i produkcja:

```sh
npm run lint
npm test
npm run build
npm run preview
```

`lint` uruchamia ESLint i TypeScript strict. Testy obejmują 1000 seedów dla każdego typu, pełną kampanię, ścisłą geometrię bez kontaktu z bandami, długie proste, przekątne, kary, cofanie, zapis rekordów i dokładne optimum iloczynu. Niezależne przykłady sprawdzają, że solver prawidłowo rozstrzyga kompromis między krótszą trasą a mniejszą liczbą kliknięć.

```sh
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

E2E uruchamia produkcyjny build i testuje desktop Chromium oraz profile iPhone/iPad w WebKit: ukończenie, iloczyn, rekordy, offline, kampanię, orientację, brak podpowiedzi, długie odcinki, wypadki, trwałość kar, anulowanie gestu, cofanie, powiększanie i przesuwanie. `SYSTEM_CHROMIUM=1 npm run test:e2e` to wariant z systemowym `/usr/bin/chromium`; emuluje mobilny rozmiar, ale nie testuje WebKit.

Odtworzenie plików do pobrania po zmianach (wymagany także Python 3):

```sh
npm run package
```

Eksport osadza CSS, kod i generator jako klasyczny Blob Worker w jednym HTML. ZIP zawiera aktualne źródła, pomija starsze paczki, node_modules i dist.

## Architektura

- `src/geometry`: analityczne sprawdzanie całych odcinków i pierwszego kontaktu z granicą. Obejmuje styczność, końce odcinka i pokrywanie z bandą. Legalne końce nie wystarczają, jeśli odcinek przechodzi poza torem.
- `src/generator`: deterministyczna oś i granice; owale z dwiema prostymi, tory samochodowe z łukami i nawrotami, rajdy z falującym korytarzem. Minimalna szerokość domyślna 4 kratki. Walidacja samoprzecięć, szerokości, spójności i pełnego przejazdu przez bramki. Maksymalnie pięć prób, potem zweryfikowany wariant zapasowy.
- Graf generatora zawiera jednostkowe ruchy, które **nie dotykają żadnej bandy**. Długa prosta sprawdza całą geometrię i postęp każdej pośredniej bramki, ale zapisuje jeden narysowany odcinek.
- `src/solver`: Dijkstra do weryfikacji przejezdności oraz dokładne wyszukiwanie etykiet Pareto do minimalizacji **długość × kliknięcia**. Stan obejmuje węzeł, bramki i ostatni kierunek. Przedłużenie tej samej prostej zwiększa długość, ale nie kliknięcia. Każda przekątna wymaga nowego kliknięcia. Zachowywane są niedominowane pary długość/kliknięcia; jedna „najlepsza długość” na węzeł nie wystarcza do tego celu.
- `src/game`: rozgrywka, atomowa kontrola długich ruchów, wypadki, kary i cofanie.
- `src/input`: pojedyncze kliknięcia/dotknięcia, bez rysowania przy przeciąganiu.
- `src/rendering`: Canvas HiDPI z siatką, linią gracza i oznaczeniem wypadku; bez podpowiedzi ruchów.
- `src/storage`: osobne rekordy iloczynu oraz zapis kar; obsługa niedostępnej pamięci.

Generowanie i optymalizacja działają w Web Workerze. Renderowanie odbywa się po zmianach, bez stałej pętli 60 FPS.

## PWA i GitHub Pages

Manifest zawiera ikony 192/512 px i tryb standalone. Service worker przechowuje wszystkie zasoby aktualnego buildu, w tym Worker generatora; offline działa po pełnej aktywacji. W Safari wybierz Udostępnij → Do ekranu początkowego, w Chrome/Edge — Zainstaluj aplikację. Układ uwzględnia safe areas i orientację, kratki pozostają kwadratowe. Nie wykonano testów na fizycznym iPhonie/iPadzie.

Workflow `.github/workflows/pages.yml` uruchamia instalację, lint, testy, build, E2E i publikację `dist`. Pull requesty nie publikują. Ustaw w GitHub **Settings → Pages → Source → GitHub Actions**, następnie wyślij `main` albo uruchom workflow. Adres zwraca udany job `deploy`; sam build nie potwierdza publikacji. Baza Vite, manifest i zakres service workera to `/PaperTrack/`.
