# Mano asistentas

Paprasta programėlė telefonui: užduotys, atrašymai, skambučiai ir pirkiniai – balsu arba ranka.
Veikia be serverio, duomenys saugomi įrenginyje (`localStorage`).

## Ką moka
- **Balsu**: „Rytoj 9 vakaro paskambinti mamai“, „Nupirkti pieno ir duonos“,
  „Atsakyti Jonui dėl sutarties penktadienį“, „Kas pirmadienį išnešti šiukšles“.
  Tas pats atpažinimas veikia ir rašant ranka į pavadinimo laukelį.
- **Datos**: šiandien, rytoj, poryt, savaitės dienos, „gruodžio 5 d.“, „po 3 dienų“,
  „po savaitės“, „kitą savaitę“, 2026-12-05.
- **Laikas**: 10:30, 16.30, 10 val., „9 vakaro“, „7 ryto“, „3 po pietų“, „11 nakties“.
- **Pasikartojimas**: kasdien, kas savaitę, kas mėnesį, „kas pirmadienį“, „ketvirtadieniais“.
  Pažymėjus atliktą, sukuriamas kitas kartas.
- **Redagavimas**: paspausk ant įrašo – galima pakeisti tekstą, datą, laiką ir perkelti į kitą sąrašą.
- **Atšaukimas** po pridėjimo, ištrynimo, pažymėjimo ar išvalymo.
- **Priminimai**: kalendoriaus mygtukas – `.ics` failas su priminimu (telefono kalendoriui)
  arba Google kalendorius.
- **Atsarginė kopija**: JSON eksportas / importas.
- **Įdiegimas** į pradžios ekraną (PWA), veikia ir be interneto (išskyrus balso atpažinimą).

## Failai
- `index.html` – programėlė
- `parser.js` – lietuviškų frazių atpažinimas (be priklausomybių)
- `sw.js`, `manifest.json`, `icon*` – įdiegimui ir darbui be interneto
- `tests/parser.test.js` – atpažinimo testai: `npm test` (reikia Node 18+)

Pakeitus failus, `sw.js` faile padidink `VERSIJA`, kad telefonai gautų naują versiją
(be to, naršyklė ir taip pirmiausia bando parsisiųsti naujausią).
