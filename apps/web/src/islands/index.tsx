/** @jsxImportSource react */
import { hydrateRoot } from "react-dom/client";
import { SearchForm } from "./SearchForm";
import { ThemeToggle } from "./ThemeToggle";

// Hydrate SearchForm
const searchFormEl = document.getElementById("search-form-island");
if (searchFormEl) {
  const initialQuery = searchFormEl.dataset.initialQuery || "";
  hydrateRoot(
    searchFormEl,
    <SearchForm initialQuery={initialQuery} />
  );
}

// Hydrate ThemeToggle
const themeToggleEl = document.getElementById("theme-toggle-island");
if (themeToggleEl) {
  hydrateRoot(themeToggleEl, <ThemeToggle />);
}
