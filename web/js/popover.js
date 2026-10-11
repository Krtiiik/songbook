// Toggled boxes (version, transpose, zoom, chords, tuner) ----------------------------
// A button toggles its box; clicking anywhere else or pressing Escape closes it.
// A box with the `slide` class animates out too: it keeps showing (as `.closing`) for
// SLIDE_OUT_MS before it is hidden. Opening needs no help, the CSS animation restarts
// whenever the box stops being `display: none`.

const SLIDE_OUT_MS = 140; // keep in step with `slide-up` in base.css

const popovers = [];

export function popover(button, box, { onOpen = () => {}, onClose = () => {} } = {}) {
    let hideTimer = null;

    const instance = {
        isOpen: () => !box.classList.contains("hidden") && hideTimer === null,
        open() {
            if (instance.isOpen()) return;
            closeAll(instance);
            clearTimeout(hideTimer);
            hideTimer = null;
            box.classList.remove("hidden", "closing");
            button.classList.add("open");
            button.setAttribute("aria-expanded", "true");
            onOpen();
        },
        close() {
            if (!instance.isOpen()) return;
            button.classList.remove("open");
            button.setAttribute("aria-expanded", "false");

            const hide = () => {
                hideTimer = null;
                box.classList.add("hidden");
                box.classList.remove("closing");
                onClose();
            };
            const animate = box.classList.contains("slide")
                && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (animate) {
                box.classList.add("closing");
                hideTimer = setTimeout(hide, SLIDE_OUT_MS);
            } else {
                hide();
            }
        },
        toggle: () => (instance.isOpen() ? instance.close() : instance.open()),
        contains: (target) => box.contains(target) || button.contains(target),
    };

    button.addEventListener("click", instance.toggle);
    popovers.push(instance);
    return instance;
}

export function closeAll(except = null) {
    popovers.filter((p) => p !== except).forEach((p) => p.close());
}

document.addEventListener("click", (event) => {
    popovers.filter((p) => !p.contains(event.target)).forEach((p) => p.close());
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAll();
});
