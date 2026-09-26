document.querySelectorAll('.current-year').forEach(element => {
  element.textContent = new Date().getFullYear();
});
