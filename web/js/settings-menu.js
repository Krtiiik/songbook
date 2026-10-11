// Settings menu ----------------------------------------------------------------
// A modal opened from the gear in either top bar. It opens on a list of settings; a
// setting with more to it (the tuner) is a page of its own, reached from the list and
// left with the back arrow in the title bar. Closing the modal always returns to the list.

import { onRouteChange } from "./router.js";
import * as settings from "./settings.js";

export function setupSettingsMenu() {
    const dialog = document.getElementById("settings-dialog");
    const title = document.getElementById("settings-title");
    const back = document.getElementById("settings-back");

    const pages = {
        root: { element: document.getElementById("settings-root"), title: "Nastavení" },
    };

    function show(name) {
        for (const [pageName, page] of Object.entries(pages)) {
            page.element.classList.toggle("hidden", pageName !== name);
        }
        title.textContent = pages[name].title;
        back.classList.toggle("hidden", name === "root");
    }

    // Theme choice
    const choices = document.querySelectorAll("#theme-choice .segment");
    function showTheme() {
        for (const choice of choices) {
            choice.setAttribute("aria-pressed", String(choice.dataset.choice === settings.getTheme()));
        }
    }
    for (const choice of choices) {
        choice.addEventListener("click", () => {
            settings.setTheme(choice.dataset.choice);
            showTheme();
        });
    }

    // Opening and closing
    for (const button of document.querySelectorAll(".settings-toggle")) {
        button.addEventListener("click", () => {
            if (dialog.open) return;
            show("root");
            showTheme();
            dialog.showModal();
        });
    }
    back.addEventListener("click", () => show("root"));
    document.getElementById("settings-close").addEventListener("click", () => dialog.close());
    // Only the backdrop is the dialog itself; everything inside sits in .dialog-body
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
    });
    // Back and forward buttons change the page behind the modal
    onRouteChange(() => dialog.close());
}
