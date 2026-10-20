# Instalacja i aktualizacja

[← README](../README.md)

## Wymagania

| Element | Wymaganie |
| --- | --- |
| System | macOS 13 lub nowszy — minimalna wersja ustawiona dla aplikacji. |
| Procesor | Apple Silicon, np. M1/M2/M3/M4. Wydanie ma architekturę arm64. |
| Plik | DWG lub DXF, maksymalnie 150 MB. |
| Internet podczas pracy | Nie jest wymagany. |
| Eksport CAD | Osobno zainstalowany ODA File Converter dla Apple Silicon. |

Minimalna wersja systemu nie oznacza, że wykonano testy na każdym wydaniu macOS. Nie ma przygotowanej paczki Intel.

## Instalacja z DMG

1. Otwórz `DWG-Desk-1.3.2-mac-arm64.dmg`.
2. Przeciągnij **DWG Desk** do folderu **Aplikacje**.
3. Uruchom aplikację z folderu Aplikacje.
4. Otwórz rysunek lub skorzystaj z przykładu dostępnego na ekranie startowym.

Alternatywnie rozpakuj archiwum aplikacji `DWG-Desk-1.3.2-mac-arm64.zip` i przenieś `DWG Desk.app` do Aplikacji. Archiwum źródeł ma inną zawartość — uruchamia się je według [instrukcji dla programistów](development.md).

Aplikacja jest podpisana ad hoc, bez certyfikatu Apple Developer ID i notaryzacji. macOS może zablokować pierwsze uruchomienie pobranej kopii. Jeśli znasz pochodzenie paczki, użyj **Ustawienia systemowe → Prywatność i ochrona → Otwórz mimo to**. Nie wyłączaj globalnie Gatekeepera.

## Konwerter do eksportu DWG/DXF

1. Pobierz wersję dla Apple Silicon z [oficjalnej strony ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_converter).
2. Zainstaluj `ODAFileConverter.app` w jednym z katalogów:

   ```text
   /Applications/ODAFileConverter.app
   ~/Applications/ODAFileConverter.app
   ```

3. W DWG Desk otwórz rysunek i wybierz **Zapisz DWG / DXF**.

Testy eksportu wydania 1.3.1 wykonano z ODA File Converter **27.9.0.0**. DWG Desk wykrywa konwerter w podanych lokalizacjach i uruchamia go lokalnie z blokadą połączeń sieciowych. Nie pobiera ani nie aktualizuje go samodzielnie.

Konwerter ma osobną licencję. Nie jest potrzebny do otwierania rysunków, pomiarów ani pracy na lokalnej nakładce. Nie jest zawarty w paczce DWG Desk.

## Aktualizacja

1. Poczekaj na **Zapisano lokalnie** w panelu Projekt i zamknij aplikację. Możesz też wymusić zapis przyciskiem **Zapisz projekt lokalnie** (w wersji 1.3.1: **Zapisz**).
2. Otwórz nowe DMG i zastąp aplikację w folderze Aplikacje.
3. Uruchom ją i sprawdź numer wersji w prawym dolnym rogu.

Podmiana aplikacji nie usuwa biblioteki i nakładek, które są zapisane w danych użytkownika. Przed aktualizacją możesz wykonać [kopię folderu `designs`](data-and-export.md#kopia-zapasowa).

Program nie ma automatycznych aktualizacji przez internet.
