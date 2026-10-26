// Runs before the stylesheets paint: applies a manual Light or Dark choice
// remembered from the last visit, so the page does not flash the other theme.
// System needs nothing here; the stylesheets follow the computer on their own.
(function () {
  try {
    var theme = localStorage.getItem('argusTheme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.dataset.theme = theme;
    }
  } catch (error) {
    // No stored choice available; System applies
  }
})();
