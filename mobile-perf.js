// Render-resolution cap, driven ONLY by a ?dpr= URL parameter.
// The HOST APP decides the value and appends it when launching the game.
// Must run before the engine sizes its canvas (loaded from <head>).
(function () {
  try {
    var m = (location.search || "").match(/[?&]dpr=(-?[0-9.]+)/)
    if (!m) return;             // no param -> native DPR
    var cap = parseFloat(m[1])
    if (!(cap > 0)) return;     // ?dpr=0 (or invalid) -> explicit no cap
    var real = window.devicePixelRatio || 1
    if (real > cap) {
      Object.defineProperty(window, "devicePixelRatio", {
        configurable: true,
        get: function () { return cap; },
        set: function () {}     // tolerate engine assignments
      })
      console.log("[mobile-perf] DPR " + real + " -> " + cap)
    }
  } catch (e) {}
})()
