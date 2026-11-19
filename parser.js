/*
 * Lietuviškų frazių atpažinimas: iš sakinio ištraukia kategoriją, datą,
 * laiką, pasikartojimą ir švarų tekstą.
 *
 * Veikia ir naršyklėje (window.Parser), ir Node (module.exports) – testams.
 * Visos funkcijos priima `now` (Date), kad būtų galima testuoti su fiksuota data.
 *
 * Pastaba: JavaScript \b neatpažįsta lietuviškų raidžių kaip žodžio dalies,
 * todėl žodžių ribas tikriname patys (NB / NA žemiau).
 */
(function (root) {
  "use strict";

  var L = "a-ząčęėįšųūž";
  var NB = "(^|[^" + L + "0-9])";   // prieš žodį – ne raidė ir ne skaičius
  var NA = "(?![" + L + "0-9])";    // po žodžio – ne raidė ir ne skaičius
  var W = "[" + L + "]*";           // likusi žodžio dalis (galūnė)

  /* ---------- datos pagalbinės ---------- */

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function hm(d) { return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { var x = dayStart(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) {
    var x = new Date(d.getFullYear(), d.getMonth() + n, 1);
    var last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(d.getDate(), last));
    return x;
  }
  function parseYmd(s) {
    var a = String(s || "").split("-");
    return new Date(Number(a[0]), Number(a[1]) - 1, Number(a[2]));
  }
  function validDate(y, m, d) {
    var x = new Date(y, m - 1, d);
    return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d ? x : null;
  }
  /* Artimiausia nurodyta savaitės diena; jei šiandien ta diena – po savaitės (arba šiandien, kai includeToday). */
  function nextWeekday(now, wd, includeToday) {
    var diff = (wd - now.getDay() + 7) % 7;
    if (diff === 0 && !includeToday) diff = 7;
    return addDays(now, diff);
  }

  /* ---------- žodynai ---------- */

  var WD_STEM = "(pirmadien|antradien|trečiadien|treciadien|ketvirtadien|penktadien|šeštadien|sestadien|sekmadien)";
  var WD_NUM = {
    sekmadien: 0, pirmadien: 1, antradien: 2, trečiadien: 3, treciadien: 3,
    ketvirtadien: 4, penktadien: 5, šeštadien: 6, sestadien: 6
  };
  var MONTHS = [
    ["sausio"], ["vasario"], ["kovo"], ["balandžio", "balandzio"], ["gegužės", "geguzes"],
    ["birželio", "birzelio"], ["liepos"], ["rugpjūčio", "rugpjucio"], ["rugsėjo", "rugsejo"],
    ["spalio"], ["lapkričio", "lapkricio"], ["gruodžio", "gruodzio"]
  ];
  var MONTH_RE = MONTHS.map(function (v) { return v.join("|"); }).join("|");
  var NUM_WORDS = {
    vienos: 1, vieną: 1, viena: 1, dviejų: 2, dvieju: 2, dvejų: 2, dveju: 2, dvi: 2,
    trijų: 3, triju: 3, tris: 3, keturių: 4, keturiu: 4, penkių: 5, penkiu: 5,
    šešių: 6, sesiu: 6, septynių: 7, septyniu: 7, aštuonių: 8, astuoniu: 8,
    devynių: 9, devyniu: 9, dešimt: 10, desimt: 10, dešimties: 10
  };
  var NUM_RE = "\\d{1,3}|" + Object.keys(NUM_WORDS).join("|");

  var VAL = "(?:val\\.?|valand" + W + "|h)";
  var DAYPART = "(ryto|ryte|dienos|dien[ąa]|po\\s+piet[ųu]|vakaro|vakare|nakties|nakt[įi])";
  var TIME_PREFIX = "(?:(?:apie|iki|nuo|po)\\s+)?";

  var SHOP = "nupirk" + W + "|nusipirk" + W + "|pirkini" + W + "|parduotuv" + W + "|krautuv" + W + "|prekybos\\s+centr" + W;
  var CALL = "paskambin" + W + "|perskambin" + W + "|skambin" + W + "|skambink" + W;
  var REPLY = "atra[šs]yt" + W + "|atra[šs]yk" + W + "|atsakyt" + W + "|atsakyk" + W;
  var WRITE = "para[šs]yt" + W + "|para[šs]yk" + W;
  var MSG_WORDS = "žinut" + W + "|zinut" + W + "|laišk" + W + "|laisk" + W + "|el\\.?\\s*laišk" + W + "|sms|e-?mail" + W;

  var LEAD_FILLER = new RegExp("^(?:(?:reikia|reiks|būtinai|butinai|prašau|prasau|dar|man|į|i|iš|is|ir|sąrašą|sąrašas|sarasa|sarasas|įrašyk|irasyk|įrašyti|irasyti|įdėk|idek|pridėk|pridek|pridėti|prideti)(?:\\s+|$))+", "i");
  var TRAIL_FILLER = new RegExp("(?:\\s+(?:į|i|iš|is|ir|reikia|sąrašą|sarasa))+$", "i");

  /* ---------- tekstas, iš kurio „iškerpame" atpažintas dalis ---------- */

  function Ctx(text) {
    this.orig = " " + text + " ";
    this.low = this.orig.toLowerCase();
    if (this.low.length !== this.orig.length) this.low = this.orig; // atsargumo dėlei
  }
  /* Randa pirmą atitikmenį; jei fn(grupės) grąžina ne null – iškerpa ir grąžina reikšmę. */
  Ctx.prototype.take = function (pat, fn) {
    var re = new RegExp(NB + "(" + pat + ")" + NA, "gi");
    var m;
    while ((m = re.exec(this.low)) !== null) {
      var start = m.index + m[1].length;
      var end = start + m[2].length;
      var val = fn ? fn(m.slice(3), m[2]) : true;
      if (val !== null && val !== undefined) {
        this.cut(start, end);
        return val;
      }
      re.lastIndex = m.index + 1;
    }
    return null;
  };
  Ctx.prototype.has = function (pat) {
    return new RegExp(NB + "(" + pat + ")" + NA, "i").test(this.low);
  };
  Ctx.prototype.cut = function (start, end) {
    var sp = new Array(end - start + 1).join(" ");
    this.orig = this.orig.slice(0, start) + sp + this.orig.slice(end);
    this.low = this.low.slice(0, start) + sp + this.low.slice(end);
  };
  Ctx.prototype.text = function () { return this.orig; };

  function clean(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/([,;:])(?:\s*[,;:])+/g, "$1")
      .replace(/^[\s,.;:!?–—-]+|[\s,;:!?–—-]+$/g, "")
      .replace(/\s+\.$/, ".")
      .trim();
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function stripFillers(s) {
    var prev;
    s = clean(s);
    do {
      prev = s;
      s = s.replace(LEAD_FILLER, "").replace(TRAIL_FILLER, "");
      s = clean(s).replace(/\.$/, "");
    } while (s !== prev);
    return s;
  }

  /* ---------- pasikartojimas, data, laikas ---------- */

  function takeRecurrence(c, now) {
    var r = c.take("(?:kas|kiekvien[ąa])\\s+" + WD_STEM + "(?:į|i)?", function (g) {
      return { kartojasi: "savaite", data: ymd(nextWeekday(now, WD_NUM[g[0]], true)) };
    });
    if (r) return r;
    r = c.take(WD_STEM + "iais", function (g) {
      return { kartojasi: "savaite", data: ymd(nextWeekday(now, WD_NUM[g[0]], true)) };
    });
    if (r) return r;
    if (c.take("kas\\s*dien|kasdien|kiekvien[ąa]\\s+dien[ąa]")) return { kartojasi: "diena", data: "" };
    if (c.take("(?:kas|kiekvien[ąa])\\s+savait[ęe]")) return { kartojasi: "savaite", data: "" };
    if (c.take("(?:kas|kiekvien[ąa])\\s+m[ėe]nes[įi]")) return { kartojasi: "menuo", data: "" };
    return null;
  }

  function takeDate(c, now) {
    var d;
    if (c.take("(?:iki\\s+)?(?:šiandien|siandien)(?:os)?")) return ymd(now);
    if (c.take("(?:iki\\s+)?u[žz]poryt")) return ymd(addDays(now, 3));
    if (c.take("(?:iki\\s+)?poryt")) return ymd(addDays(now, 2));
    if (c.take("iki\\s+rytojaus|rytoj")) return ymd(addDays(now, 1));

    d = c.take("po\\s+(" + NUM_RE + ")\\s+(dien" + W + "|savai" + W + "|m[ėe]nes" + W + ")", function (g) {
      var n = /^\d+$/.test(g[0]) ? Number(g[0]) : NUM_WORDS[g[0]];
      if (!n) return null;
      if (/^dien/.test(g[1])) return ymd(addDays(now, n));
      if (/^savai/.test(g[1])) return ymd(addDays(now, 7 * n));
      return ymd(addMonths(now, n));
    });
    if (d) return d;
    d = c.take("po\\s+(savait[ėe]s|m[ėe]nesio)", function (g) {
      return /^savai/.test(g[0]) ? ymd(addDays(now, 7)) : ymd(addMonths(now, 1));
    });
    if (d) return d;
    if (c.take("kit[ąa]\\s+savait[ęe]")) return ymd(nextWeekday(now, 1, false));
    if (c.take("kit[ąa]\\s+m[ėe]nes[įi]")) return ymd(new Date(now.getFullYear(), now.getMonth() + 1, 1));

    // gruodžio 5, gruodžio 5 d., gruodžio 5-ąją, iki gruodžio 5 dienos
    d = c.take("(?:iki\\s+)?(" + MONTH_RE + ")\\s+(\\d{1,2})(?:\\s*d\\.|\\s*d|\\s+dien" + W + "|\\s*-?\\s*(?:oji|ąją|ają|ją|ja|a|ą|os))?", function (g) {
      var mi = -1;
      for (var i = 0; i < MONTHS.length; i++) if (MONTHS[i].indexOf(g[0]) >= 0) mi = i;
      var y = now.getFullYear();
      var x = validDate(y, mi + 1, Number(g[1]));
      if (!x) return null;
      if (x < dayStart(now)) x = validDate(y + 1, mi + 1, Number(g[1]));
      return x ? ymd(x) : null;
    });
    if (d) return d;

    // 2026-12-05, 2026.12.05, 2026/12/05
    d = c.take("(?:iki\\s+)?(\\d{4})[-./](\\d{1,2})[-./](\\d{1,2})", function (g) {
      var x = validDate(Number(g[0]), Number(g[1]), Number(g[2]));
      return x ? ymd(x) : null;
    });
    if (d) return d;
    // 05.12.2026 (diena.mėnuo.metai)
    d = c.take("(?:iki\\s+)?(\\d{1,2})\\.(\\d{1,2})\\.(\\d{2,4})", function (g) {
      var y = Number(g[2]); if (y < 100) y += 2000;
      var x = validDate(y, Number(g[1]), Number(g[0]));
      return x ? ymd(x) : null;
    });
    if (d) return d;

    // pirmadienį, iki penktadienio, kitą antradienį
    d = c.take("(?:(?:iki|kit[ąa]|š[įi]|si)\\s+)?" + WD_STEM + "(?:io|į|i|is|ys)?", function (g) {
      return ymd(nextWeekday(now, WD_NUM[g[0]], false));
    });
    return d || "";
  }

  function hourFor(h, part) {
    if (!part) return h;
    part = part.replace(/\s+/g, " ");
    if (/^(vakar|po piet)/.test(part)) return h < 12 ? h + 12 : h;
    if (/^dien/.test(part)) return h < 8 ? h + 12 : h;
    if (/^nakt/.test(part)) {
      if (h === 12) return 0;
      if (h >= 9 && h < 12) return h + 12;
      return h;
    }
    if (/^ryt/.test(part)) return h === 12 ? 0 : h;
    return h;
  }
  function mkTime(h, m) {
    h = Number(h); m = Number(m || 0);
    if (!(h >= 0 && h < 24 && m >= 0 && m < 60)) return null;
    return pad2(h) + ":" + pad2(m);
  }

  function takeTime(c) {
    var t;
    // 9 vakaro, 7:30 vakare, 3 val. dienos, 11 nakties
    t = c.take(TIME_PREFIX + "(\\d{1,2})(?:[:.](\\d{2}))?\\s*(?:" + VAL + "\\s*)?" + DAYPART, function (g) {
      var h = Number(g[0]);
      if (h > 12) return mkTime(h, g[1]);
      return mkTime(hourFor(h, g[2].toLowerCase()), g[1]);
    });
    if (t) return t;
    // 10:30 (dvitaškis – visada laikas)
    t = c.take(TIME_PREFIX + "(\\d{1,2}):(\\d{2})(?:\\s*" + VAL + ")?", function (g) { return mkTime(g[0], g[1]); });
    if (t) return t;
    // 10 val. 30 min.
    t = c.take(TIME_PREFIX + "(\\d{1,2})\\s*" + VAL + "\\s*(\\d{1,2})\\s*min\\.?", function (g) { return mkTime(g[0], g[1]); });
    if (t) return t;
    // 10.30 (taškas – laikas, nes pilnos datos jau iškirptos)
    t = c.take(TIME_PREFIX + "(\\d{1,2})\\.(\\d{2})(?:\\s*" + VAL + ")?", function (g) { return mkTime(g[0], g[1]); });
    if (t) return t;
    // 10 val., 10 valandą
    t = c.take(TIME_PREFIX + "(\\d{1,2})\\s*" + VAL, function (g) { return mkTime(g[0], 0); });
    if (t) return t;
    if (c.take("(?:per\\s+)?vidurdien" + W)) return "12:00";
    return "";
  }

  /* ---------- kategorijos ---------- */

  function splitTopic(s) {
    var m = new RegExp(NB + "(dėl|del|apie)\\s+", "i").exec(s);
    if (!m) return { kam: s, tema: "" };
    var at = m.index + m[1].length;
    return { kam: s.slice(0, at), tema: s.slice(at + m[2].length).replace(/^\s+/, "") };
  }

  function contactParts(c, keywordPat) {
    c.take(keywordPat);
    c.take("(?:" + MSG_WORDS + ")");
    var rest = clean(c.text());
    var p = splitTopic(rest);
    var kam = cap(stripFillers(p.kam));
    var tema = stripFillers(p.tema);
    return { kam: kam || cap(tema), tema: kam ? tema : "" };
  }

  /* „parašyti" – atrašymas tik jei toliau eina žinutė/laiškas arba gavėjas (Jonui, mamai, Petrui). */
  function writeIsMessage(c) {
    var re = new RegExp(NB + "(" + WRITE + ")\\s+(\\S+)", "i");
    var m = re.exec(c.orig);
    if (!m) return false;
    var next = m[3].replace(/[,.;:!?]+$/, "");
    if (new RegExp("^(?:" + MSG_WORDS + ")$", "i").test(next)) return true;
    if (/^[A-ZĄČĘĖĮŠŲŪŽ]/.test(next)) return true;
    return /(ui|iui|ai|iai|ei|ams|iams|oms|ėms|ims)$/i.test(next);
  }

  /**
   * Pagrindinė funkcija.
   * Grąžina { tipas, tekstas, kam, tema, data, laikas, kartojasi, prekes }.
   * tipas: "uzduotys" | "atrasymai" | "skambuciai" | "pirkiniai".
   */
  function analyze(fraze, now) {
    now = now || new Date();
    var c = new Ctx(String(fraze || "").trim());
    var out = { tipas: "uzduotys", tekstas: "", kam: "", tema: "", data: "", laikas: "", kartojasi: "", prekes: [] };

    var rec = takeRecurrence(c, now);
    if (rec) { out.kartojasi = rec.kartojasi; out.data = rec.data; }
    var d = takeDate(c, now);
    if (d && !out.data) out.data = d;
    out.laikas = takeTime(c);

    if (out.laikas && !out.data) out.data = out.laikas < hm(now) ? ymd(addDays(now, 1)) : ymd(now);
    if (out.kartojasi && !out.data) out.data = ymd(now);

    if (c.has(SHOP)) {
      out.tipas = "pirkiniai";
      while (c.take("(?:" + SHOP + ")")) { /* iškerpame visus raktažodžius */ }
      var rest = stripFillers(c.text());
      out.prekes = splitItems(rest);
      out.tekstas = out.prekes.join(", ");
      return out;
    }
    if (c.has(CALL)) {
      out.tipas = "skambuciai";
      var p1 = contactParts(c, "(?:" + CALL + ")");
      out.kam = p1.kam; out.tema = p1.tema;
      out.tekstas = out.kam;
      return out;
    }
    if (c.has(REPLY) || (c.has(WRITE) && writeIsMessage(c))) {
      out.tipas = "atrasymai";
      var p2 = contactParts(c, "(?:" + REPLY + "|" + WRITE + ")");
      out.kam = p2.kam; out.tema = p2.tema;
      out.tekstas = out.kam;
      return out;
    }
    out.tekstas = cap(clean(c.text()).replace(/^(?:iki|nuo|apie)\s+/i, "").replace(/\s+(?:iki|nuo|apie)$/i, ""));
    return out;
  }

  /* Pirkinių sąrašą skaido per kablelius, kabliataškius, „ir", „bei". */
  function splitItems(s) {
    return String(s || "")
      .split(new RegExp(",|;|" + NB.replace("(", "(?:") + "(?:ir|bei)" + NA, "i"))
      .map(function (x) { return cap(stripFillers(x)); })
      .filter(function (x) { return !!x; });
  }

  /* ---------- formų laukų normalizavimas ---------- */

  function normDate(v) {
    v = String(v || "").trim();
    if (!v) return "";
    var m = v.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
    if (m) { var a = validDate(+m[1], +m[2], +m[3]); return a ? ymd(a) : ""; }
    m = v.match(/^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?$/);
    if (m) {
      var y = m[3] ? Number(m[3]) : new Date().getFullYear();
      if (y < 100) y += 2000;
      var b = validDate(y, +m[2], +m[1]);
      return b ? ymd(b) : "";
    }
    return "";
  }

  function normTime(v) {
    v = String(v || "").trim().replace(/\s/g, "");
    if (!v) return "";
    var m = v.match(/^(\d{1,2})[:.,](\d{1,2})$/);
    if (m) return mkTime(m[1], m[2]) || "";
    if (/^\d{1,2}$/.test(v)) return mkTime(v, 0) || "";
    if (/^\d{3}$/.test(v)) return mkTime(v.slice(0, 1), v.slice(1)) || "";
    if (/^\d{4}$/.test(v)) return mkTime(v.slice(0, 2), v.slice(2)) || "";
    return "";
  }

  /* Kita pasikartojančios užduoties data: ne ankstesnė nei šiandien. */
  function nextOccurrence(data, kartojasi, now) {
    now = now || new Date();
    var today = dayStart(now);
    var d = data ? parseYmd(data) : today;
    var guard = 0;
    do {
      if (kartojasi === "diena") d = addDays(d, 1);
      else if (kartojasi === "savaite") d = addDays(d, 7);
      else if (kartojasi === "menuo") d = addMonths(d, 1);
      else return data;
    } while (d < today && ++guard < 1000);
    return ymd(d);
  }

  var api = {
    analyze: analyze,
    splitItems: splitItems,
    normDate: normDate,
    normTime: normTime,
    nextOccurrence: nextOccurrence,
    ymd: ymd,
    hm: hm,
    addDays: addDays,
    parseYmd: parseYmd
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Parser = api;
})(typeof window !== "undefined" ? window : this);
