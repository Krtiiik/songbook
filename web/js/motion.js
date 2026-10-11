// Motion -----------------------------------------------------------------------
// A short fade-and-rise (the `.enter` animation in base.css, switched off there for
// readers who prefer reduced motion) when a view or another song appears.

export function replayEnter(...elements) {
    for (const element of elements) {
        element.classList.remove("enter");
        void element.offsetWidth; // restart the animation if it is already running
        element.classList.add("enter");
    }
}
