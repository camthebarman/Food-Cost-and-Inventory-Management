/* theme.js — dark mode toggle. Loaded in <head> so the stored preference
   applies before first paint (no flash of the wrong theme). */
(function () {
  var KEY = "noneLeftOnPlate.theme";

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function getStored() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  // The theme actually in effect right now: an explicit user choice if one is
  // stored, otherwise whatever the OS/browser prefers.
  function effective() {
    var stored = getStored();
    if (stored === "dark" || stored === "light") return stored;
    return systemPrefersDark() ? "dark" : "light";
  }

  function apply(theme) {
    if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.setAttribute("data-theme", "light");
  }

  function set(theme) {
    try {
      localStorage.setItem(KEY, theme);
    } catch (e) {}
    apply(theme);
  }

  function toggle() {
    var next = effective() === "dark" ? "light" : "dark";
    set(next);
    return next;
  }

  // Apply immediately so the page never flashes the wrong theme.
  apply(effective());

  window.Theme = { effective: effective, set: set, toggle: toggle };
})();
