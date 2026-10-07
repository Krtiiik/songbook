// URL routing --------------------------------------------------------------------
// The URL hash is the single source of truth for what is shown:
//   #               song list
//   #<song>         a song in its remembered/default version
//   #<song>/<ver>   a song in a given version
// Every navigation only changes the hash; the hashchange handler renders.

export function currentRoute() {
    const [songId, versionId] = decodeURIComponent(location.hash.slice(1)).split("/");
    return { songId: songId || null, versionId: versionId || null };
}

export function songHref(songId, versionId = null) {
    return "#" + encodeURIComponent(songId) + (versionId ? "/" + encodeURIComponent(versionId) : "");
}

/** Go to a song. With `replace`, the browser's back button skips this step (used for seeking and versions). */
export function goToSong(songId, versionId = null, { replace = false } = {}) {
    const href = songHref(songId, versionId);
    if (replace) {
        location.replace(href);
    } else {
        location.hash = href;
    }
}

export function goToIndex() {
    location.hash = "";
}

export function onRouteChange(handler) {
    window.addEventListener("hashchange", () => handler(currentRoute()));
}
