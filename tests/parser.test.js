// Paleisti: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../parser.js");

// 2026-11-19, ketvirtadienis, 14:00
const NOW = new Date(2026, 10, 19, 14, 0);
const a = (s) => P.analyze(s, NOW);

function check(fraze, expected) {
  test(fraze, () => {
    const r = a(fraze);
    for (const k of Object.keys(expected)) {
      assert.deepEqual(r[k], expected[k], `${fraze} → ${k}: ${JSON.stringify(r)}`);
    }
  });
}

// --- laikas su paros dalimi ---
check("Rytoj 9 vakaro paskambinti mamai", { tipas: "skambuciai", kam: "Mamai", data: "2026-11-20", laikas: "21:00" });
check("Nuvežti mašiną 7 vakare", { tipas: "uzduotys", tekstas: "Nuvežti mašiną", data: "2026-11-19", laikas: "19:00" });
check("Pabusti 6 ryto", { tekstas: "Pabusti", laikas: "06:00", data: "2026-11-20" });
check("Vaistai 11 val. nakties", { tekstas: "Vaistai", laikas: "23:00" });
check("Susitikimas 3 po pietų", { tekstas: "Susitikimas", laikas: "15:00" });
check("Pirmadienį 10 val. susirinkimas", { tekstas: "Susirinkimas", data: "2026-11-23", laikas: "10:00" });
check("Susitikimas 10:30", { tekstas: "Susitikimas", laikas: "10:30", data: "2026-11-20" });
check("Susitikimas 16.30", { tekstas: "Susitikimas", laikas: "16:30", data: "2026-11-19" });
check("Gydytojas 10 val. 15 min.", { tekstas: "Gydytojas", laikas: "10:15" });
check("Pietūs per vidurdienį", { tekstas: "Pietūs", laikas: "12:00" });

// --- „val" ir „rytoj" žodžio viduryje neatpažįstami ---
check("Išvalyti 3 valgymo kėdes", { tekstas: "Išvalyti 3 valgymo kėdes", laikas: "", data: "" });
check("Rytojaus planas", { tekstas: "Rytojaus planas", data: "" });
check("Iki rytojaus sutvarkyti garažą", { tekstas: "Sutvarkyti garažą", data: "2026-11-20" });
check("Neteisingas laikas 25:99", { laikas: "" });

// --- datos ---
check("Gruodžio 5 d. pas gydytoją", { tekstas: "Pas gydytoją", data: "2026-12-05" });
check("Iki gruodžio 24 dienos nupirkti dovanas", { tipas: "pirkiniai", prekes: ["Dovanas"], data: "2026-12-24" });
check("Sausio 10-ąją sumokėti mokesčius", { tekstas: "Sumokėti mokesčius", data: "2027-01-10" });
check("Spalio 1 techninė apžiūra", { data: "2027-10-01" });
check("Po savaitės sumokėti mokesčius", { tekstas: "Sumokėti mokesčius", data: "2026-11-26" });
check("Po 3 dienų paimti siuntinį", { tekstas: "Paimti siuntinį", data: "2026-11-22" });
check("Po dviejų savaičių grąžinti knygą", { tekstas: "Grąžinti knygą", data: "2026-12-03" });
check("Po mėnesio pakeisti filtrą", { tekstas: "Pakeisti filtrą", data: "2026-12-19" });
check("Kitą savaitę sutvarkyti dokumentus", { tekstas: "Sutvarkyti dokumentus", data: "2026-11-23" });
check("Iki penktadienio pateikti ataskaitą", { tekstas: "Pateikti ataskaitą", data: "2026-11-20" });
check("Ketvirtadienį sporto salė", { data: "2026-11-26" });
check("Poryt nuvežti vaikus", { tekstas: "Nuvežti vaikus", data: "2026-11-21" });
check("Šiandien išnešti šiukšles", { tekstas: "Išnešti šiukšles", data: "2026-11-19" });
check("2026-12-01 pasiruošti kelionei", { data: "2026-12-01", tekstas: "Pasiruošti kelionei" });

// --- pirkiniai ---
check("Nupirkti pieno ir duonos rytoj", { tipas: "pirkiniai", prekes: ["Pieno", "Duonos"], data: "2026-11-20" });
check("Parduotuvėje pienas, kiaušiniai", { tipas: "pirkiniai", prekes: ["Pienas", "Kiaušiniai"] });
check("Į pirkinių sąrašą įrašyk kavą", { tipas: "pirkiniai", prekes: ["Kavą"] });
check("Reikia nusipirkti obuolių; bananų bei sūrio", { tipas: "pirkiniai", prekes: ["Obuolių", "Bananų", "Sūrio"] });
check("Nupirkti irklą", { tipas: "pirkiniai", prekes: ["Irklą"] });

// --- atrašymai ---
check("Atsakyti Jonui dėl sutarties penktadienį", { tipas: "atrasymai", kam: "Jonui", tema: "sutarties", data: "2026-11-20" });
check("Parašyti Jonui rytoj", { tipas: "atrasymai", kam: "Jonui", data: "2026-11-20" });
check("Parašyti žinutę mamai apie vakarienę", { tipas: "atrasymai", kam: "Mamai", tema: "vakarienę" });
check("Atrašyti Rūtai", { tipas: "atrasymai", kam: "Rūtai", tema: "" });
check("Parašyti ataskaitą", { tipas: "uzduotys", tekstas: "Parašyti ataskaitą" });

// --- skambučiai ---
check("Paskambinti Petrui dėl automobilio rytoj 10 val.", { tipas: "skambuciai", kam: "Petrui", tema: "automobilio", data: "2026-11-20", laikas: "10:00" });
check("Perskambinti draudimui", { tipas: "skambuciai", kam: "Draudimui" });

// --- pasikartojimas ---
check("Kas pirmadienį išnešti šiukšles", { kartojasi: "savaite", data: "2026-11-23", tekstas: "Išnešti šiukšles" });
check("Kasdien gerti vitaminus 9 ryto", { kartojasi: "diena", laikas: "09:00", tekstas: "Gerti vitaminus" });
check("Kiekvieną mėnesį sumokėti nuomą", { kartojasi: "menuo", data: "2026-11-19", tekstas: "Sumokėti nuomą" });
check("Ketvirtadieniais baseinas", { kartojasi: "savaite", data: "2026-11-19", tekstas: "Baseinas" });

// --- pagalbinės ---
test("normTime", () => {
  assert.equal(P.normTime("9"), "09:00");
  assert.equal(P.normTime("930"), "09:30");
  assert.equal(P.normTime("25:00"), "");
  assert.equal(P.normTime("10:75"), "");
});
test("normDate", () => {
  assert.equal(P.normDate("2026-2-3"), "2026-02-03");
  assert.equal(P.normDate("31.02.2026"), "");
  assert.equal(P.normDate("5.12.2026"), "2026-12-05");
});
test("nextOccurrence", () => {
  assert.equal(P.nextOccurrence("2026-11-19", "diena", NOW), "2026-11-20");
  assert.equal(P.nextOccurrence("2026-11-10", "savaite", NOW), "2026-11-24");
  assert.equal(P.nextOccurrence("2026-01-31", "menuo", new Date(2026, 0, 31)), "2026-02-28");
  assert.equal(P.nextOccurrence("2026-11-01", "diena", NOW), "2026-11-19");
});
