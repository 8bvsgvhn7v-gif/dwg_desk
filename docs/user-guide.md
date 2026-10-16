# Instrukcja obsługi

[← README](../README.md)

## Otwieranie i poruszanie się po rysunku

Otwórz DWG/DXF przyciskiem **Otwórz rysunek**, skrótem **Cmd+O**, przez Finder lub przeciągając plik do okna. Oglądasz przestrzeń modelu 2D. W lewym panelu znajduje się lista warstw podkładu; możesz je wyszukiwać i ukrywać.

Przewijanie kółkiem przybliża i oddala. Przeciąganie ze środkowym przyciskiem przesuwa widok także podczas pomiaru lub rysowania kabla. W trybie **Przesuwaj** możesz przeciągać lewym przyciskiem. **Dopasuj** lub **F** mieści rysunek w oknie.

## Jednostki

Panel pomiarów pokazuje wykrytą jednostkę i podstawę rozpoznania. Rozwiń **Jednostki**, aby ją sprawdzić albo ustawić ręcznie.

Program korzysta kolejno z:

1. Obsługiwanej jednostki zapisanej w nagłówku `INSUNITS`.
2. Jednostki zapisanej w metadanych.
3. Jednoznacznej deklaracji jednostki w opisie modelu.
4. Opisu układu PL-2000 lub PL-1992, jeśli pasuje do współrzędnych geometrii — wówczas przyjmuje metry.

Jeżeli dane są niejednoznaczne lub nieobsługiwane, wynik pozostaje w **jednostkach rysunku**. Program nie zgaduje jednostki z samej skali wydruku, flagi „metryczny” ani pojedynczego wymiaru. Ustawienie jednostki nie skaluje geometrii.

Jednostka wyniku może być inna niż jednostka modelu. Dostępne są mm, cm, dm, m, km, cale, stopy, jardy i mile. Ustawienia zapisują się z nakładką danego rysunku.

## Pomiar wielu odcinków

1. Włącz **Mierz** lub naciśnij **M**.
2. Kliknij pierwszy punkt lewym przyciskiem.
3. Kolejnymi lewymi kliknięciami dodawaj następne punkty tej samej trasy.
4. Zakończ prawym przyciskiem, Control+klik lub Enterem.

Panel pokazuje długość trasy i sumę wszystkich pomiarów. Przykładowo odcinki 6 m i 4 m dają trasę 10 m, niezależnie od odległości między jej początkiem a końcem. Przerywany odcinek do kursora jest podglądem i nie powiększa zapisanej sumy.

**Backspace** lub **Cofnij** usuwa ostatni punkt aktywnego pomiaru. Następne kliknięcie po zakończeniu trasy rozpoczyna nowy pomiar. Samotny punkt bez odcinka jest odrzucany przy zakończeniu. Esc kończy aktywny pomiar; następne Esc przełącza na przesuwanie.

Przyciąganie pomaga wskazać końce, wierzchołki, środki prostych odcinków oraz wybrane punkty okręgów, łuków i elips, także w blokach. **S** przełącza przyciąganie, **Option** wyłącza je na czas wskazywania. Ukryta geometria nie przyciąga kursora.

Pomiar dotyczy płaszczyzny XY. Zoom nie zmienia wyniku. **Eksport CSV** zapisuje odcinki, współrzędne, różnice X/Y i sumy. Pomiary są tymczasowe: znikają po zmianie pliku lub zamknięciu aplikacji.

## Warstwy robocze

Wybierz **Projektuj**. Sekcja **Moje warstwy** zawiera osobne warstwy dla kabli, kamer oraz punktów i opisów.

- **+** dodaje warstwę z nazwą i kolorem.
- Checkbox steruje widocznością.
- Romb/kłódka blokuje edycję elementów.
- **…** otwiera zmianę nazwy i koloru warstwy.
- **Aktywna warstwa** wybiera miejsce dla nowych elementów.

Domyślne warstwy przełączają się wraz z narzędziem. Jeśli wybierzesz własną warstwę, pozostaje aktywna. Warstwy robocze są lokalną nakładką na podkład, a nie zmianą jego oryginalnej zawartości.

## Kable i flagi długości

1. Wybierz **Kabel** oraz typ z biblioteki.
2. Klikaj kolejne punkty przebiegu lewym przyciskiem.
3. Zakończ prawym przyciskiem, Control+klik lub Enterem.

Powstaje jedna trasa z flagą całkowitej długości. Backspace cofa ostatni punkt podczas rysowania; Esc anuluje rozpoczętą trasę.

W trybie **Zaznacz** przeciągnij trasę albo jej kwadratowe uchwyty. Długość przelicza się po zmianie geometrii. Flagę możesz przesunąć niezależnie od kabla.

Aby dodać następny opis długości, wybierz **Flaga długości**, kliknij kabel, a potem miejsce na etykietę. Możesz też użyć **+ Flaga długości** we właściwościach kabla. Każda flaga odnosi się do całej trasy, nie tylko fragmentu w pobliżu etykiety.

Długość nie uwzględnia wysokości, pionów ani zapasu kabla. Jeśli są potrzebne, uwzględnij je osobno.

## Kamery i symbole

Wybierz **Kamera / symbol**, wskaż wzorzec z biblioteki i kliknij miejsce wstawienia. Element zostaje zaznaczony. Panel udostępnia nazwę, opis, warstwę, pozycję, obrót, rozmiar i kolor. Kamera ma dodatkowo kąt widzenia, zasięg i opcję pokazania sektora.

| Czynność | Obsługa |
| --- | --- |
| Zaznaczenie istniejącej kamery | Kliknij symbol albo jego nazwę w trybie Zaznacz. |
| Przesunięcie | Przeciągnij kamerę lub kwadrat w jej środku. |
| Obrót | Przeciągnij okrągły uchwyt ze strzałką. |
| Obrót co 15° | Przytrzymaj Shift podczas obracania lub wskazywania kierunku. |
| Ustawienie nowej pozycji kliknięciem | Kliknij **Przesuń**, a następnie nowe miejsce. |
| Skierowanie na konkretny punkt | Kliknij **Wskaż kierunek**, a następnie cel na rysunku. |
| Anulowanie zmiany w podglądzie | Esc lub prawy przycisk. |

Sektor przesuwa się i obraca razem z kamerą. Pokazuje wyłącznie rzut geometryczny: nie oblicza przesłonięcia przez budynki, wysokości montażu ani jakości identyfikacji obrazu.

## Kolory

Zaznacz kamerę, kabel, symbol, punkt lub opis. W sekcji **Kolor elementu** kliknij kolor z palety albo prostokątną próbkę, aby wybrać dowolny odcień.

Własny kolor dotyczy tego elementu. **Z warstwy** usuwa nadpisanie i przywraca dziedziczenie koloru warstwy. Późniejsza zmiana koloru warstwy wpływa na elementy, które z niego korzystają.

Kolor kamery obejmuje też jej sektor. Kolor kabla obejmuje trasę, odnośniki i obramowania flag; tekst flagi pozostaje czytelny na jej tle. Kolory zapisują się z projektem oraz eksportem DWG/DXF.

## Punkty, opisy i historia zmian

Narzędzia **Punkt** i **Opis** dodają element po kliknięciu na rysunku. Nazwę, kolor i parametry zmienisz po zaznaczeniu. Współrzędne X/Y odnoszą się do modelu wyświetlanego przez silnik; rysunek może mieć zapisany obrót UCS.

**Duplikuj** tworzy kopię zaznaczonego elementu. **Usuń**, Delete lub Backspace usuwa zaznaczenie. **Cmd+Z** cofa zmianę, **Shift+Cmd+Z** ją ponawia. Historia dotyczy bieżącej sesji, nie jest przechowywana po ponownym uruchomieniu.

## Biblioteka

Otwórz **Biblioteka symboli i kabli**. Definicje są wspólne dla rysunków na danym profilu użytkownika.

**Własny symbol** otwiera edytor. Linie, prostokąty i okręgi rysujesz dwoma kliknięciami. Krzyżyk oznacza punkt wstawienia, a prawa strona — początkowy kierunek kamery. Podaj nazwę, rodzaj, model/opis, kąt widzenia i kolor albo wybierz dziedziczenie koloru warstwy. Zapisz wzorzec w bibliotece.

**Typ kabla** przechowuje nazwę, opis i domyślny kolor. **Do biblioteki** we właściwościach elementu pozwala zachować jego definicję do kolejnych wstawień. Dla kamery zapisywane są symbol, nazwa, opis/model, kąt widzenia i ustawienie koloru. Pozycja, obrót, rozmiar i zasięg konkretnej kamery należą do projektu, a nie do wzorca bibliotecznego.

Zmiana wzorca dotyczy kolejnych wstawień. Już umieszczone elementy zachowują własne ustawienia.

## Skróty

| Skrót / przycisk | Działanie |
| --- | --- |
| Cmd+O | Otwórz rysunek. |
| Cmd+S | Zapisz nakładkę i zakończ rozpoczętą trasę kabla. |
| M / V / F | Mierz / Przesuwaj / Dopasuj. |
| S / Option | Przełącz przyciąganie / chwilowo je wyłącz. |
| Lewy klik | Dodaj punkt pomiaru lub kabla; w trybie Zaznacz wybierz element. |
| Prawy klik / Control+klik / Enter | Zakończ trasę. |
| Środkowy przycisk + ruch | Przesuń widok. |
| Backspace podczas tworzenia trasy | Cofnij ostatni punkt. |
| Cmd+Z / Shift+Cmd+Z | Cofnij / ponów zmianę nakładki. |
| Shift podczas obracania kamery | Krok co 15°. |

Skróty narzędzi nie działają podczas wpisywania tekstu w polach formularza. Zachowanie Esc zależy od aktywnego narzędzia, zgodnie z opisami powyżej.
