# Weryfikacja — 22 października 2026

- `npm ci --cache /tmp/papertrack-npm`: zakończone powodzeniem, instalacja z lockfile.
- `npm run lint`: ESLint i TypeScript strict — poprawne.
- `npm run build`: produkcyjny build, osobny Worker generatora, manifest, ikony i service worker — poprawne.
- `npm test`: 10/10 testów, w tym 1000 seedów żużlowych, 1000 samochodowych, 1000 rajdowych i 100 poziomów kampanii. Końcowy pełny przebieg: 108,95 s. Test sprawdza też ponad 950 różnych geometrii na kategorię i mniej niż 20 użyć wariantu zapasowego na 1000 seedów.
- Po zmianie interpolacji gestów powtórzono grupę `geometria`: 7/7; trzy testy obciążeniowe pominięte wyłącznie w tym celowo zawężonym przebiegu (pełny przebieg powyżej zakończył się powodzeniem).
- `SYSTEM_CHROMIUM=1 npm run test:e2e`: 12/12 — desktop i mobilne rozmiary iPhone/iPad w systemowym Chromium, ukończenie i gwiazdki, podgląd rozwiązania, rekord, restart, offline z nową planszą, kampania, orientacja, anulowanie dotyku, wznowienie, cofanie, krawędź i responsywność podczas generowania.
- Sprawdzono uruchomienie serwera deweloperskiego i renderowanie planszy w przeglądarce.

Nie wykonano testów na fizycznych urządzeniach iOS. Pobieranie Chromium/WebKit przez Playwright zostało zablokowane przez politykę sieciową (HTTP 403); użyto istniejącego `/usr/bin/chromium`. Mobilne scenariusze zawierają zdarzenia PointerEvent z typem `touch`; nie zastępują testów Safari i sprzętu.

Workflow publikacji znajduje się w `.github/workflows/pages.yml`. Sukces testów lokalnych nie oznacza udanej publikacji na GitHub Pages. Wymagane ustawienie repozytorium: Pages → Source → GitHub Actions. Stan zewnętrznego wdrożenia należy sprawdzić po wykonaniu workflow.
