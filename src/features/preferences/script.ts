export const PREFERENCES_SCRIPT = `(function () {
  var COOKIE = "taskly_prefs";
  var THEMES = { light: 1, dark: 1, system: 1 };
  var DENSITIES = { cozy: 1, compact: 1 };

  function read() {
    var match = document.cookie.match(new RegExp("(?:^|; )\\\\b" + COOKIE + "=([^;]*)"));
    if (!match) return {};
    try {
      return JSON.parse(decodeURIComponent(match[1])) || {};
    } catch (e) {
      return {};
    }
  }

  function write(next) {
    var attributes = [
      COOKIE + "=" + encodeURIComponent(JSON.stringify(next)),
      "path=/",
      "max-age=31536000",
      "samesite=lax",
    ];
    if (location.protocol === "https:") attributes.push("secure");
    document.cookie = attributes.join("; ");
  }

  function media() {
    return window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  }

  function schemeFor(theme) {
    if (theme === "light" || theme === "dark") return theme;
    var query = media();
    return query && query.matches ? "dark" : "light";
  }

  try {
    var stored = read();
    var theme = THEMES[stored.theme] ? stored.theme : "system";
    var density = DENSITIES[stored.density] ? stored.density : "cozy";
    var root = document.documentElement;

    function apply(scheme) {
      root.classList.toggle("dark", scheme === "dark");
      root.dataset.density = density;
    }

    apply(schemeFor(theme));

    var query = media();
    if (query && theme === "system") {
      var onChange = function () { apply(schemeFor(theme)); };
      if (query.addEventListener) query.addEventListener("change", onChange);
      else if (query.addListener) query.addListener(onChange);
    }

    var zone = null;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (e) {
      zone = null;
    }

    if (stored.theme !== theme || stored.density !== density || stored.timeZone !== zone) {
      write({ theme: theme, density: density, timeZone: zone });
    }
  } catch (e) {
    /* A broken preference must never block rendering. */
  }
})();`;