# Rozwój aplikacji

[← README](../README.md)

## Środowisko

- macOS 13+ na Apple Silicon dla uruchamiania i pakowania tego wydania.
- Node.js 22.12+ i npm; wydanie 1.3.1 budowano z Node.js 26.8.2.
- Dostęp do internetu przy pobieraniu zależności. Zbudowana aplikacja działa lokalnie.
- ODA File Converter dla testów eksportu DWG/DXF.

Wersje zależności są przypięte w `package.json` i `package-lock.json`: Electron 44.8.0, Vite 8.3.4, `@flyfish-dev/cad-viewer` 0.8.3. Czytnik DWG korzysta z LibreDWG w WebAssembly.

## Uruchomienie ze źródeł

```sh
git clone https://github.com/8bvsgvhn7v-gif/dwg_desk.git
cd dwg_desk
npm ci
npm start
```

`npm start` przygotowuje zasoby WASM, buduje frontend i uruchamia Electron. Jeśli polityka instalacji npm pominęła pobranie binarnego Electron, wykonaj:

```sh
node node_modules/electron/install.js
```

Do pracy na niezależnym profilu:

```sh
DWG_DESK_USER_DATA=/private/tmp/dwg-desk-dev-profile npm start
```

## Architektura

| Plik / katalog | Odpowiedzialność |
| --- | --- |
| `electron/main.cjs` | Okno, menu, protokół lokalny, IPC, blokada sieci i cykl życia. |
| `electron/preload.cjs` | Wąski interfejs pomiędzy rendererem a procesem głównym. |
| `electron/files.cjs` | Walidacja i odczyt plików rysunków. |
| `electron/design-storage.cjs` | Lokalna biblioteka i nakładki identyfikowane hashem podkładu. |
| `electron/cad-export.cjs` | Konwersja ODA, pliki tymczasowe, walidacja i zapis eksportu. |
| `src/app.js` | Viewer, otwieranie rysunków, pomiary i integracja narzędzi. |
| `src/designer.js`, `src/design-renderer.js` | Edycja instalacji oraz jej wyświetlanie nad podkładem. |
| `src/units.js`, `src/geometry.js` | Rozpoznawanie jednostek, geometria i przyciąganie. |
| `src/measurement-session.js`, `src/pan-gesture.js` | Stan pomiaru oraz obsługa gestu przesuwania. |
| `shared/design-model.js` | Model nakładki, biblioteki i obliczenia tras. |
| `shared/cad-export.js` | Budowa encji DXF i scalenie z podkładem. |
| `public/demo.dxf` | Własny rysunek demonstracyjny. |
| `test/`, `scripts/*smoke.mjs` | Testy logiki i scenariusze aplikacji Electron. |

Renderer działa z `contextIsolation`, wyłączonym `nodeIntegration` i sandboxem. Zasoby są ładowane przez `cad://viewer/`; żądania HTTP/HTTPS, WebSocket i FTP są blokowane. Aplikacja nie ma logowania, telemetrii ani automatycznych aktualizacji.

Odczyt pliku ma limit 150 MB i limit czasu parsowania DWG 120 s. Nakładka może zawierać do 200 warstw i 20 000 obiektów; limit zapisu to 32 MB, a biblioteki 8 MB. Historia cofania przechowuje do 50 zmian w bieżącej sesji.

## Testy

Najpierw uruchom testy logiki i zbuduj aktualny frontend:

```sh
npm test
npm run build
```

Scenariusze GUI wymagają działającej sesji macOS. Uruchamiaj je kolejno — część używa tych samych ścieżek raportów i profili. Dane QA trafiają do katalogu `../qa`, poza źródła projektu. Profile testowe są oddzielone od zwykłego profilu aplikacji.

| Polecenie | Zakres |
| --- | --- |
| `npm run test:electron` | Podgląd, pliki DWG/DXF, jednostki, warstwy i pomiary. |
| `npm run test:pan` | Zwalnianie środkowego przycisku i przesuwanie widoku. |
| `npm run test:design` | Warstwy, kable, flagi, symbole, historia, biblioteka i zapis. |
| `npm run test:camera` | Przesuwanie, obrót, wskazywanie celu, anulowanie i trwałość ustawień. |
| `npm run test:colors` | Kolory instancji, dziedziczenie, biblioteka i zapis po restarcie. |
| `npm run test:export` | Eksport z podkładem, samej instalacji, kolory i ponowne otwieranie. Wymaga ODA. |

Scenariusze `test:electron`, `test:design`, `test:camera`, `test:colors` i `test:export` obsługują także gotową paczkę przez ścieżkę do pliku wykonywalnego:

```sh
DWG_DESK_APP="/ścieżka/DWG Desk.app/Contents/MacOS/DWG Desk" npm run test:camera
```

`DWG_DESK_TEST_DRAWING` opcjonalnie wskazuje dodatkowy plik dla scenariuszy podglądu i eksportu. Takiego pliku i wyników z danymi użytkownika nie należy dodawać do repozytorium.

Raport [1.3.1](validation-1.3.1.json) obejmuje 27 testów logiki i 50 kontroli spakowanej aplikacji: 10 kolorów, 18 projektowania, 13 kamer i 9 eksportu. Pełny zestaw podglądu i rozpoznawania jednostek został wcześniej zaakceptowany w 1.3.0; nie powtarzano go przy zmianie samych kolorów. Repozytorium nie zawiera skonfigurowanego CI.

## Budowanie DMG i ZIP

```sh
npm run package:mac
```

Powstaną paczki arm64 w `release/`. Inny katalog docelowy można wskazać przez `DWG_DESK_OUTPUT`. Helper buduje i podpisuje aplikację w `/private/tmp/dwg-desk-release-*`, aby atrybuty synchronizacji iCloud/Finder nie zakłócały podpisu. Ścieżkę zachowuje w `build/last-release-path.txt`; gotowy bundle pozostaje tam do testów.

Konfiguracja używa podpisu ad hoc i nie wykonuje notaryzacji. Wydanie dla Intel, podpis Developer ID i notaryzacja wymagają osobnej konfiguracji i weryfikacji.

Nie dodawaj do Git `node_modules/`, `dist/`, `public/wasm/`, `release/` ani profili i raportów zawierających rzeczywiste rysunki. `scripts/prepare.mjs` kopiuje zasoby WASM oraz informacje o licencjach z zainstalowanych zależności. Źródła ikon są w `scripts/icon.swift`, a gotowe ikony używane do pakowania w `build/`.

## Pochodzenie danych testowych

Pliki `test/fixtures/Line-2000.dwg`, `Line-2018.dwg` i `TS1-2000.dwg` pochodzą z publicznego [korpusu testowego LibreDWG](https://github.com/LibreDWG/libredwg/tree/master/test/test-data). Służą do regresji czytnika. `public/demo.dxf` jest demonstracją generowaną przez `scripts/demo.mjs`. Prywatne rysunki użytkownika nie są częścią repozytorium.
