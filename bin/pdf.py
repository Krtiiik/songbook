"""The songbook PDF: turns the songs into plain data and has Typst lay them out (pdf/songbook.typ).

Python only decides what is on a page (sections, labels, chord fingerings, letter sections); every
decision about where it goes (columns, page breaks, balance) is made in the template, where text can be measured.
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

import typst
from chordpro import Song
from chordpro.models import ChordLine, ChorusRef, CommentBox, CommentItalic, CommentLine, Highlight, LyricLine, Verse

import library

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "pdf" / "songbook.typ"
FONTS = ROOT / "pdf" / "fonts"
CHORDS = ROOT / "web" / "chords.json"

# Chord diagrams ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

# Same lookup as web/js/chords.js and transpose.js: keep them in step.
DB_ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
SEMITONES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11, "H": 11}
ACCIDENTALS = {"": 0, "#": 1, "♯": 1, "b": -1, "♭": -1}
SUFFIX_ALIASES = {"maj": "", "mi": "m", "min": "m", "+": "aug", "7maj": "maj7", "mi7": "m7"}
CHORD = re.compile(r"^([A-H])([#♯b♭]?)([^/]*)(?:/(.+))?$")
NOTE = re.compile(r"^([A-H])([#♯b♭]?)$")

_chord_db: dict | None = None


def note_semitone(note: str) -> int | None:
    match = NOTE.match(note)
    return None if not match else (SEMITONES[match[1]] + ACCIDENTALS[match[2]]) % 12


def chord_diagram(name: str) -> dict | None:
    """Fingering of a chord for the PDF, or None when chords.json has none.

    Frets are listed per string from the low E: -1 muted, 0 open, otherwise the fret (relative to `position`).
    Barres give string indexes in the same order. The first variant is used, as on the website.
    """
    global _chord_db
    if _chord_db is None:
        _chord_db = json.loads(CHORDS.read_text(encoding="utf-8"))

    match = CHORD.match(name.strip())
    if not match:
        return None
    root = note_semitone(match[1] + match[2])
    suffix = SUFFIX_ALIASES.get(match[3], match[3])
    bass = note_semitone(match[4]) if match[4] else None

    entry = _chord_db.get(DB_ROOTS[root], {})
    candidates = [suffix] if bass is None else [f"{suffix}/{DB_ROOTS[bass]}", suffix]
    variants = next((entry[key] for key in candidates if entry.get(key)), None)
    if not variants:
        return None
    variant = variants[0]

    frets = [0] * 6  # strings nobody lists are open
    barres = variant.get("barres", [])
    for barre in barres:
        for index in range(6 - barre["fromString"], 6 - barre["toString"] + 1):
            frets[index] = barre["fret"]
    for finger in variant["fingers"]:
        frets[6 - finger[0]] = -1 if finger[1] == "x" else finger[1]
    return {
        "name": name,
        "frets": frets,
        "barres": [{"fret": b["fret"], "from": 6 - b["fromString"], "to": 6 - b["toString"]} for b in barres],
        "position": variant.get("position", 1),
    }


# Songs ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

NOTES = (CommentLine, CommentItalic, CommentBox, Highlight)


def letter_of(title: str) -> str:
    """Section letter of a title, as web/js/letters.js: "A".."Z", "Č", "Ř", "Š", "Ž", "Ch" or "#"."""
    text = title
    first = next((ch for ch in text if ch.isalnum()), None)
    if first is None:
        return "#"
    upper = first.upper()
    if upper in "ČŘŠŽ":
        return upper
    if upper == "C" and re.match(r"^[^\w]*ch", text, re.IGNORECASE):
        return "Ch"
    plain = library.strip_accents(upper)
    return plain if re.fullmatch(r"[A-Z]", plain) else "#"


def line_data(line, in_tab: bool) -> dict | None:
    """One line as {"k": "chords"|"lyric"|"note"|"tab", ...}; directives that draw nothing give None."""
    if isinstance(line, ChordLine):
        return {"k": "chords", "segs": [[seg.chord, seg.lyric] for seg in line.segments]}
    if isinstance(line, LyricLine):
        return {"k": "tab" if in_tab else "lyric", "t": line.text}
    if isinstance(line, NOTES):
        return {"k": "note", "t": line.text}
    return None


def sections_of(song: Song) -> list[dict]:
    """The song body as sections. Loose lines outside any section collect into a plain one."""
    sections: list[dict] = []
    loose: list[dict] = []
    verses = 0

    def flush_loose():
        if loose:
            sections.append({"label": "", "rule": None, "lines": loose.copy()})
            loose.clear()

    for item in song.body:
        if isinstance(item, ChorusRef):
            flush_loose()
            sections.append({"label": "R", "rule": "accent", "lines": [{"k": "note", "t": item.label or "Refrén"}]})
        elif hasattr(item, "lines") and hasattr(item, "kind"):
            flush_loose()
            if isinstance(item, Verse):
                verses += 1
            label = item.label
            rule = {"chorus": "accent", "tab": "muted", "grid": "muted"}.get(item.kind)
            if not label and item.kind == "verse":
                label = str(verses)
            elif not label and item.kind == "chorus":
                label = "R"
            lines = [data for line in item.lines if (data := line_data(line, item.kind in ("tab", "grid")))]
            sections.append({"label": label, "rule": rule, "lines": lines})
        elif (data := line_data(item, False)):
            loose.append(data)
        elif not loose:
            continue
        else:
            flush_loose()  # a blank line ends a run of loose lines
    flush_loose()
    return sections


def chords_of(sections: list[dict]) -> list[dict]:
    """Diagrams of the chords of the song, in order of first appearance."""
    names: list[str] = []
    for section in sections:
        for line in section["lines"]:
            for chord, _ in line.get("segs", []):
                if chord and chord not in names:
                    names.append(chord)
    return [diagram for name in names if (diagram := chord_diagram(name))]


def song_data(group: library.SongGroup, config: library.Config) -> dict:
    version = group.versions[0]
    meta = version.song.meta
    first = lambda value: (value[0] if value else None) if isinstance(value, list) else value
    sections = sections_of(version.song)
    source = next((s.label for s in config.sources if s.id == version.source), version.source)
    return {
        "id": group.id,
        "title": group.title,
        "artist": group.artist or None,
        "letter": letter_of(group.title),
        "key": first(meta.key) or None,
        "capo": meta.capo or None,
        "source": source,
        "sections": sections,
        "chords": chords_of(sections),
    }


# Build ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

def build_pdf(config: library.Config, groups: list[library.SongGroup], output_file: Path):
    """Write one PDF with the default version of every song. Songs are expected in alphabetical order."""
    today = date.today()
    songs = [song_data(group, config) for group in groups]

    # Letter sections of the contents, like the song list of the website
    contents: list[dict] = []
    for song in songs:
        entry = {"id": song["id"], "title": song["title"], "artist": song["artist"]}
        if contents and contents[-1]["letter"] == song["letter"]:
            contents[-1]["songs"].append(entry)
        else:
            contents.append({"letter": song["letter"], "songs": [entry]})

    data = {
        "title": config.title,
        "date": f"{today.day}. {today.month}. {today.year}",
        "contents": contents,
        "songs": songs,
    }
    try:
        typst.compile(
            str(TEMPLATE),
            output=str(output_file),
            root=str(ROOT),
            font_paths=[str(FONTS)],
            ignore_system_fonts=True,  # the same PDF on every machine
            sys_inputs={"data": json.dumps(data, ensure_ascii=False)},
        )
    except Exception as error:
        print(f"::error::Typst failed: {error}", file=sys.stderr)
        raise
