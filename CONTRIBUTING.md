# Wprowadzanie zmian

Uruchom projekt według [dokumentacji deweloperskiej](docs/development.md). Zmiany zgłaszaj w pull requestach, opisując problem, nowe zachowanie i wykonaną weryfikację.

## Zasady projektu

- Rysunki i nakładki pozostają lokalne. Nowa funkcja nie powinna wymagać chmury ani wysyłać danych bez wiedzy użytkownika.
- Podkład jest tylko do odczytu; eksport tworzy osobny plik.
- Zmiany modelu danych muszą zachować możliwość otwarcia istniejących nakładek i bibliotek.
- Widok, pomiary i eksport powinny korzystać z tych samych jednostek i współrzędnych.
- Zachowaj polski interfejs i spójne zachowanie przycisków myszy oraz skrótów.
- Zależności i dołączone zasoby muszą mieć zgodne, opisane licencje. Projekt jest objęty AGPL-3.0-only.

## Weryfikacja

Uruchom `npm test` oraz `npm run build`. Dobierz scenariusze GUI do zmiany: na przykład `test:camera` dla manipulacji kamerą, `test:colors` dla kolorów, `test:export` dla eksportu. Zmiany zapisu sprawdź również po restarcie. Nie deklaruj wykonania kontroli, której nie uruchomiono; opisz ograniczenia środowiska.

Do błędu dołącz minimalny przykład i kroki odtworzenia. Używaj danych demonstracyjnych lub publicznych fixture. Nie commituj prywatnych DWG/DXF, eksportów klienta, profili, tokenów, `node_modules`, wyników budowania ani instalatora ODA.

## Dokumentacja

Zmiana działania wymaga aktualizacji odpowiedniego rozdziału w `docs/` oraz historii zmian. Zrzuty ekranu powinny przedstawiać rysunek demonstracyjny. Sprawdź względne linki i nie dodawaj do dokumentacji ścieżek właściwych dla prywatnego komputera.
