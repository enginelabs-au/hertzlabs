/* Home page: one pinned stage where every value follows the scroll position.
   The top of the page is 0.10 Hz and the bottom of the stage is 500 Hz, so
   scrolling turns the dial. Nothing makes sound until the visitor asks. */
(function () {
  "use strict";

  /* ---------- Data ---------- */

  // keys: [position inside the band 0..1, Hz]. A flat stretch is a detent,
  // where the dial rests on a frequency worth stopping at.
  // sig: the Lissajous ratio drawn in the phone's visualiser for that band.
  var BANDS = [
    { name: "HEALING", greek: "EPSILON", pill: "EPSILON", lo: 0.1, hi: 0.5, range: "under 0.5 Hz", tag: "<0.5Hz", rgb: [143, 127, 240], tab: 0, scene: "how", span: 1.1, sig: [1, 1] },
    { name: "DREAM", greek: "DELTA", pill: "DELTA", lo: 0.5, hi: 4, range: "0.5 – 4 Hz", tag: "0.5–4Hz", rgb: [92, 134, 224], tab: 0, scene: "dsp", span: 0.9, sig: [1, 2] },
    { name: "MEDITATE", greek: "THETA", pill: "THETA", lo: 4, hi: 8, range: "4 – 8 Hz", tag: "4–8Hz", rgb: [47, 181, 210], tab: 1, scene: "math", span: 1.3, sig: [2, 3], keys: [[0, 4], [0.26, 5], [0.42, 5], [0.72, 7.83], [0.93, 7.83], [1, 8]] },
    { name: "CALM", greek: "ALPHA", pill: "ALPHA", lo: 8, hi: 12, range: "8 – 12 Hz", tag: "8–12Hz", rgb: [92, 201, 138], tab: 2, scene: "music", span: 1.1, sig: [3, 4], keys: [[0, 8], [0.4, 10], [0.68, 10], [1, 12]] },
    { name: "FOCUS", greek: "LOW BETA", pill: "BETA", lo: 12, hi: 15, range: "12 – 15 Hz", tag: "12–15Hz", rgb: [195, 219, 82], tab: 3, scene: "ai", span: 1.3, sig: [3, 5], keys: [[0, 12], [0.5, 14], [0.86, 14], [1, 15]] },
    { name: "ENGAGED", greek: "BETA", pill: "BETA", lo: 15, hi: 30, range: "15 – 30 Hz", tag: "15–30Hz", rgb: [224, 142, 69], tab: 0, scene: "engines", span: 1.3, sig: [4, 5] },
    { name: "COGNITION", greek: "GAMMA", pill: "GAMMA", lo: 30, hi: 50, range: "30 – 50 Hz", tag: "30–50Hz", rgb: [240, 106, 152], tab: 0, scene: "kinetic", span: 1.0, sig: [5, 6], keys: [[0, 30], [0.4, 40], [0.62, 40], [1, 50]] },
    { name: "INSIGHT", greek: "HIGH GAMMA", pill: "GAMMA", lo: 50, hi: 80, range: "50 – 80 Hz", tag: "50–80Hz", rgb: [255, 61, 87], tab: 0, scene: "param", span: 1.0, sig: [5, 8] },
    { name: "SYNTHESIS", greek: "LAMBDA", pill: "LAMBDA", lo: 80, hi: 150, range: "80 – 150 Hz", tag: "80–150Hz", rgb: [255, 60, 199], tab: 0, scene: "open", span: 0.5, sig: [7, 8] },
    { name: "INTEGRATION", greek: "SUPRA-GAMMA", pill: "SUPRA", lo: 150, hi: 280, range: "150 – 280 Hz", tag: "150–280Hz", rgb: [160, 87, 255], tab: 0, scene: "open", span: 0.45, sig: [8, 11] },
    { name: "INFINITE", greek: "OMEGA", pill: "OMEGA", lo: 280, hi: 500, range: "280 – 500 Hz", tag: "280–500Hz", rgb: [61, 131, 255], tab: 0, scene: "open", span: 0.7, sig: [11, 13], keys: [[0, 280], [0.75, 500], [1, 500]] }
  ];

  // chip: which of the app's four engine groups lights up for that engine.
  var ENGINES = [
    { name: "Binaural", sub: " · Dichotic", chip: 0, desc: "Phantom internal beat. Requires headphones." },
    { name: "Hemispheric Sync", sub: "", chip: 0, desc: "Phase-aligned signals for brain coherence." },
    { name: "Phase Alignment", sub: "", chip: 0, desc: "Continuous phase shifting for isochronic entrainment." },
    { name: "Pitch Modulation", sub: "", chip: 2, desc: "Frequency-domain carrier modulation." },
    { name: "Acoustic Resonance", sub: "", chip: 1, desc: "Speaker-friendly mode. No headphones required." },
    { name: "Ambient Modulation", sub: "", chip: 3, desc: "Low-intensity background entrainment." },
    { name: "Music-Reactive", sub: "", chip: 2, desc: "Tracks live external audio dynamically." }
  ];

  var TICKER = ["BINAURAL", "HEMISPHERIC SYNC", "PHASE ALIGNMENT", "PITCH MODULATION", "ACOUSTIC RESONANCE", "AMBIENT", "MUSIC-REACTIVE", "SCHUMANN 7.83 HZ", "GOLDEN RATIO φ", "FIBONACCI", "SOLFEGGIO", "DELTA → GAMMA", "AI GUIDE", "PROTOCOL SEQUENCES"];
  var TICKER_RGB = ["248 184 32", "111 208 143", "83 221 255", "232 104 248"];

  // Frequencies where the tuner names what the dial has landed on.
  var DETENTS = [[5, "FIBONACCI NUMBER"], [7.83, "SCHUMANN RESONANCE"], [10, "ALPHA BASELINE"]];

  var DEMO = [10, 1.09, 6, 40, 14, 7.83]; // what the hero phone plays with before any scrolling
  var PROMPT = "help me focus for coding";
  var INTRO = 0.8;                         // viewport heights spent moving from hero to dial
  var F_MIN = 0.1;
  var F_MAX = 500;
  var CARRIER = 220;
  var SCREEN_RATIO = 460 / 996;
  var TAU = Math.PI * 2;
  var GOLDEN_ANGLE = 2.39996323;

  /* ---------- Small helpers ---------- */

  function $(selector, parent) { return (parent || document).querySelector(selector); }
  function $$(selector, parent) { return Array.prototype.slice.call((parent || document).querySelectorAll(selector)); }
  function clamp(value, lo, hi) { return value < lo ? lo : value > hi ? hi : value; }
  function clamp01(value) { return value < 0 ? 0 : value > 1 ? 1 : value; }
  function lerp(a, b, amount) { return a + (b - a) * amount; }
  function smooth(value) { var v = clamp01(value); return v * v * (3 - 2 * v); }
  function smoother(value) { var v = clamp01(value); return v * v * v * (v * (v * 6 - 15) + 10); }

  function keyed(attribute) {
    var map = {};
    $$("[" + attribute + "]").forEach(function (node) { map[node.getAttribute(attribute)] = node; });
    return map;
  }

  // DOM writes only happen when a value actually changes.
  var last = {};
  function changed(key, value) {
    if (last[key] === value) return false;
    last[key] = value;
    return true;
  }
  function text(key, node, value) { if (node && changed(key, value)) node.textContent = value; }
  function flip(key, node, name, on) { if (node && changed(key, on)) node.classList.toggle(name, on); }

  /* Three significant figures, the way the app writes a target. */
  function hz(f) {
    if (f < 9.995) return f.toFixed(2);
    if (f < 99.95) return f.toFixed(1);
    return String(Math.round(f));
  }

  /* The two carriers for a beat. Above 220 Hz the centre rises so the left tone stays audible. */
  function carriers(f) {
    var centre = Math.max(CARRIER, f / 2 + 110);
    return { left: centre - f / 2, right: centre + f / 2 };
  }

  /* ---------- Timeline ---------- */

  var cursor = INTRO;
  BANDS.forEach(function (band, index) {
    band.i = index;
    band.start = cursor;
    cursor += band.span;
    band.end = cursor;
    band.css = band.rgb.join(" ");
    if (!band.keys) band.keys = [[0, band.lo], [1, band.hi]];
  });
  var TOTAL = cursor;
  var LAST = BANDS.length - 1;

  function bandFrequency(band, u) {
    var keys = band.keys;
    for (var i = 1; i < keys.length; i++) {
      if (u <= keys[i][0]) {
        var a = keys[i - 1];
        var b = keys[i];
        return a[1] * Math.pow(b[1] / a[1], (u - a[0]) / ((b[0] - a[0]) || 1));
      }
    }
    return keys[keys.length - 1][1];
  }

  function frequencyAt(t) {
    if (t <= INTRO) return F_MIN;
    for (var i = 0; i <= LAST; i++) {
      if (t <= BANDS[i].end || i === LAST) return bandFrequency(BANDS[i], clamp01((t - BANDS[i].start) / BANDS[i].span));
    }
    return F_MAX;
  }

  function bandOf(f) {
    for (var i = 0; i < LAST; i++) if (f < BANDS[i].hi) return i;
    return LAST;
  }

  /* Which band a frequency sits in, and how far it has blended into a neighbour near an edge. */
  function blendAt(f) {
    var i = bandOf(f);
    var band = BANDS[i];
    var v = clamp01(Math.log(f / band.lo) / Math.log(band.hi / band.lo));
    var edge = 0.1;
    var mix = { a: i, b: i, w: 0, i: i, v: v };
    if (v < edge && i > 0) { mix.a = i - 1; mix.w = 0.5 + v / (2 * edge); }
    else if (v > 1 - edge && i < LAST) { mix.b = i + 1; mix.w = (v - (1 - edge)) / (2 * edge); }
    return mix;
  }

  /* The hero phone idles through a few targets until the visitor scrolls. */
  function demoFrequency(time) {
    if (reduced) return DEMO[0];
    var step = 3.8;
    var glide = 1.3;
    var n = time / step;
    var index = Math.floor(n) % DEMO.length;
    var from = DEMO[index];
    var to = DEMO[(index + 1) % DEMO.length];
    return from * Math.pow(to / from, smoother(((n % 1) * step - (step - glide)) / glide));
  }

  // Where the phone swipes to its next tab, in timeline units.
  var SWIPES = [];
  for (var s = 1; s <= LAST; s++) {
    var hop = (BANDS[s].tab - BANDS[s - 1].tab + 4) % 4;
    if (hop) SWIPES.push({ at: BANDS[s].start, by: hop });
  }

  function tabPosition(t) {
    var position = 0;
    for (var i = 0; i < SWIPES.length; i++) position += SWIPES[i].by * smoother((t - (SWIPES[i].at - 0.1)) / 0.2);
    return position;
  }

  /* ---------- Elements ---------- */

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var narrow = window.matchMedia("(max-width: 899px)");
  var chrome = window.HzChrome || { flag: function () {}, ticks: function () {}, refresh: function () {} };

  var track = $("#spectrum");
  var stage = $("#stage");
  var hero = $("#hero");
  var tuner = $("#tuner");
  var device = $("#device");
  var ui = $("#ui");
  var cue = $("#cue");
  var nav = $("#nav");
  var menuButton = $("#menu");
  var soundButton = $("#sound");
  var pages = $$(".pg", ui);
  var tabBar = $("#ui-tabs");
  var tabs = $$(".tab", tabBar);
  var statusIcons = $("#ui-sys");
  var chips = $$("#ui-chips span");
  var playbackCard = $("#ui-bgplay");
  var aiInput = $("#ui-aiinput");
  var aiChip = $("#ui-aichips span");
  var aiAnswer = $("#ui-airesult");
  var mathRows = {};
  $$("#ui-math li").forEach(function (row) { mathRows[row.getAttribute("data-m")] = row; });

  var K = keyed("data-k");      // values inside the phone
  var T = keyed("data-t");      // the tuner beside it
  var LIVE = keyed("data-live"); // numbers inside the first caption

  var SCENES = {};
  var sceneList = $$(".scene").map(function (node) {
    var key = node.getAttribute("data-scene");
    var mine = BANDS.filter(function (band) { return band.scene === key; });
    var scene = { key: key, node: node, start: mine[0].start, end: mine[mine.length - 1].end };
    SCENES[key] = scene;
    return scene;
  });

  function progress(key, t) {
    var scene = SCENES[key];
    return clamp01((t - scene.start) / (scene.end - scene.start));
  }

  function within(key, t) {
    return t >= SCENES[key].start && t < SCENES[key].end;
  }

  /* ---------- Lists built from the data ---------- */

  var bandRows = BANDS.map(function (band) {
    var row = document.createElement("li");
    row.style.setProperty("--c", band.css);
    row.innerHTML = "<b>" + band.name + "</b><i>" + band.tag + "</i>";
    $("#ui-bands").appendChild(row);
    return row;
  });

  var engineRows = ENGINES.map(function (engine) {
    var row = document.createElement("li");
    row.textContent = (engine.name + engine.sub).toUpperCase();
    var detail = document.createElement("span");
    detail.textContent = engine.desc;
    row.appendChild(detail);
    $("#engine-list").appendChild(row);
    return row;
  });

  // Two copies of the strip, so the marquee can loop without a seam.
  TICKER.concat(TICKER).forEach(function (label, index) {
    var item = document.createElement("span");
    var dot = document.createElement("i");
    dot.style.setProperty("--c", TICKER_RGB[index % TICKER_RGB.length]);
    item.appendChild(dot);
    item.appendChild(document.createTextNode(label));
    if (index >= TICKER.length) item.setAttribute("aria-hidden", "true");
    $("#ticker").appendChild(item);
  });

  BANDS.forEach(function (band) {
    var item = document.createElement("li");
    var button = document.createElement("button");
    button.type = "button";
    button.style.setProperty("--c", band.css);
    button.innerHTML = "<b>" + band.name + "</b><span>" + band.range + "</span>";
    button.setAttribute("aria-label", "Tune to " + band.name.toLowerCase() + ", " + band.range);
    button.addEventListener("click", function () { go(scrollFor(band.start + band.span * 0.5)); });
    item.appendChild(button);
    $("#legend").appendChild(item);
  });

  /* ---------- Layout ---------- */

  var G = { w: 0, h: 0, wide: true, heroX: 0, heroY: 0, top: 0, range: 1, dpr: 1 };
  var dirty = true;

  var field = $("#field");
  var fieldCtx = field.getContext("2d");
  var engineCtx = $("#viz-eng").getContext("2d");
  var mathCtx = $("#viz-math").getContext("2d");
  var bgCtx = $("#viz-bg").getContext("2d");
  var aiCtx = $("#viz-ai").getContext("2d");

  // The phone's own canvases are drawn at twice the app's pixel size so they stay sharp.
  [["#viz-eng", 318, 262], ["#viz-math", 428, 236], ["#viz-bg", 428, 204], ["#viz-ai", 460, 240]].forEach(function (spec) {
    var canvas = $(spec[0]);
    canvas.width = spec[1] * 2;
    canvas.height = spec[2] * 2;
  });

  function layout() {
    var w = stage.clientWidth;
    var h = stage.clientHeight;
    var wide = !narrow.matches;
    var rail = parseFloat(getComputedStyle(root).getPropertyValue("--rail-h")) || 10;
    var top = rail + (wide ? 76 : 88);     // clear of the menu bar
    var bottom = wide ? 0 : 186;            // room for the caption under the phone
    var height = wide ? clamp(h - top - 84, 340, 720) : clamp(h - top - bottom - 16, 210, 600);
    var pw = Math.min(height * SCREEN_RATIO, wide ? w * 0.3 : w - 150);
    var ph = pw / SCREEN_RATIO;
    var bezel = Math.max(6, pw * 0.036);
    var half = pw / 2 + bezel;
    var edge = wide ? clamp(w * 0.062, 24, 116) : 20;
    var capEdge = wide ? clamp(w * 0.05, 24, 96) : 20;

    G.w = w;
    G.h = h;
    G.wide = wide;
    G.heroX = wide ? w * 0.25 : 0;

    var vars = {
      "--pw": pw.toFixed(1) + "px",
      "--ph": ph.toFixed(1) + "px",
      "--bz": bezel.toFixed(1) + "px",
      "--k": (pw / 460).toFixed(4),
      "--top": top + "px",
      "--bottom": bottom + "px",
      "--edge": edge.toFixed(0) + "px",
      "--cap-edge": capEdge.toFixed(0) + "px",
      // Tuner column beside the phone (or, on a narrow screen, the gutter either side of it).
      "--col": (wide ? w / 2 - half - edge - 40 : (w - 2 * half) / 2).toFixed(0) + "px",
      "--cap": (wide ? Math.min(440, w / 2 - half - capEdge - 52) : w - 40).toFixed(0) + "px",
      "--hero-w": (wide ? Math.min(780, w / 2 + G.heroX - half * 1.1 - edge - 36) : w - 40).toFixed(0) + "px"
    };
    Object.keys(vars).forEach(function (name) { stage.style.setProperty(name, vars[name]); });

    // On a narrow screen the hero phone waits just under the hero copy. It is
    // drawn 20% larger there, about its centre, hence the tenth of its height.
    G.heroY = wide ? 0 : Math.max(0, hero.offsetTop + hero.offsetHeight + 18 - device.offsetTop + 0.1 * device.offsetHeight);

    G.top = track.offsetTop;
    G.range = Math.max(1, track.offsetHeight - h);
    G.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    field.width = Math.round(w * G.dpr);
    field.height = Math.round(h * G.dpr);

    var max = Math.max(1, root.scrollHeight - window.innerHeight);
    chrome.ticks(BANDS.map(function (band) {
      return { at: clamp01(scrollFor(band.start) / max), rgb: band.css };
    }));
    dirty = true;
  }

  function scrollFor(t) {
    return G.top + (t / TOTAL) * G.range;
  }

  /* ---------- Sound (off until asked for) ---------- */

  var audio = null;
  var playing = false;

  function buildAudio() {
    var Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    var context = new Context();
    var out = context.createGain();
    out.gain.value = 0;
    out.connect(context.destination);
    // One sine per ear: input 0 of the merger is the left channel, input 1 the right.
    var merge = context.createChannelMerger(2);
    merge.connect(out);
    function tone(channel) {
      var osc = context.createOscillator();
      osc.type = "sine";
      osc.frequency.value = CARRIER;
      osc.connect(merge, 0, channel);
      osc.start();
      return osc;
    }
    return { context: context, out: out, left: tone(0), right: tone(1) };
  }

  function setPlaying(on) {
    if (on && !audio) audio = buildAudio();
    if (!audio) return;
    playing = on;
    if (on) audio.context.resume();
    else setTimeout(function () { if (!playing) audio.context.suspend(); }, 600);
    ui.classList.toggle("is-playing", on);
    K.play.textContent = on ? "PAUSE" : "PLAY";
    soundButton.setAttribute("aria-pressed", String(on));
    soundButton.title = on ? "Mute" : "Hear this frequency (headphones recommended)";
    last.audio = null;
    dirty = true;
  }

  function followAudio(tones, audible) {
    if (!audio) return;
    var key = playing && audible ? tones.left.toFixed(2) + "/" + tones.right.toFixed(2) : "off";
    if (!changed("audio", key)) return;
    var now = audio.context.currentTime;
    audio.out.gain.setTargetAtTime(playing && audible ? 0.06 : 0, now, 0.12);
    if (playing && audible) {
      audio.left.frequency.setTargetAtTime(tones.left, now, 0.05);
      audio.right.frequency.setTargetAtTime(tones.right, now, 0.05);
    }
  }

  /* ---------- Drawing ---------- */

  function rgba(rgb, alpha) {
    return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + alpha.toFixed(3) + ")";
  }

  /* Behind everything: one set of rings per ear, crossing where the phone sits.
     Their spacing tightens with frequency, so the page gets finer as it descends. */
  function drawField(time, f, mix, wordAlpha) {
    var c = fieldCtx;
    var w = G.w;
    var h = G.h;
    c.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    var q = Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN);
    var loose = G.wide ? 230 : 150;
    var tight = G.wide ? 11 : 9;
    var gap = loose * Math.pow(tight / loose, q);
    var drift = reduced ? 0.5 : (time * 0.07) % 1;
    var strength = 0.07 + 0.14 * Math.min(1, gap / 70);
    var cy = h * 0.54;
    var reach = w * 1.12;

    c.lineWidth = 1;
    ringSet(c, -w * 0.05, cy, -Math.PI / 2, gap, drift, reach, [248, 184, 32], strength);
    ringSet(c, w * 1.05, cy, Math.PI / 2, gap, drift, reach, [46, 201, 140], strength);

    // The band names run along the floor of the stage like a film strip.
    if (!G.wide || wordAlpha < 0.01) return;
    var size = Math.min(w * 0.128, h * 0.3);
    var place = mix.i + mix.v;
    c.font = "800 " + size.toFixed(0) + "px Inter, system-ui, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    c.lineWidth = 1.5;
    for (var i = Math.max(0, mix.i - 1); i <= Math.min(LAST, mix.i + 1); i++) {
      c.strokeStyle = rgba(BANDS[i].rgb, 0.36 * wordAlpha);
      c.strokeText(BANDS[i].name, w / 2 + (i + 0.5 - place) * w, h - size * 0.17);
    }
  }

  function ringSet(c, cx, cy, from, gap, drift, reach, rgb, strength) {
    var fade = c.createRadialGradient(cx, cy, 0, cx, cy, reach);
    fade.addColorStop(0, rgba(rgb, strength));
    fade.addColorStop(1, rgba(rgb, 0));
    c.strokeStyle = fade;
    c.beginPath();
    for (var r = gap * drift; r < reach; r += gap) {
      if (r < 1) continue;
      c.moveTo(cx + r * Math.cos(from), cy + r * Math.sin(from));
      c.arc(cx, cy, r, from, from + Math.PI);
    }
    c.stroke();
  }

  /* Engines tab: right tone along the top, left tone down the side, and the
     figure the two draw against each other. */
  function drawEngine(time, f, mix, rgb) {
    var c = engineCtx;
    var spin = reduced ? 0 : time;
    var phase = spin * 0.5 + Math.log(f) * 2.4;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, 318, 262);
    c.lineCap = "round";
    c.lineJoin = "round";

    c.lineWidth = 1.7;
    c.strokeStyle = "#23C897";
    c.beginPath();
    for (var x = 30; x <= 308; x += 3) {
      var y = 19 + 7 * Math.sin(x * 0.09 - spin * 2.4);
      if (x === 30) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();

    c.strokeStyle = "#F4BA1A";
    c.beginPath();
    for (var yy = 36; yy <= 250; yy += 3) {
      var xx = 17 + 7 * Math.sin(yy * 0.09 - spin * 2.4 + phase);
      if (yy === 36) c.moveTo(xx, yy); else c.lineTo(xx, yy);
    }
    c.stroke();

    figure(c, BANDS[mix.a].sig, phase, rgb, 1 - mix.w);
    if (mix.b !== mix.a) figure(c, BANDS[mix.b].sig, phase, rgb, mix.w);
  }

  function figure(c, sig, phase, rgb, alpha) {
    if (alpha < 0.02) return;
    var steps = 220 + sig[1] * 60;
    c.beginPath();
    for (var i = 0; i <= steps; i++) {
      var angle = (i / steps) * TAU;
      var x = 164 + 90 * Math.sin(sig[0] * angle + phase);
      var y = 140 + 90 * Math.sin(sig[1] * angle);
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.strokeStyle = rgba(rgb, 0.2 * alpha);
    c.lineWidth = 5;
    c.stroke();
    c.strokeStyle = rgba(rgb, alpha);
    c.lineWidth = 1.4;
    c.stroke();
  }

  /* Math Mode tab: a golden-angle seed head. Near a Fibonacci number its spiral
     arms are traced; on the Schumann resonance it pulses outward. */
  function drawMath(time, f, rgb) {
    var c = mathCtx;
    var spin = reduced ? 0 : time;
    var cx = 214;
    var cy = 122;
    var fibonacci = 1 - clamp01(Math.abs(f - 5) / 0.3);
    var schumann = 1 - clamp01(Math.abs(f - 7.83) / 0.2);
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, 428, 236);

    var points = [];
    for (var n = 1; n < 1250; n++) {
      var r = 6.4 * Math.sqrt(n);
      var angle = n * GOLDEN_ANGLE + spin * 0.1;
      var x = cx + r * Math.cos(angle);
      var y = cy + r * Math.sin(angle);
      points.push(x, y);
      if (y < -4 || y > 240) continue;
      var glow = 0.5 + 0.5 * Math.sin(r * 0.085 - spin * 1.5 - f * 0.8);
      c.fillStyle = rgba(rgb, 0.16 + 0.7 * glow);
      c.beginPath();
      c.arc(x, y, 0.9 + 1.25 * glow, 0, TAU);
      c.fill();
    }

    if (fibonacci > 0.02) {
      c.strokeStyle = rgba(rgb, 0.3 * fibonacci);
      c.lineWidth = 0.8;
      c.beginPath();
      for (var p = 0; p + 26 < points.length; p += 2) {
        c.moveTo(points[p], points[p + 1]);
        c.lineTo(points[p + 26], points[p + 27]); // 13 seeds on: a Fibonacci arm
      }
      c.stroke();
    }

    if (schumann > 0.02) {
      c.lineWidth = 1.4;
      for (var k = 0; k < 3; k++) {
        var grow = reduced ? (k + 1) / 3.5 : (spin * 0.32 + k / 3) % 1;
        c.strokeStyle = rgba([255, 255, 255], 0.55 * schumann * (1 - grow));
        c.beginPath();
        c.arc(cx, cy, 12 + grow * 190, 0, TAU);
        c.stroke();
      }
    }
  }

  /* Background tab: someone's music as bars, with the session tone riding over it. */
  function drawBackground(time, rgb) {
    var c = bgCtx;
    var spin = reduced ? 0 : time;
    var cy = 92;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, 428, 204);

    c.fillStyle = "rgba(255,255,255,0.15)";
    for (var x = 12; x < 418; x += 7) {
      var level = Math.abs(Math.sin(x * 0.071 + spin * 1.7) * Math.sin(x * 0.023 - spin * 0.9) + 0.4 * Math.sin(x * 0.19 + spin * 2.3));
      var bar = 5 + 40 * Math.min(1, level);
      c.fillRect(x, cy - bar, 4, bar * 2);
    }

    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    for (var px = 8; px <= 420; px += 3) {
      var py = cy + 30 * Math.sin(px * 0.05 - spin * 2.2) * (0.62 + 0.38 * Math.sin(px * 0.013 + spin * 0.5));
      if (px === 8) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.strokeStyle = rgba(rgb, 0.22);
    c.lineWidth = 7;
    c.stroke();
    c.strokeStyle = rgba(rgb, 1);
    c.lineWidth = 2;
    c.stroke();
  }

  /* AI tab: a slowly turning constellation. */
  var NODES = [];
  var LINKS = [];
  for (var n = 0; n < 38; n++) {
    var ny = 1 - (n / 37) * 2;
    var nr = Math.sqrt(1 - ny * ny);
    NODES.push([Math.cos(n * GOLDEN_ANGLE) * nr, ny, Math.sin(n * GOLDEN_ANGLE) * nr]);
  }
  for (var a = 0; a < NODES.length; a++) {
    for (var b = a + 1; b < NODES.length; b++) {
      var dx = NODES[a][0] - NODES[b][0];
      var dy = NODES[a][1] - NODES[b][1];
      var dz = NODES[a][2] - NODES[b][2];
      if (dx * dx + dy * dy + dz * dz < 0.36) LINKS.push([a, b]);
    }
  }

  function drawAi(time, rgb, energy) {
    var c = aiCtx;
    var turn = reduced ? 0.6 : time * 0.22;
    var cosT = Math.cos(turn);
    var sinT = Math.sin(turn);
    var cx = 230;
    var cy = 106;
    var radius = 84;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, 460, 240);

    var seen = NODES.map(function (node) {
      var x = node[0] * cosT + node[2] * sinT;
      var z = -node[0] * sinT + node[2] * cosT;
      var y = node[1] * 0.94 - z * 0.34;
      var depth = 0.5 + 0.5 * (z * 0.94 + node[1] * 0.34);
      return [cx + x * radius, cy + y * radius, depth];
    });

    c.lineWidth = 0.8;
    LINKS.forEach(function (link) {
      var from = seen[link[0]];
      var to = seen[link[1]];
      c.strokeStyle = rgba(rgb, 0.06 + 0.3 * Math.min(from[2], to[2]));
      c.beginPath();
      c.moveTo(from[0], from[1]);
      c.lineTo(to[0], to[1]);
      c.stroke();
    });

    seen.forEach(function (node, index) {
      var lit = index / NODES.length < energy;
      c.fillStyle = lit ? "rgba(255,255,255," + (0.5 + 0.5 * node[2]).toFixed(3) + ")" : rgba(rgb, 0.3 + 0.6 * node[2]);
      c.beginPath();
      c.arc(node[0], node[1], (lit ? 1.8 : 1.2) + 1.6 * node[2], 0, TAU);
      c.fill();
    });
  }

  /* ---------- The frame ---------- */

  var position = -1;   // smoothed place on the timeline
  var clock = 0;
  var tilt = { x: 0, y: 0, tx: 0, ty: 0 };

  function render(t, time) {
    var p = clamp01(t / INTRO);
    var arrive = smoother(p);
    var away = 1 - arrive;

    // The frequency on show: the hero's idle demo winds down to 0.10 Hz as the dial takes over.
    var f = frequencyAt(t);
    if (p < 1) f = Math.exp(lerp(Math.log(demoFrequency(time)), Math.log(F_MIN), arrive));

    var mix = blendAt(f);
    var band = BANDS[mix.i];
    var from = BANDS[mix.a].rgb;
    var to = BANDS[mix.b].rgb;
    var rgb = [Math.round(lerp(from[0], to[0], mix.w)), Math.round(lerp(from[1], to[1], mix.w)), Math.round(lerp(from[2], to[2], mix.w))];
    var tones = carriers(f);
    var q = Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN);
    var shown = hz(f);

    if (changed("band", rgb.join(" "))) stage.style.setProperty("--band", last.band);

    /* Hero, cue, tuner */
    var heroAlpha = 1 - smooth(p / 0.5);
    if (changed("hero", heroAlpha.toFixed(3))) {
      hero.style.opacity = last.hero;
      hero.style.visibility = heroAlpha > 0.01 ? "visible" : "hidden";
      hero.style.setProperty("--y", (-46 * (1 - heroAlpha)).toFixed(1) + "px");
    }
    var cueAlpha = 1 - smooth(p / 0.25);
    if (changed("cue", cueAlpha.toFixed(3))) {
      cue.style.opacity = last.cue;
      cue.style.visibility = cueAlpha > 0.01 ? "visible" : "hidden";
    }
    var tunerAlpha = smooth((p - 0.55) / 0.45);
    if (changed("tuner", tunerAlpha.toFixed(3))) {
      tuner.style.opacity = last.tuner;
      tuner.style.setProperty("--y", (30 * (1 - tunerAlpha)).toFixed(1) + "px");
    }

    // Exact difference on screen: round the left tone, then add the beat to get the right one.
    var places = f < 9.995 ? 2 : f < 99.95 ? 1 : 0;
    var leftShown = Number((tones.left).toFixed(places));
    var leftText = leftShown.toFixed(places);
    var rightText = (leftShown + Number(shown)).toFixed(places);
    var detent = "";
    for (var d = 0; d < DETENTS.length; d++) if (Math.abs(f - DETENTS[d][0]) < 0.005) detent = DETENTS[d][1];

    text("t-index", T.index, "BAND " + (band.i < 9 ? "0" : "") + (band.i + 1) + " / " + BANDS.length);
    text("t-greek", T.greek, band.greek);
    text("t-hz", T.hz, shown);
    text("t-name", T.name, band.name);
    text("t-range", T.range, detent || band.range);
    text("t-l", T.l, leftText);
    text("t-r", T.r, rightText);
    text("t-beat", T.beat, shown + " Hz");
    if (changed("wght", Math.round(lerp(240, 880, q)))) tuner.style.setProperty("--wght", last.wght);

    text("live-l", LIVE.l, leftText + "\u00a0Hz");
    text("live-r", LIVE.r, rightText + "\u00a0Hz");
    text("live-t", LIVE.t, shown + "\u00a0Hz");

    /* Captions */
    for (var i = 0; i < sceneList.length; i++) {
      var scene = sceneList[i];
      var enter = i === 0 ? smooth((t - (INTRO - 0.34)) / 0.3) : smooth((t - scene.start - 0.02) / 0.14);
      var leave = i === sceneList.length - 1 ? 0 : smooth((t - (scene.end - 0.16)) / 0.14);
      var alpha = Math.min(enter, 1 - leave);
      if (changed("scene" + i, alpha.toFixed(3) + "/" + enter.toFixed(3))) {
        scene.node.style.opacity = alpha.toFixed(3);
        scene.node.style.visibility = alpha > 0.01 ? "visible" : "hidden";
        scene.node.style.setProperty("--y", ((1 - enter) * 34 - leave * 34).toFixed(1) + "px");
      }
    }

    /* Phone: values on the Engines tab */
    text("k-l", K.l, String(Math.round(tones.left)));
    text("k-r", K.r, String(Math.round(tones.right)));
    text("k-t", K.t, f.toFixed(2));
    text("k-pill", K.pill, band.pill);
    text("k-hz", K.hz, (f < 99.95 ? f.toFixed(1) : String(Math.round(f))) + " Hz");
    if (changed("slider", (clamp01(0.326 + 0.248 * Math.log(f) / Math.LN10) * 100).toFixed(2))) ui.style.setProperty("--x", last.slider + "%");
    if (changed("row", band.i)) bandRows.forEach(function (row, index) { row.classList.toggle("on", index === band.i); });

    // How it works: left ear, right ear, then the difference.
    var sHow = progress("how", t);
    var teaching = within("how", t);
    flip("hl-l", K.l.parentNode, "hl", teaching && sHow >= 0.08 && sHow < 0.36);
    flip("hl-r", K.r.parentNode, "hl", teaching && sHow >= 0.36 && sHow < 0.64);
    flip("hl-t", K.t.parentNode, "hl", teaching && sHow >= 0.64);

    // On-device synthesis: the phone goes into flight mode and nothing changes.
    flip("offline", statusIcons, "is-offline", within("dsp", t) && progress("dsp", t) > 0.22);

    // Seven engines, one after another.
    var engineIndex = within("engines", t) ? Math.min(ENGINES.length - 1, Math.floor(progress("engines", t) * ENGINES.length)) : 0;
    if (changed("engine", engineIndex)) {
      var engine = ENGINES[engineIndex];
      K.eng.textContent = engine.name;
      K.engsub.textContent = engine.sub;
      chips.forEach(function (chip, index) { chip.classList.toggle("on", index === engine.chip); });
      engineRows.forEach(function (row, index) { row.classList.toggle("on", index === engineIndex); });
    }

    // Kinetic mode: the handset itself moves.
    var sKin = progress("kinetic", t);
    var rock = smooth((sKin - 0.05) / 0.15) * (1 - smooth((sKin - 0.85) / 0.15));
    var kineticOn = within("kinetic", t) && sKin > 0.1;
    flip("kin", K.kinwrap, "on", kineticOn);
    text("kin-text", K.kin, kineticOn ? "Kinetic ON" : "Kinetic OFF");

    // Parametric control: each dial in turn, then the stereo angle.
    var sPar = progress("param", t);
    var tuning = within("param", t);
    var driftL = 0.6 * smooth((sPar - 0.04) / 0.2);
    var driftR = 0.6 * smooth((sPar - 0.26) / 0.2);
    var volume = -6.9 + 3.9 * smooth((sPar - 0.48) / 0.2);
    var angle = 74 * smooth((sPar - 0.7) / 0.24);
    if (rock > 0) angle = rock * (reduced ? 40 : 40 + 32 * Math.sin(time * 1.3));
    text("k-dl", K.dl, driftL < 0.05 ? "0 Hz" : "+" + driftL.toFixed(1) + " Hz");
    text("k-dr", K.dr, driftR < 0.05 ? "0 Hz" : "-" + driftR.toFixed(1) + " Hz");
    text("k-vol", K.vol, volume.toFixed(1) + " dB");
    text("k-ang", K.ang, Math.round(angle) + "°");
    if (changed("angle", (angle / 360 * 240).toFixed(1))) ui.style.setProperty("--a", last.angle + "px");
    flip("hl-dl", K.dl.parentNode, "hl", tuning && sPar >= 0.04 && sPar < 0.26);
    flip("hl-dr", K.dr.parentNode, "hl", tuning && sPar >= 0.26 && sPar < 0.48);
    flip("hl-dv", K.vol.parentNode, "hl", tuning && sPar >= 0.48 && sPar < 0.7);
    flip("hl-an", K.ang.parentNode, "hl", tuning && sPar >= 0.7);

    /* Phone: the other three tabs */
    text("k-ml", K.ml, tones.left.toFixed(1));
    text("k-mr", K.mr, tones.right.toFixed(1));
    text("k-mt", K.mt, f.toFixed(2) + " Hz");
    flip("m-fib", mathRows.fib, "on", Math.abs(f - 5) < 0.02);
    flip("m-sch", mathRows.schumann, "on", Math.abs(f - 7.83) < 0.02);

    text("k-bsrc", K.bsrc, tones.left.toFixed(1));
    flip("b-on", playbackCard, "on", progress("music", t) >= 0.45);

    var sAi = progress("ai", t);
    var typed = PROMPT.slice(0, Math.round(PROMPT.length * clamp01((sAi - 0.08) / 0.4)));
    text("k-ai", K.aitext, typed);
    flip("ai-has", aiInput, "has-text", typed.length > 0);
    flip("ai-chip", aiChip, "on", sAi >= 0.5);
    var answer = smooth((sAi - 0.54) / 0.14);
    if (changed("answer", answer.toFixed(3))) {
      aiAnswer.style.opacity = last.answer;
      aiAnswer.style.transform = "translateY(" + ((1 - answer) * 26).toFixed(1) + "px)";
    }

    /* Phone: which tab is on screen. Each page slides in from the right, round and round. */
    var tabAt = tabPosition(t);
    var onScreen = [];
    for (var n = 0; n < pages.length; n++) {
      var offset = (((n - tabAt) % 4) + 4) % 4;
      if (offset > 2) offset -= 4;
      onScreen[n] = Math.abs(offset) < 1;
      if (changed("page" + n, onScreen[n] ? (offset * 460).toFixed(1) : "off")) {
        pages[n].style.visibility = onScreen[n] ? "visible" : "hidden";
        if (onScreen[n]) pages[n].style.transform = "translateX(" + last["page" + n] + "px)";
      }
    }
    var activeTab = Math.round(tabAt) % 4;
    if (changed("tab", activeTab)) {
      tabBar.style.setProperty("--tab", activeTab);
      tabs.forEach(function (tab, index) { tab.classList.toggle("on", index === activeTab); });
    }

    /* Phone: where it sits and how it is turned */
    var x = 0;
    var y = 0;
    var rx = 0;
    var ry = 0;
    var rz = 0;
    var scale = 1 + 0.05 * smooth(sPar / 0.15) * (1 - smooth((sPar - 0.85) / 0.15));
    if (G.wide) {
      x = G.heroX * away;
      ry = -24 * away;
      rx = 7 * away;
      rz = 2.5 * away;
    } else {
      y = G.heroY * away;
      scale += 0.2 * away;
    }
    if (rock > 0) {
      if (reduced) {
        ry += 14 * rock;
        rz += 4 * rock;
      } else {
        ry += Math.sin(time * 1.3) * 17 * rock;
        rx += Math.cos(time * 0.95) * 7 * rock;
        rz += Math.sin(time * 0.75 + 1) * 5 * rock;
      }
    }
    if (G.wide && !reduced) {
      ry += tilt.x * 5;
      rx -= tilt.y * 4;
    }
    var pose = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) rotateZ(" + rz.toFixed(2) + "deg) scale(" + scale.toFixed(4) + ")";
    if (changed("pose", pose)) device.style.transform = pose;

    /* Canvases */
    drawField(time, f, mix, smooth((p - 0.5) / 0.5));
    if (onScreen[0]) drawEngine(time, f, mix, rgb);
    if (onScreen[1]) drawMath(time, f, rgb);
    if (onScreen[2]) drawBackground(time, rgb);
    if (onScreen[3]) drawAi(time, rgb, clamp01((sAi - 0.08) / 0.4));

    if (changed("flag", p > 0.4 ? shown + " Hz · " + band.name : "")) chrome.flag(last.flag);
    return tones;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var time = now / 1000;
    var elapsed = clamp(time - clock, 0, 0.05);
    clock = time;

    var goal = clamp01((window.scrollY - G.top) / G.range) * TOTAL;
    if (position < 0 || reduced) position = goal;
    else {
      position += (goal - position) * (1 - Math.exp(-elapsed * 9));
      if (Math.abs(goal - position) < 0.0005) position = goal;
    }
    tilt.x += (tilt.tx - tilt.x) * 0.08;
    tilt.y += (tilt.ty - tilt.y) * 0.08;

    // Past the stage there is nothing to draw, and nothing to hear.
    var visible = window.scrollY < G.top + G.range + G.h;
    if (!visible) {
      if (changed("flag", "")) chrome.flag("");
      followAudio(null, false);
      return;
    }
    // With motion reduced nothing moves on its own, so a still frame can be skipped.
    if (reduced && !dirty && !changed("still", position)) return;
    dirty = false;
    followAudio(render(position, time), true);
  }

  /* ---------- Getting around ---------- */

  function go(y) {
    window.scrollTo({ top: Math.max(0, y), behavior: reduced ? "auto" : "smooth" });
  }

  function anchor(id) {
    if (!id || id === "top") return 0;
    if (id === "how") return scrollFor(INTRO + BANDS[0].span * 0.45);
    var target = document.getElementById(id);
    return target ? target.getBoundingClientRect().top + window.scrollY - 20 : null;
  }

  function closeMenu() {
    nav.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
    if (!link) {
      if (!nav.contains(event.target)) closeMenu();
      return;
    }
    var id = link.getAttribute("href").slice(1);
    var y = anchor(id);
    if (y === null) return;
    event.preventDefault();
    closeMenu();
    // The address changes before the scroll starts: rewriting it afterwards
    // can cut a smooth scroll short.
    history.replaceState(null, "", id && id !== "top" ? "#" + id : location.pathname + location.search);
    go(y);
  });

  menuButton.addEventListener("click", function () {
    var open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });

  soundButton.addEventListener("click", function () { setPlaying(!playing); });
  $("#ui-play").addEventListener("click", function () { setPlaying(!playing); });
  document.addEventListener("visibilitychange", function () { if (document.hidden && playing) setPlaying(false); });

  stage.addEventListener("pointermove", function (event) {
    if (event.pointerType === "touch") return;
    tilt.tx = (event.clientX / window.innerWidth - 0.5) * 2;
    tilt.ty = (event.clientY / window.innerHeight - 0.5) * 2;
  });

  /* ---------- Start ---------- */

  window.addEventListener("resize", layout);
  window.addEventListener("load", layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  layout();
  if (location.hash) {
    var landing = anchor(location.hash.slice(1));
    if (landing !== null) window.scrollTo(0, landing);
  }
  requestAnimationFrame(frame);
})();
