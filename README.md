# Paper Track — Wyścig na kartce

Gra logiczna PWA po polsku: narysuj najkrótszą drogę po torze na kartce w kratkę. Bez fizyki, pojazdów i prędkości. TypeScript, Canvas, Vite, Vitest i Playwright; bez backendu.

## Zasady i sterowanie

**Kliknij czerwony punkt START**, następnie kliknij jeden z podświetlonych sąsiednich węzłów. Między punktami powstanie jeden odcinek. Każde kolejne kliknięcie przesuwa koniec trasy **dokładnie o jedną kratkę**: góra, dół, lewo, prawo lub po przekątnej. Na telefonie dotykaj kolejnych punktów. Przeciąganie nie rysuje trasy. Kliknięcie dalszego punktu jest odrzucane bez dodawania pośrednich odcinków.

Ruch poziomy lub pionowy kosztuje 1, ukośny √2. Cały odcinek musi leżeć na nawierzchni. Nie można ścinać przez wewnętrzną wyspę ani przez krawędź. Początkowo widoczna instrukcja prowadzi od wyboru STARTU do pierwszego odcinka; podświetlenia pokazują wszystkie legalne sąsiednie punkty, nie rozwiązanie.

Na torze zamkniętym przejedź przez wszystkie ponumerowane sektory w kolejności strzałek i wróć do czerwonego punktu. Numery pokazują kolejność bramek, nie obowiązkowe punkty przejazdu. Na rajdzie dotrzyj do osobnej METY. Start i meta są konkretnymi węzłami, aby porównanie z optimum było jednoznaczne.

Między kliknięciami można dowolnie poruszać kursorem — trasa zmienia się dopiero po osobnym kliknięciu sąsiedniego punktu. „Cofnij”, „Cofnij 5”, „Wyczyść” i „Restart” nie zmieniają planszy. Przyciski + / − przybliżają widok, strzałki przesuwają kartkę, „Dopasuj” przywraca całość. Gest rysowania nie przewija strony. Rozwiązanie można zobaczyć dopiero po ukończeniu.

Tryb losowy ma trzy typy i pięć trudności. Kod `PT1-typ-trudność-seed` oraz link z fragmentem URL odtwarzają planszę. Kampania zawiera 100 stałych poziomów: 1–10 szerokie owale, 11–25 bardziej zróżnicowane łuki, 26–50 geometria z nawrotami, 51–75 węższe trasy, 76–100 najtrudniejsze konfiguracje. Poziomy są dostępne do ćwiczeń bez blokad; gwiazdki zapisują postęp.

## Lokalnie

Wymagany Node.js 24 i npm 11.

```sh
npm ci
npm run dev
```

Vite obsługuje aplikację pod ścieżką `/PaperTrack/`. Do produkcji:

```sh
npm run lint
npm test
npm run build
npm run preview
```

`lint` uruchamia ESLint i sprawdza typy TypeScript w trybie strict. Budowanie generuje osobny Worker i service worker z listą wszystkich plików aktualnego buildu.

## Testy przeglądarkowe

```sh
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

Konfiguracja uruchamia produkcyjny build i sprawdza desktop Chromium oraz profile iPhone i iPad w WebKit. Jeżeli dostępny jest tylko systemowy Chromium:

```sh
SYSTEM_CHROMIUM=1 npm run test:e2e
```

Ten wariant emuluje rozmiary i dotyk iOS w Chromium — nie zastępuje Safari ani testów sprzętowych. Testy obejmują rysowanie całego rozwiązania, blokadę podglądu przed metą, gwiazdki, restart, rekord, offline, kampanię i zmianę orientacji. Testy jednostkowe sprawdzają 1000 seedów dla każdego typu, pełne 100 poziomów, szerokość, topologię, połączenie grafu, legalność odcinków, solver, koszty, deterministyczność i cofanie.

## Generator i solver

- `src/geometry`: wielokąty i dokładna kontrola całego odcinka. Odcinek dzielony jest w przecięciach z granicami; każdy powstały przedział musi należeć do nawierzchni. Same legalne końce nie wystarczają.
- `src/generator`: deterministyczny PRNG i oś toru; owale z dwiema prostymi, tory samochodowe z łukami lub zaokrąglonym nawrotem, rajdy z falującym korytarzem. Granice torów zamkniętych powstają przez odsunięcie osi, rajdowych przez przekroje poszerzone względem maksymalnego nachylenia. Szerokość domyślna 4–7 kratek; API dopuszcza 4–8.
- `validate.ts`: brak samoprzecięć, minimalna odległość granic, jedna spójna składowa legalnych węzłów. Następnie solver potwierdza przejezdność przez bramki. Maksymalnie pięć deterministycznych prób i zweryfikowany wariant zapasowy. Nie ma nieskończonej pętli losowania.
- `src/solver`: Dijkstra z kolejką binarną, stan `(węzeł, ostatnia zaliczona bramka)`. Koszty to dokładnie 1 i √2; rozwiązanie nie jest estymowane. Pełne okrążenie wymaga przejścia wszystkich sektorów w kolejności. Cofnięcie do wcześniejszego sektora nie zalicza kolejnej bramki.
- `src/game`: przebieg próby i odwracalne operacje cofania.
- `src/input`: obsługa pojedynczych kliknięć i dotknięć przez Pointer Events; odrzucanie przeciągania i anulowanych gestów.
- `src/rendering`: Canvas z HiDPI, siatką i śladem atramentu. Odświeżanie tylko po zmianie stanu, gestach i zmianie rozmiaru.
- `src/storage`: ustawienia i najlepsze wyniki w localStorage, z obsługą niedostępnej pamięci.

Generowanie, walidacja i wyznaczanie optimum odbywają się w Web Workerze. Interfejs pozostaje responsywny. Graf przechowuje jedynie legalne węzły i osiem sąsiednich ruchów.

## Punktacja

Progi w jednym miejscu: `STAR_THRESHOLDS` w `src/game/index.ts`.

| Ocena | Długość względem optimum          |
| ----- | --------------------------------- |
| ★★★   | do 102% włącznie                  |
| ★★    | do 110% włącznie                  |
| ★     | powyżej 110%, poprawne ukończenie |

Rekord aktualizuje się tylko dla krótszej trasy. Długości prezentowane są po zaokrągleniu, obliczenia odbywają się w pełnej precyzji `number`.

## PWA i urządzenia mobilne

Manifest ma ikony 192 i 512 px, tryb standalone i zakres `/PaperTrack/`. W Safari: Udostępnij → Do ekranu początkowego. Chrome/Edge: Zainstaluj aplikację. HTTPS jest wymagany poza localhost. Po aktywowaniu service workera wszystkie zasoby, w tym Worker generatora, są dostępne offline. Nowy build tworzy nową wersję cache i usuwa starsze cache aplikacji.

Układ uwzględnia safe areas, orientację pionową i poziomą. Kratki pozostają kwadratowe. Zapis jest lokalny dla danego urządzenia i originu; wyczyszczenie danych przeglądarki usuwa rekordy. Prywatne przeglądanie może ograniczać trwałość danych. Weryfikacja na fizycznym iPhonie/iPadzie wymaga osobnego testu sprzętowego.

## GitHub Pages

Workflow `.github/workflows/pages.yml` wykonuje `npm ci`, kontrolę typów, testy, build, instalację przeglądarek i E2E, następnie przekazuje `dist` do GitHub Pages. Pull requesty uruchamiają walidację bez publikowania. Dla wdrożenia:

1. W repozytorium GitHub wybierz Settings → Pages → Source: GitHub Actions.
2. Wyślij zmiany na `main` albo uruchom workflow ręcznie.
3. Sprawdź zielony job `deploy`; adres wdrożenia zwraca GitHub Actions.

Baza Vite, manifest i zakres service workera wskazują `/PaperTrack/`. Zmiana nazwy repozytorium wymaga aktualizacji tych ścieżek. Sam lokalny build nie potwierdza publikacji.

## Gotowy plik do otwarcia dwuklikiem

`downloads/PaperTrack.html` działa bez serwera i internetu w Chrome/Edge. Kliknij START, potem kolejne sąsiednie punkty — jedna kratka na kliknięcie. ZIP `downloads/PaperTrack-gotowa-gra.zip` zawiera ten sam HTML, instrukcję oraz źródła.

Aby odświeżyć pliki do pobrania po zmianie kodu, wykonaj `npm run package` (wymaga Node.js 24 i Python 3). Eksport osadza CSS, kod gry i generator w jednym HTML; Worker typu classic działa również z pliku lokalnego. W ZIP pomijane są poprzednie paczki, node_modules i dist.
