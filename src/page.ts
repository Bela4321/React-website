// Static pages: pulls in the site styles (Vite bundles them) and marks the
// header link of the section in view.
import "./styles.css";

const links = new Map(
  [...document.querySelectorAll<HTMLAnchorElement>("[data-nav]")].map((a) => [a.dataset.nav!, a]),
);
const sections = [...links.keys()].map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);

if (sections.length) {
  const visible = new Set<string>();
  const mark = () => {
    // the topmost section in view wins
    const current = sections.find((s) => visible.has(s.id))?.id;
    for (const [id, a] of links) {
      if (id === current) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id);
      mark();
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  sections.forEach((s) => io.observe(s));
}

const year = document.querySelector("[data-year]");
if (year) year.textContent = String(new Date().getFullYear());
