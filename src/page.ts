// Static pages: pulls in the site styles (Vite bundles them) and keeps the footer year current.
import "./styles.css";

const year = document.querySelector("[data-year]");
if (year) year.textContent = String(new Date().getFullYear());

// when "That's me." comes into view, the email button in the header answers once
const closing = document.querySelector("[data-closing]");
const email = document.querySelector<HTMLElement>("[data-email]");
if (closing && email && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      email.classList.add("is-answering");
      email.addEventListener("animationend", () => email.classList.remove("is-answering"), { once: true });
      io.disconnect();
    },
    { threshold: 0.6 },
  );
  io.observe(closing);
}
