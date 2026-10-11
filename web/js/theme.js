// Theme choice -----------------------------------------------------------------
// The reader picks "light", "dark" or "system" (follow the device). The page itself
// only ever shows light or dark, so the choice is resolved against the device setting.

export const THEME_CHOICES = ["light", "dark", "system"];

/** A stored value as a valid choice; anything unknown (or nothing stored yet) means "system". */
export function parseThemeChoice(stored) {
    return THEME_CHOICES.includes(stored) ? stored : "system";
}

/** The theme to draw for a choice, given whether the device prefers dark. */
export function resolveTheme(choice, systemPrefersDark) {
    if (choice === "light" || choice === "dark") return choice;
    return systemPrefersDark ? "dark" : "light";
}
