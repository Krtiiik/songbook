// Motion -----------------------------------------------------------------------
// A short fade-and-rise (the `.enter` animation in base.css, switched off there for
// readers who prefer reduced motion) when a view or another song appears, and the
// moves of a song that follows the finger when it is swiped away.

export function replayEnter(...elements) {
    for (const element of elements) {
        element.classList.remove("enter");
        void element.offsetWidth; // restart the animation if it is already running
        element.classList.add("enter");
    }
}

// Following a swipe ----------------------------------------------------------------------
// The element's inline style is its resting place during a swipe. Each move sets the style
// to where it ends up and animates from where it was, so a cancelled animation leaves it right.

const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Put the element `x` px from its place, fading the further it goes; no animation, it tracks the finger. */
export function dragTo(element, x, width) {
    element.getAnimations().forEach((animation) => animation.cancel());
    element.style.transform = `translateX(${x}px)`;
    element.style.opacity = String(1 - 0.6 * Math.min(Math.abs(x) / width, 1));
}

/** Back in its place, with no inline style left. */
export function clearDrag(element) {
    element.getAnimations().forEach((animation) => animation.cancel());
    element.style.transform = "";
    element.style.opacity = "";
}

async function glide(element, to, duration, easing) {
    const from = { transform: element.style.transform || "none", opacity: element.style.opacity || "1" };
    element.style.transform = to.transform;
    element.style.opacity = to.opacity;
    duration = prefersReducedMotion() ? 0 : duration;
    const animation = element.animate([from, to], { duration, easing });
    // Not waiting for the animation alone: a hidden page draws no frames, and a swipe must still go through
    await Promise.race([animation.finished, new Promise((resolve) => setTimeout(resolve, duration + 100))])
        .catch(() => {}); // cancelled by a newer move
}

/** A released drag that is not a swipe: settle back into place. */
export async function springBack(element) {
    await glide(element, { transform: "translateX(0px)", opacity: "1" }, 220, "cubic-bezier(0.22, 1, 0.36, 1)");
    clearDrag(element);
}

/** A swipe: carry the element on out of sight, `x` px away. It stays out of sight until `slideIn`. */
export function flingOut(element, x) {
    return glide(element, { transform: `translateX(${x}px)`, opacity: "0" }, 160, "ease-in");
}

/** The next song arrives from `fromX` px away, the side the previous one left towards. */
export async function slideIn(element, fromX) {
    element.getAnimations().forEach((animation) => animation.cancel());
    element.style.transform = `translateX(${fromX}px)`;
    element.style.opacity = "0";
    await glide(element, { transform: "translateX(0px)", opacity: "1" }, 260, "cubic-bezier(0.22, 1, 0.36, 1)");
    clearDrag(element);
}
