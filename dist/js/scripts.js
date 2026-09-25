// Close the mobile menu after a nav link is clicked.
// Scrollspy and smooth scrolling are handled by Bootstrap and CSS.
const navbarCollapse = document.querySelector("#navbarSupportedContent");
const collapse = bootstrap.Collapse.getOrCreateInstance(navbarCollapse, {
  toggle: false,
});

document.querySelectorAll("#sideNav .nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    if (navbarCollapse.classList.contains("show")) collapse.hide();
  });
});
