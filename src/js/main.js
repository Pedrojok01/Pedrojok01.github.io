const nav = document.getElementById("nav");
const hero = document.getElementById("top");
const menuButton = document.getElementById("menu-button");

// Nav turns solid once the hero is scrolled past. The hero height comes from a
// ResizeObserver, so neither page load nor scrolling forces a layout.
let heroHeight = Infinity;
const updateNav = () =>
  nav.classList.toggle("is-solid", window.scrollY > heroHeight - 80);
new ResizeObserver(([entry]) => {
  heroHeight = entry.borderBoxSize[0].blockSize;
  updateNav();
}).observe(hero);
window.addEventListener("scroll", updateNav, { passive: true });

// Theme toggle: follows the system until the visitor picks one, then remembers it.
const themeButton = document.getElementById("theme-button");
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
const currentTheme = () =>
  document.documentElement.dataset.theme ??
  (systemDark.matches ? "dark" : "light");
const labelThemeButton = () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  themeButton.setAttribute("aria-label", `Switch to ${next} theme`);
};
themeButton.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {
    // Storage blocked: the choice lasts for this page view only.
  }
  labelThemeButton();
});
systemDark.addEventListener("change", labelThemeButton);
labelThemeButton();

// Mobile menu
const setMenu = (open) => {
  nav.classList.toggle("is-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
};
menuButton.addEventListener("click", () =>
  setMenu(!nav.classList.contains("is-open")),
);
nav
  .querySelectorAll(".nav-links a")
  .forEach((link) => link.addEventListener("click", () => setMenu(false)));

// Highlight the nav link of the section in the middle of the screen.
const links = new Map(
  [...nav.querySelectorAll(".nav-links a")].map((a) => [a.hash.slice(1), a]),
);
const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => link.classList.remove("is-active"));
      links.get(entry.target.id)?.classList.add("is-active");
    });
  },
  { rootMargin: "-45% 0px -50% 0px" },
);
links.forEach((_, id) => {
  const section = document.getElementById(id);
  if (section) sectionObserver.observe(section);
});

// Copy the email address; fall back to selecting it.
document.querySelectorAll("[data-copy]").forEach((button) => {
  const status = button.parentElement.querySelector(".copy-status");
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      status.textContent = "Copied";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(button.querySelector(".email-text"));
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      status.textContent = "Selected";
    }
    setTimeout(() => (status.textContent = ""), 1800);
  });
});

// Load the 3D hero once the page is idle, unless the visitor asked to save data.
const saveData = navigator.connection?.saveData;
if (!saveData) {
  const loadScene = () =>
    import("./scene.js")
      .then(({ start }) => start(hero))
      .catch((error) => console.warn("3D hero unavailable:", error));
  if ("requestIdleCallback" in window)
    requestIdleCallback(loadScene, { timeout: 1500 });
  else setTimeout(loadScene, 300);
}
