"""Scrape Bratrův zpěvník (LaTeX source) into ChordPro files.

Macro semantics follow the upstream web app's parser:
https://github.com/martisekpetr/bratruv-zpevnik/blob/master/app/src/helpers/parseTex.js
"""

import argparse
from pathlib import Path
import re
import shutil
import urllib.request


BRATR_URL = "https://raw.githubusercontent.com/martisekpetr/bratruv-zpevnik/master/zpevnik.tex"


parser = argparse.ArgumentParser(description="Scrape the Bratr songbook")
parser.add_argument("--output", default=Path(".cache") / "sources" / "bratr", type=Path, help="Output directory for scraped songs")


def sanitize_filename(value: str) -> str:
    value = re.sub(r'[<>:"/\\|?*]+', " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value or "untitled"


# Reading TeX ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

def strip_comments(tex: str) -> str:
    """Remove % comments (but not \\%). Like TeX, a comment also swallows the line break and the next line's indent."""
    return re.sub(r"(?<!\\)%[^\n]*\n?[ \t]*", "", tex)


def read_delimited(text: str, start: int, open_char: str, close_char: str) -> tuple[str, int]:
    """Read a balanced block starting at the opening char at `start`. Returns (inner text, index after block)."""
    depth = 0
    i = start
    while i < len(text):
        ch = text[i]
        if ch == "\\":
            i += 2  # skip escaped chars such as \{ or \}
            continue
        if ch == open_char:
            depth += 1
        elif ch == close_char:
            depth -= 1
            if depth == 0:
                return text[start + 1:i], i + 1
        i += 1
    raise ValueError(f"Unterminated {open_char}{close_char} block at {start}")


def skip_spaces(text: str, i: int) -> int:
    """Skip spaces, allowing at most one line break (a blank line ends macro arguments in TeX)."""
    newline_seen = False
    while i < len(text) and text[i] in " \t\n":
        if text[i] == "\n":
            if newline_seen:
                break
            newline_seen = True
        i += 1
    return i


def read_group(text: str, i: int) -> tuple[str | None, int]:
    """Read a {group} argument, if one follows."""
    j = skip_spaces(text, i)
    if j < len(text) and text[j] == "{":
        return read_delimited(text, j, "{", "}")
    return None, i


def read_optional(text: str, i: int) -> tuple[str | None, int]:
    """Read an [optional] argument, if one follows directly."""
    if i < len(text) and text[i] == "[":
        return read_delimited(text, i, "[", "]")
    return None, i


def read_groups(text: str, i: int, count: int) -> tuple[list[str], int]:
    groups = []
    for _ in range(count):
        group, i = read_group(text, i)
        groups.append(group or "")
    return groups, i


DIMENSION = re.compile(r"\s*=?\s*-?\d*\.?\d+\s*(?:pt|em|ex|mm|cm|in|bp|sp|px)?")


def skip_dimension(text: str, i: int) -> int:
    match = DIMENSION.match(text, i)
    return match.end() if match else i


# Converting to ChordPro ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

# Chord macros from gtrcrd: root, optional s(harp)/b(flat), optional m(inor). Czech H is English B.
CHORD_MACRO = re.compile(r"(?P<root>[A-H])(?P<accidental>[sb]?)(?P<minor>m?)")

SYMBOLS = {
    "ldots": "...", "dots": "...", "ldotp": ".",
    "times": "×", "sharp": "#", "flat": "b", "downarrow": "↓",
    "textendash": "–", "textemdash": "—", "quad": " ", "qquad": " ",
    "rpt": " :|", "revrpt": "|: ", "hfill": " ",
}

# Commands dropped together with this many {group} arguments (after an optional [..] argument)
DROPPED = {
    "noexport": 1,  # print-only content
    "toftagthis": 1, "includegraphics": 1, "linespread": 1, "hspace": 1, "vspace": 1,
    "fontsize": 2, "setlength": 2, "rule": 2, "raisebox": 1,
    "chord": 3,  # gchords diagram
}

# Commands whose last {group} argument is rendered as text (other arguments dropped)
CONTENT = {
    "textbf": 1, "emph": 1, "textsf": 1, "textsl": 1, "textit": 1, "mbox": 1,
    "noprint": 1, "printchords": 1, "hidechords": 1,  # web shows all of these
    "textls": 1, "scalebox": 2,
}

# Commands followed by a dimension (`\hskip 1em`, `\leftskip=5pt`)
DIMENSIONED = {"hskip", "vskip", "leftskip", "rightskip", "parindent", "parskip", "crdheight", "columnsep"}

# Environments whose whole body is dropped
DROPPED_ENVIRONMENTS = {"figure", "music"}


def chord_from_macro(match: re.Match, variant: str | None) -> str:
    root = "B" if match["root"] == "H" else match["root"]
    accidental = {"s": "#", "b": "b", "": ""}[match["accidental"]]
    minor = match["minor"]
    variant = convert_inline(variant or "").replace(" ", "")
    extension, slash, bass = variant.partition("/")
    if bass.startswith("H"):
        bass = "B" + bass[1:]
    return f"{root}{accidental}{minor}{extension}{slash}{bass}"


def convert_inline(tex: str) -> str:
    """Convert a short TeX fragment (chord variant, title) to plain text."""
    return re.sub(r"\s+", " ", convert(tex)).strip()


def convert_math(tex: str) -> str:
    """Convert the tiny subset of math used in the songbook ($\\sharp$, $^{4\\times}$, $\\sfrac{3}{4}$)."""
    tex = re.sub(r"\\sfrac\s*\{([^}]*)\}\s*\{([^}]*)\}", r"\1/\2", tex)
    tex = tex.replace("^", "")
    return convert(tex).strip()


def convert(tex: str) -> str:
    """Convert a TeX song body to ChordPro text (section markers are opened but not closed)."""
    out: list[str] = []
    i = 0
    while i < len(tex):
        ch = tex[i]

        if ch == "\\":
            # Control symbols: \\ line break, \% \& \# \{ \} escapes, \, \  spaces
            if i + 1 < len(tex) and not tex[i + 1].isalpha():
                symbol = tex[i + 1]
                i += 2
                if symbol == "\\":
                    _, i = read_optional(tex, i)
                    out.append("\n")
                    # The source also breaks the line after \\, keep just one line break
                    j = i
                    while j < len(tex) and tex[j] in " \t":
                        j += 1
                    if j < len(tex) and tex[j] == "\n":
                        i = j + 1
                elif symbol in ",~ ":
                    out.append(" ")
                else:
                    out.append(symbol)
                continue

            match = re.match(r"[A-Za-z@]+", tex[i + 1:])
            name = match.group(0)
            i += 1 + len(name)

            if chord := CHORD_MACRO.fullmatch(name):
                variant, i = read_optional(tex, i)
                lyric, i = read_group(tex, i)
                out.append(f"[{chord_from_macro(chord, variant)}]")
                if lyric:
                    out.append(convert(lyric))
                continue

            if name == "CHORD":
                (label, _), i = read_groups(tex, i, 2)
                out.append(f" {convert_inline(label)} ")
                continue

            if name == "verse":
                label, i = read_group(tex, i)
                label = convert_inline(label or "")
                out.append(f"\n{{start_of_verse: {label}.}}\n" if label else "\n{start_of_verse}\n")
                continue

            if name == "chorus":
                _, i = read_group(tex, i)  # usually an empty {}
                out.append("\n{start_of_chorus: R:}\n")
                continue

            if name == "chorusAlt":
                (label, _), i = read_groups(tex, i, 2)
                out.append(f"\n{{start_of_chorus: {convert_inline(label)}}}\n")
                continue

            if name == "rec":
                content, i = read_group(tex, i)
                out.append(f"\n{{start_of_verse: Rec:}}\n{convert(content or '')}")
                continue

            if name == "capo":
                capo, i = read_group(tex, i)
                out.append(f"\n{{capo: {convert_inline(capo or '')}}}\n")
                continue

            if name == "uv":
                content, i = read_group(tex, i)
                out.append(f"„{convert(content or '')}“")
                continue

            if name == "optVerse":
                groups, i = read_groups(tex, i, 4)
                out.append(f"({convert(groups[3]).strip()})")
                continue

            if name == "sfrac":
                (numerator, denominator), i = read_groups(tex, i, 2)
                out.append(f"{convert_inline(numerator)}/{convert_inline(denominator)}")
                continue

            if name in SYMBOLS:
                _, i = read_group(tex, i) if tex.startswith("{}", i) else (None, i)
                out.append(SYMBOLS[name])
                continue

            if name in DROPPED:
                _, i = read_optional(tex, i)
                _, i = read_groups(tex, i, DROPPED[name])
                continue

            if name in CONTENT:
                _, i = read_optional(tex, i)
                groups, i = read_groups(tex, i, CONTENT[name])
                if name == "scalebox":  # \scalebox{h}[v]{content}
                    _, i = read_optional(tex, i)
                    content, i = read_group(tex, i)
                    groups = [content or ""]
                out.append(convert(groups[-1]))
                continue

            if name in DIMENSIONED:
                i = skip_dimension(tex, i)
                if name == "hskip":
                    out.append(" ")
                continue

            if name == "begin":
                environment, i = read_group(tex, i)
                if environment in DROPPED_ENVIRONMENTS:
                    end = tex.find(f"\\end{{{environment}}}", i)
                    i = len(tex) if end == -1 else end + len(f"\\end{{{environment}}}")
                elif environment == "minipage":  # \begin{minipage}[t]{\textwidth}
                    _, i = read_optional(tex, i)
                    _, i = read_group(tex, i)
                elif environment == "multicols":
                    _, i = read_group(tex, i)
                continue

            if name == "end":
                _, i = read_group(tex, i)
                continue

            # Anything else (\large, \medskip, \noindent, \clearpage, ...) is layout only: drop the command,
            # and swallow the space that terminates it.
            if i < len(tex) and tex[i] in " \t":
                i += 1
            continue

        if ch == "$":
            end = tex.find("$", i + 1)
            end = len(tex) if end == -1 else end
            out.append(convert_math(tex[i + 1:end]))
            i = end + 1
            continue

        if ch == "{":
            content, i = read_delimited(tex, i, "{", "}")
            out.append(convert(content))
            continue

        if ch == "~":
            out.append(" ")
        elif tex.startswith("---", i):
            out.append("—")
            i += 3
            continue
        elif tex.startswith("--", i):
            out.append("–")
            i += 2
            continue
        elif ch not in "}\r":
            out.append(ch)
        i += 1

    return "".join(out)


SECTION_START = re.compile(r"\{start_of_(verse|chorus)(?::[^}]*)?\}")


def close_section_markers(text: str) -> str:
    """Close each section at the start of the next one. An empty chorus becomes a {chorus} reference."""
    matches = list(SECTION_START.finditer(text))
    if not matches:
        return text

    pieces = [text[:matches[0].start()]]
    for index, match in enumerate(matches):
        next_start = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        body = text[match.end():next_start].strip("\n")
        if not body.strip():
            if match.group(1) == "chorus":
                pieces.append("{chorus}\n\n")
            continue
        pieces.append(f"{match.group(0)}\n{body}\n{{end_of_{match.group(1)}}}\n\n")
    return "".join(pieces)


def tidy_lines(text: str) -> str:
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


# Songs ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

TOP_LEVEL_SONG = re.compile(r"\\(song|songWithTranslation)(?![A-Za-z])")


def parse_song_macro(tex: str, i: int) -> tuple[dict, int]:
    """Parse \\song{title}{artist}{indent}{spread}{body} starting after the macro name."""
    (title, artist, _, _, body), i = read_groups(tex, i, 5)
    return {"title": convert_inline(title) or "Untitled", "artist": convert_inline(artist), "body": body}, i


def scrape_songs_data(url: str = BRATR_URL) -> list[dict]:
    with urllib.request.urlopen(url, timeout=30) as response:
        tex = response.read().decode("utf-8", errors="replace")
    return parse_songs(tex)


def parse_songs(tex: str) -> list[dict]:
    """Find the top-level songs in document order. Indices match the bratruvzpevnik.cz web app."""
    tex = strip_comments(tex.replace("\r", ""))
    begin = tex.find("\\begin{document}")
    i = begin if begin != -1 else 0

    songs = []
    while match := TOP_LEVEL_SONG.search(tex, i):
        i = match.end()
        if match.group(1) == "song":
            song, i = parse_song_macro(tex, i)
            songs.append(song)
        else:
            # \songWithTranslation{lang}{\song{...}}{lang}{\originalVersion{...}}: keep the translated song
            (_, translated, _, _), i = read_groups(tex, i, 4)
            inner = re.search(r"\\song(?![A-Za-z])", translated)
            if inner:
                song, _ = parse_song_macro(translated, inner.end())
                songs.append(song)
    return songs


def bratr_to_chordpro(song: dict, index: int) -> str:
    body = convert(song["body"])

    # Move capo out of the body into the header
    capo = None
    if match := re.search(r"\{capo: ([^}]*)\}", body):
        capo = match.group(1).strip()
        body = body.replace(match.group(0), "")

    lines = [f"{{title: {song['title']}}}"]
    if song["artist"]:
        lines.append(f"{{artist: {song['artist']}}}")
    if capo:
        lines.append(f"{{capo: {capo}}}")
    lines += [
        "{meta: source Bratrův zpěvník}",
        f"{{meta: url https://bratruvzpevnik.cz/#/song/{index}}}",
        "",
        close_section_markers(tidy_lines(body)),
    ]
    return tidy_lines("\n".join(lines)) + "\n"


def scrape(output: Path):
    songs = scrape_songs_data()

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True, exist_ok=True)

    for index, song in enumerate(songs):
        song_chordpro = bratr_to_chordpro(song, index)
        safe_title = sanitize_filename(song["title"])
        safe_artist = sanitize_filename(song["artist"])
        song_file = output / f"{safe_title} - {safe_artist}.cho"
        with open(song_file, "w", encoding="utf8") as f:
            f.write(song_chordpro)


if __name__ == "__main__":
    args = parser.parse_args([] if "__file__" not in globals() else None)
    scrape(args.output)
