// Static pages: pulls in the site styles (Vite bundles them) and keeps the footer year current.
import "./styles.css";

const year = document.querySelector("[data-year]");
if (year) year.textContent = String(new Date().getFullYear());
