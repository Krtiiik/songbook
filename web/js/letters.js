// Letter sections of the song list --------------------------------------------------
// The build sorts songs in Czech order (č ř š ž and ch are letters of their own), so
// consecutive songs with the same first letter form a section. "Ch" gets its own
// section because the sort puts it after H, not under C.

const CZECH_LETTERS = new Set(["Č", "Ř", "Š", "Ž"]);

/** Section letter of a title: "A".."Z", "Č", "Ř", "Š", "Ž", "Ch", or "#" for digits and symbols. */
export function letterOf(title) {
    const text = title.normalize("NFC");
    const first = [...text].find((ch) => /[\p{L}\p{N}]/u.test(ch));
    if (!first) return "#";

    const upper = first.toUpperCase();
    if (CZECH_LETTERS.has(upper)) return upper;
    if (upper === "C" && /^[^\p{L}\p{N}]*ch/iu.test(text)) return "Ch";

    const plain = upper.normalize("NFD").replace(/\p{M}/gu, "");
    return /^[A-Z]$/.test(plain) ? plain : "#";
}

/** Splits songs (already sorted) into runs of the same letter: [{ letter, songs }]. */
export function groupByLetter(songs) {
    const groups = [];
    for (const song of songs) {
        const letter = letterOf(song.title);
        const last = groups.at(-1);
        if (last?.letter === letter) {
            last.songs.push(song);
        } else {
            groups.push({ letter, songs: [song] });
        }
    }
    return groups;
}
