window.MathJax = {
  tex: {
    inlineMath: [["\\(", "\\)"]],
    displayMath: [["\\[", "\\]"]],
    processEscapes: true,
    processEnvironments: true
  },
  options: {
    ignoreHtmlClass: ".*|",
    processHtmlClass: "arithmatex"
  }
};

document$.subscribe(() => {
  if (!window.MathJax.startup || !window.MathJax.startup.promise) return;
  window.MathJax.startup.promise.then(() => {
    window.MathJax.typesetClear();
    window.MathJax.texReset();
    return window.MathJax.typesetPromise();
  });
});
