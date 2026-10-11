// Settings menu ----------------------------------------------------------------
// A modal opened from the gear in either top bar. It opens on a list of settings; a
// setting with more to it (the tuner) is a page of its own, reached from the list and
// left with the back arrow in the title bar. Closing the modal always returns to the list.

import { onRouteChange } from "./router.js";
import * as settings from "./settings.js";

/** `tuner` is what setupTuner() returns: the microphone runs only while the tuner page is shown. */
export function setupSettingsMenu({ tuner }) {
    const dialog = document.getElementById("settings-dialog");
    const title = document.getElementById("settings-title");
    const back = document.getElementById("settings-back");

    const pages = {
        root: { element: document.getElementById("settings-root"), title: "Nastavení" },
        tuner: { element: document.getElementById("settings-tuner"), title: "Ladička" },
    };

    function show(name) {
        for (const [pageName, page] of Object.entries(pages)) {
            page.element.classList.toggle("hidden", pageName !== name);
        }
        title.textContent = pages[name].title;
        back.classList.toggle("hidden", name === "root");
        if (name === "tuner") tuner.start();
        else tuner.stop();
    }
    document.getElementById("open-tuner").addEventListener("click", () => show("tuner"));

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
    // The `close` event comes a task later (and not at all in a hidden page), so the microphone
    // is released here; Escape, which closes the dialog by itself, is covered by the event.
    function close() {
        dialog.close();
        tuner.stop();
    }
    back.addEventListener("click", () => show("root"));
    document.getElementById("settings-close").addEventListener("click", close);
    // Only the backdrop is the dialog itself; everything inside sits in .dialog-body
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) close();
    });
    dialog.addEventListener("close", () => tuner.stop());
    // Back and forward buttons change the page behind the modal
    onRouteChange(close);
}
