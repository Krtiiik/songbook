// Swipe gestures ---------------------------------------------------------------------
// The decisions behind swiping between songs, kept apart from the touch events so they can
// be tested: which way a drag is going and whether letting go counts as a swipe.

const LOCK_DISTANCE = 10; // px a finger must travel before the drag is taken for a direction
const COMMIT_DISTANCE = 100; // px: a drag this long is a swipe, however slow
const COMMIT_FRACTION = 1 / 3; // of the width, on screens narrower than three times the distance above
const FLICK_DISTANCE = 30; // px: a shorter drag still counts when it is fast enough
const FLICK_SPEED = 0.4; // px per ms

/** "x" or "y" once the finger has moved far enough to tell, otherwise null. Vertical drags belong to scrolling. */
export function lockAxis(dx, dy) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_DISTANCE) return null;
    return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}

/** Whether letting go after dragging `dx` px in `duration` ms should change the song. */
export function isSwipe(dx, duration, width) {
    const distance = Math.abs(dx);
    if (distance >= Math.min(COMMIT_DISTANCE, width * COMMIT_FRACTION)) return true;
    return distance >= FLICK_DISTANCE && distance / Math.max(duration, 1) >= FLICK_SPEED;
}

/** How far the song may sit from its place for a finger offset: it follows 1:1 and is never dragged off screen. */
export function dragOffset(dx, width) {
    return Math.max(-width, Math.min(width, dx));
}
