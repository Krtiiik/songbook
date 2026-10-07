// Toggled boxes (transpose, zoom, chords, tuner) -------------------------------
// A button toggles its box; clicking anywhere else or pressing Escape closes it.

const popovers = [];

export function popover(button, box, { onOpen = () => {}, onClose = () => {} } = {}) {
    const instance = {
        isOpen: () => !box.classList.contains("hidden"),
        open() {
            if (instance.isOpen()) return;
            closeAll(instance);
            box.classList.remove("hidden");
            onOpen();
        },
        close() {
            if (!instance.isOpen()) return;
            box.classList.add("hidden");
            onClose();
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
