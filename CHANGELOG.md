# Historia zmian

## 1.3.2 — 2026-10-20

- Naprawiony rozmiar opisów w eksportowanym CAD: wysokość wynika z jednostek modelu i wielkości symboli, zamiast z bieżącego powiększenia ekranu.
- Ustawienie wysokości opisów oraz opcjonalnych modeli i parametrów kamer w oknie zapisu, zapamiętywane dla projektu.

- Główny przycisk **Zapisz DWG / DXF** i Cmd+S prowadzą do zapisu pliku z naniesionymi elementami, który można otworzyć w innym programie CAD.
- Lokalny zapis projektu ma osobny przycisk **Zapisz projekt lokalnie** w panelu Projekt; automatyczny zapis działa nadal.
- Okno zapisu domyślnie dołącza podkład, także po wcześniejszym eksporcie samej instalacji, i wybiera format otwartego rysunku.
- Komunikat po zapisie wskazuje nazwę pliku do otwarcia w drugim programie.
- Sprawdzenie zapisu przez menu Cmd+S, osadzania niedokończonej trasy i ponownego otwierania DWG/DXF bez lokalnej nakładki.

## 1.3.1

- Własne kolory kamer, kabli, symboli, punktów i opisów.
- Paleta oraz wybór dowolnego koloru RGB.
- Przywracanie koloru dziedziczonego z warstwy.
- Kolory sektorów kamer, odnośników i obramowań flag kablowych.
- Zachowanie kolorów w bibliotece, historii zmian, zapisie i eksporcie DWG/DXF.
- 27 testów logiki i 50 kontroli spakowanej aplikacji; [raport](docs/validation-1.3.1.json).

## 1.3.0

- Bezpośrednie przesuwanie i obrót już wstawionej kamery.
- Uchwyt kierunku, obrót co 15° z Shift oraz wskazywanie celu kliknięciem.
- Anulowanie podglądu przesunięcia i obrotu, cofanie całego gestu.
- Eksport podkładu z instalacją lub samej instalacji do DWG/DXF 2018 przez lokalny ODA File Converter.
- Kontrola wyniku eksportu przez ponowną konwersję i odczyt.

## 1.2.0

- Własne warstwy robocze, kable, kamery, symbole, punkty i opisy.
- Flagi całkowitej długości trasy, aktualizowane po edycji wierzchołków.
- Biblioteka symboli i typów kabli oraz edytor własnych kształtów.
- Lokalny zapis nakładek powiązanych z zawartością podkładu.
- Cofanie, ponawianie, duplikowanie, blokowanie i ukrywanie elementów przez warstwy.

## 1.1.1

- Poprawiona obsługa przesuwania środkowym przyciskiem: zakończenie gestu po zwolnieniu przycisku lub utracie aktywności okna.

## 1.1.0

- Rozpoznawanie jednostek na podstawie nagłówka, metadanych i jednoznacznych informacji w rysunku.
- Pomiar wielu odcinków przez kolejne lewe kliknięcia; prawy przycisk kończy trasę.
- Sumowanie długości trasy i wszystkich pomiarów.

## 1.0.0

- Lokalny podgląd DWG/DXF na macOS, lista warstw, powiększanie i przesuwanie.
- Pomiary 2D, przyciąganie do geometrii i eksport CSV.
