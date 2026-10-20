# Rozwiązywanie problemów

[← README](../README.md)

| Objaw | Co sprawdzić |
| --- | --- |
| macOS blokuje pierwsze uruchomienie | Paczka jest podpisana ad hoc, bez notaryzacji. Sprawdź pochodzenie pliku i skorzystaj z procedury w [instalacji](installation.md). |
| Dodane kamery i kable nie są widoczne w innym programie | Użyj **Zapisz DWG / DXF** (w 1.3.1: **Eksport CAD**) z dołączonym podkładem. Otwórz utworzony plik `_projekt`, a nie oryginał. **Zapisz / Cmd+S** w wersji 1.3.1 zapisywał tylko nakładkę lokalną. |
| Opisy w wyeksportowanym pliku są ogromne lub nakładają się | Zainstaluj 1.3.2 i ponownie zapisz oryginalny projekt do CAD. Wcześniej ich wysokość zależała od zoomu. W oknie zapisu ustaw **Wysokość opisów** w jednostkach rysunku; modele i parametry kamer dołączaj tylko w razie potrzeby. |
| Rysunek jest niewidoczny lub bardzo mały | Użyj **Dopasuj**. Sprawdź widoczność warstw. Pojedyncze obiekty daleko od modelu mogą powiększać jego zakres. |
| Fragmentów rysunku brakuje | Sprawdź komunikat o pominiętych encjach. Program obsługuje model 2D; nie wszystkie obiekty 3D, proxy, AEC, tabele i osadzone obiekty są renderowane. |
| Wynik pomiaru jest w „j. rys.” | Rysunek nie zawiera jednoznacznej obsługiwanej jednostki. Ustaw ją ręcznie, korzystając z dokumentacji podkładu. Sama skala wydruku nie rozstrzyga jednostki. |
| Długość wygląda nieprawidłowo | Sprawdź osobno jednostkę rysunku i jednostkę wyniku. Pomiar i kabel liczone są w XY, bez pionów i zapasu. |
| Nie można przesunąć lub obrócić kamery | Włącz **Projektuj → Zaznacz**, zaznacz kamerę i odblokuj jej warstwę. Obrót obsługuje okrągły uchwyt lub **Wskaż kierunek**. |
| Zmiana koloru warstwy nie zmienia elementu | Element ma własny kolor. Zaznacz go i wybierz **Z warstwy**. |
| Kamera dodana z biblioteki ma inny zasięg lub położenie | Wzorzec zapisuje symbol, opis, FOV i kolor. Pozycja, obrót, rozmiar i zasięg należą do konkretnej instancji. |
| Po otwarciu pliku brakuje nakładki | Sprawdź profil użytkownika i czy zawartość podkładu jest identyczna. Zmieniony lub wyeksportowany plik otrzymuje nowy identyfikator. |
| Zniknęły pomiary | Pomiary nie są zapisywane z nakładką. Przed zamknięciem użyj **Eksport CSV**. |
| Eksport informuje o braku konwertera | Zainstaluj aplikację **ODAFileConverter.app** w `/Applications` lub `~/Applications`. Eksport DXF również wymaga ODA. |
| Eksport nie kończy się lub zgłasza błąd | Sprawdź komunikat, możliwość zapisu w katalogu docelowym i działanie ODA. Każdy etap konwersji ma limit 120 s, a wynik limit 256 MB. Nietypowy podkład może wymagać sprawdzenia w CAD. |
| Flaga po edycji eksportu w CAD nie zmienia długości | Eksport zapisuje ją jako tekst. Dynamiczne przeliczanie działa w lokalnej nakładce DWG Desk. |
| Widok nadal przesuwa się po zwolnieniu kółka | W aktualnej wersji gest kończy się po zwolnieniu przycisku i utracie aktywności okna. Jeśli problem wraca, podaj wersję macOS, aplikacji, model myszy i dokładny przebieg gestu. |

## Linie instalacji są blade lub bardzo cienkie na telefonie

W oknie **Zapisz DWG / DXF** wybierz **Czytelne na białym tle** i dodatnią **Szerokość tras**. Możesz zwiększyć **Grubość linii CAD** do 0,50 mm. Zapisz nowy plik i otwórz go ponownie na telefonie. Kolory dobrane do ciemnego tła mogą słabo kontrastować z bielą; sama grubość CAD może być wyłączona przez przeglądarkę. Nowe ustawienia eksportu są dostępne od wersji 1.3.3.

## Zgłoszenie błędu

W [Issues](https://github.com/8bvsgvhn7v-gif/dwg_desk/issues) podaj wersję aplikacji i macOS, kroki odtworzenia, oczekiwany wynik oraz treść komunikatu. Pomocny jest mały, anonimowy rysunek pokazujący problem i informacja, czy występuje on również na przykładzie wbudowanym w program.

Repozytorium jest publiczne. Nie dołączaj rysunków klienta, danych lokalizacyjnych, lokalnej biblioteki ani pełnych profili użytkownika bez prawa do ich ujawnienia.
