// Version switcher logic -------------------------------------------------------------
// DOM-free parts of the version button: which letter a source gets and how the circles stack.

/** The letter shown in a source's circle: the first letter of its label ("Krtek" -> "K"). */
export function sourceInitial(label) {
    const letter = [...(label ?? "").trim()][0];
    return letter ? letter.toUpperCase() : "?";
}

/**
 * Version ids from the front of the stack to the back: the current one first, then the
 * others in list order, wrapping around, so the circle behind is the one a click on
 * the button would most naturally reveal next.
 */
export function stackOrder(ids, currentId) {
    const start = Math.max(0, ids.indexOf(currentId));
    return [...ids.slice(start), ...ids.slice(0, start)];
}
