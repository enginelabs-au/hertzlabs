/* The two blue rails every page shares.
   Top rail: progress only. It fills from the left edge and reaches the right
   edge at the end of the page (no pointer events, not selectable).
   Right rail: the page's scrollbar; drag the thumb or press the track. */
(function () {
  "use strict";

  var MIN_THUMB = 48;
  var root = document.documentElement;
  var rail, railFill, vbar, vThumb, flag;
  var ticks = [];
  var tickKey = "";
  var drag = null;
  var queued = false;

  function make(tag, id, parent) {
    var node = document.createElement(tag);
    if (id) node.id = id;
    parent.appendChild(node);
    return node;
  }

  function maxScroll() {
    return Math.max(0, root.scrollHeight - window.innerHeight);
  }

  function geometry() {
    var max = maxScroll();
    var visible = root.scrollHeight ? Math.min(1, window.innerHeight / root.scrollHeight) : 1;
    var track = vbar.clientHeight;
    var size = Math.min(track, Math.max(MIN_THUMB, track * visible));
    return {
      max: max,
      progress: max ? Math.min(1, Math.max(0, window.scrollY / max)) : 0,
      track: track,
      size: size,
      travel: Math.max(0, track - size)
    };
  }

  function placeTicks(g) {
    var key = g.track + ":" + g.size + ":" + ticks.length;
    if (key === tickKey) return;
    tickKey = key;
    ticks.forEach(function (tick) {
      // The edge of the top fill meets a mark exactly when the page reaches it.
      tick.h.style.left = (tick.at * 100) + "%";
      tick.v.style.top = (tick.at * g.travel + g.size / 2) + "px";
    });
  }

  function paint() {
    queued = false;
    var g = geometry();
    // A page with nothing to scroll is already complete, so its rail is full.
    railFill.style.transform = "scaleX(" + (g.max ? g.progress : 1) + ")";
    vThumb.style.height = g.size + "px";
    vThumb.style.transform = "translateY(" + (g.progress * g.travel) + "px)";
    vbar.setAttribute("aria-valuenow", String(Math.round(g.progress * 100)));
    flag.style.transform = "translateY(" + (vbar.offsetTop + g.progress * g.travel + g.size / 2) + "px) translateY(-50%)";
    placeTicks(g);
  }

  function request() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(paint);
  }

  function scrollToPointer(event) {
    var g = geometry();
    if (!g.travel) return;
    var top = event.clientY - vbar.getBoundingClientRect().top - drag.grab;
    window.scrollTo(0, Math.min(1, Math.max(0, top / g.travel)) * g.max);
  }

  function onDown(event) {
    if (event.button) return;
    event.preventDefault();
    var g = geometry();
    var thumbTop = g.progress * g.travel;
    var y = event.clientY - vbar.getBoundingClientRect().top;
    // Pressing the track centres the thumb on the pointer; pressing the thumb keeps its grab point.
    drag = { grab: event.target === vThumb ? y - thumbTop : g.size / 2 };
    // Capture keeps the drag alive when the pointer leaves the rail. It can be
    // refused (the pointer is already gone), and the press still scrolls.
    try { vbar.setPointerCapture(event.pointerId); } catch (error) { /* not captured */ }
    vbar.classList.add("is-dragging");
    scrollToPointer(event);
  }

  function onMove(event) {
    if (!drag) return;
    // A release that happened off the rail without capture never reaches us;
    // a move with no button held is the sign of it.
    if (!event.buttons) { onUp(); return; }
    scrollToPointer(event);
  }

  function onUp() {
    drag = null;
    vbar.classList.remove("is-dragging");
  }

  function build() {
    if (document.getElementById("hz-rail")) return;
    rail = make("div", "hz-rail", document.body);
    rail.setAttribute("aria-hidden", "true");
    railFill = make("i", "", rail);

    vbar = make("div", "hz-vbar", document.body);
    vbar.setAttribute("role", "scrollbar");
    vbar.setAttribute("aria-label", "Page scroll");
    vbar.setAttribute("aria-orientation", "vertical");
    vbar.setAttribute("aria-valuemin", "0");
    vbar.setAttribute("aria-valuemax", "100");
    vThumb = make("i", "", vbar);

    flag = make("div", "hz-vflag", document.body);
    flag.setAttribute("aria-hidden", "true");

    vbar.addEventListener("pointerdown", onDown);
    vbar.addEventListener("pointermove", onMove);
    vbar.addEventListener("pointerup", onUp);
    vbar.addEventListener("pointercancel", onUp);
    vbar.addEventListener("lostpointercapture", onUp);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    if (window.ResizeObserver) new ResizeObserver(request).observe(document.body);
    paint();
  }

  window.HzChrome = {
    refresh: request,
    /* Text shown beside the vertical thumb; pass "" to hide it. */
    flag: function (text) {
      if (!flag) return;
      if (flag.textContent !== text) flag.textContent = text;
      flag.classList.toggle("is-on", !!text);
    },
    /* Marks on both rails. list: [{ at: 0..1 of the page scroll, rgb: "r g b" }] */
    ticks: function (list) {
      if (!rail) return;
      ticks.forEach(function (tick) { tick.h.remove(); tick.v.remove(); });
      ticks = list.map(function (item) {
        var h = make("b", "", rail);
        var v = make("b", "", vbar);
        h.style.setProperty("--c", item.rgb);
        v.style.setProperty("--c", item.rgb);
        return { at: item.at, h: h, v: v };
      });
      tickKey = "";
      request();
    }
  };

  if (document.body) build();
  else document.addEventListener("DOMContentLoaded", build);
})();
