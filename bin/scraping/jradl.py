import argparse
from enum import Enum, auto
import json
from pathlib import Path
import re
import shutil

from playwright.sync_api import sync_playwright

from .common import sanitize_filename


JRADL_URL = "https://zpevnik.jradl.cz"


parser = argparse.ArgumentParser(description="Scrape the JRadl songbook")
parser.add_argument("--output", default=Path("songs") / "jradl", type=Path, help="Output directory for scraped songs")


def scrape_songs_data():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(JRADL_URL)
        page.wait_for_timeout(5000)
        local_storage = page.evaluate("() => window.localStorage")
        return json.loads(local_storage["songs"])


class SectionType(Enum):
    Verse = auto()
    VerseRepeat = auto()
    Chorus = auto()
    ChorusRepeat = auto()
    Instrumental = auto()
    Interlude = auto()  # recitals also, "*"
    Outro = auto()


def get_section_type(name) -> tuple[SectionType, str]:
    if name is None:
        return SectionType.Verse, ""

    name = name.strip().lower()
    name = name.rstrip(".:")

    if name in ("", "null"):
        return SectionType.Verse, ""

    if match := re.match(r"^(.*?)\s*=\s*(.*)$", name):
        repeat = match.group(2).strip()
        return SectionType.VerseRepeat, repeat

    if name == "fin":
        return SectionType.Outro, "fin"

    if name in {"*", "**", "***"} or name.startswith("rec"):
        return SectionType.Interlude, name

    if name in {"ins", "instrumental"}:
        return SectionType.Instrumental, name

    if re.fullmatch(r"(?:\d+x\s*)?r(?:\*|[0-9]+|[ab]|(?:\s*\+\s*r[0-9]*)?)*", name):
        if name.startswith("r"):
            label = name[1:].strip()
        elif name.endswith(" r"):
            label = name[:-2].strip()
        elif name.endswith("xr"):
            label = name[:-1].strip()
        else:
            label = name

        return SectionType.Chorus, label

    if re.fullmatch(r"[0-9]+", name):
        return SectionType.Verse, ""

    if re.fullmatch(r"[a-z][a-z0-9]*", name):
        return SectionType.Verse, name

    return SectionType.Verse, name


def jradl_to_chordpro(song):
    lines = []

    # --- Header ---
    if "title" in song:
        lines.append(f"{{title: {song['title']}}}")
    if "author" in song:
        lines.append(f"{{artist: {song['author']}}}")
    if "capo" in song and song["capo"]:
        lines.append(f"{{capo: {song['capo']}}}")
    lines.append(r"{meta: source JRadl}")
    lines.append(f"{{meta: url https://zpevnik.jradl.cz/{song["id"]}}}")

    lines.append("")

    for verse in song.get("verses", []):
        name = verse.get("name", "").strip()
        lyrics = verse.get("lyrics", "").rstrip()

        section_type, section_label = get_section_type(name)
        lyrics = lyrics.replace("\r", "")
        lyrics = re.sub(r"\\h\{[^}]+\} *", "", lyrics)

        if section_type == SectionType.Chorus and not lyrics:
            section_type = SectionType.ChorusRepeat

        match section_type:
            case SectionType.Verse:
                lines.append(r"{start_of_verse}")
                for line in lyrics.split("\n"):
                    lines.append(line)
                lines.append(r"{end_of_verse}")
            case SectionType.VerseRepeat:
                lines.append(r"{start_of_verse}")
                lines.append(f"{{comment: {section_label}}}")
                lines.append(r"{end_of_verse}")
            case SectionType.Chorus:
                lines.append(r"{start_of_chorus}")
                if section_label:
                    lines.append(f"{{comment: {section_label}}}")
                for line in lyrics.split("\n"):
                    lines.append(line)
                lines.append(r"{end_of_chorus}")
            case SectionType.ChorusRepeat:
                lines.append(f"{{chorus: {section_label}}}")
            case SectionType.Instrumental:
                lines.append(r"{start_of_instrumental}")
                for line in lyrics.split("\n"):
                    lines.append(line)
                lines.append(r"{end_of_instrumental}")
            case SectionType.Interlude:
                lines.append(r"{start_of_interlude}")
                for line in lyrics.split("\n"):
                    lines.append(line)
                lines.append(r"{end_of_interlude}")
            case SectionType.Outro:
                lines.append(r"{start_of_outro}")
                lines.append(r"{end_of_outro}")

        lines.append("")

    return "\n".join(lines).strip() + "\n"


def scrape(output: Path):
    songs = scrape_songs_data()

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True, exist_ok=True)

    for song in songs:
        song_chordpro = jradl_to_chordpro(song)
        song_authors = sanitize_filename(song["author"])
        song_title = sanitize_filename(song["title"])
        song_file = output / f"{song_title} - {song_authors}.cho"
        with open(song_file, "w", encoding="utf8") as f:
            f.write(song_chordpro)


if __name__ == "__main__":
    args = parser.parse_args([] if "__file__" not in globals() else None)
    scrape(args.output)
