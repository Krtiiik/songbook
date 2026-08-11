#!/usr/bin/env python3
"""Build songbook in PDF and HTML formats."""

import argparse
import json
import shutil
from pathlib import Path

import jinja2
from chordpro import Song, build_chord_semi_to_name, parse, render, render_many

# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

parser = argparse.ArgumentParser(description="Build the songbook.")
parser.add_argument("--songs", default="songs", type=Path, help="Directory containing .cho song files")
parser.add_argument("--output", default="songbook", type=Path, help="Output directory for built songbooks")
parser.add_argument("--templates", default="templates", type=Path, help="Directory containing HTML templates")
parser.add_argument("--assets", default="assets", type=Path, help="Directory containing asset files")


SEMI_TO_NAME = build_chord_semi_to_name("standard")

# Normalizing titles ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import unicodedata
import re

def slugify_czech(title: str) -> str:
    # Normalize Unicode (split accents)
    normalized = unicodedata.normalize("NFD", title)

    # Remove diacritics
    without_accents = "".join(
        ch for ch in normalized
        if unicodedata.category(ch) != "Mn"
    )

    # Lowercase
    lower = without_accents.lower()

    # Replace non-alphanumeric sequences with hyphens
    slug = re.sub(r"[^a-z0-9]+", "-", lower)

    # Trim hyphens
    slug = slug.strip("-")

    return slug

# Rendering ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

def render_to_file(songs: Song | list[Song], output_file: Path, format: str):
    """Render a single song or multiple songs and write to file."""
    if isinstance(songs, Song):
        content = render(songs, SEMI_TO_NAME, format=format)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(content)
    else:
        content = render_many(songs, SEMI_TO_NAME, format=format)
        with open(output_file, "wb") as f:
            f.write(content)


def build_pdf(songs: list[Song], output_path: Path):
    """Build a single PDF songbook from all songs."""
    render_to_file(songs, output_path, "pdf")


def build_html(songs: list[Song], output_dir: Path, templates_dir: Path, assets_dir: Path):
    """Build individual HTML files for each song and create an index."""
    songs_info = build_html_songs_info(songs)

    # Create html
    output_dir.mkdir(exist_ok=True)
    create_songs_datafile(songs_info, output_dir)
    create_html_index(songs_info, output_dir, templates_dir)
    shutil.copytree(assets_dir, output_dir / "assets", dirs_exist_ok=True)


def build_html_songs_info(songs: list[Song]):
    songs_info = {}
    for song in songs:
        # Collect info for index
        artist = None
        if song.meta.artist:
            artist = song.meta.artist[0] if isinstance(song.meta.artist, list) else song.meta.artist

        # Create a unique song id
        # WARNING: Should we obtain songs with identical titles, we need to add artists to id
        song_id = slugify_czech(song.meta.title)

        # Render song content with chordpro
        rendered_content = render(song, SEMI_TO_NAME, format="html")

        songs_info[song_id] = {
            "title": song.meta.title,
            "artist": artist,
            "id": song_id,
            "capo": song.meta.capo,
            "content": rendered_content,
        }
        if "source" in song.meta.meta:
            songs_info[song_id]["source"] = song.meta.meta["source"]
        if "url" in song.meta.meta:
            songs_info[song_id]["url"] = song.meta.meta["url"]

    return songs_info


def create_songs_datafile(songs_info: dict, output_dir: Path):
    """Write song data to songs.json."""
    data_path = output_dir / "songs.json"
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(songs_info, f, ensure_ascii=False, indent=2)


def create_html_index(songs_info: dict, output_dir: Path, templates_dir: Path):
    """Create an index.html file linking to all songs using Jinja2."""
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(templates_dir))
    template = env.get_template("index.html")

    html = template.render(songs=list(songs_info.values()))

    index_path = output_dir / "index.html"
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(html)


def get_songs(songs_dir: Path):
    """Get all .cho files in the songs directory."""
    cho_files = sorted(songs_dir.rglob("*.cho"), key=lambda f: f.name)
    if not cho_files:
        print("No .cho files found in songs folder.")
        exit(1)

    songs = []
    for cho_file in cho_files:
        with open(cho_file, "r", encoding="utf-8") as f:
            songs.append(parse(f.read()))

    return songs


def setup(args):
    if args.output.exists():
        shutil.rmtree(args.output)
    args.output.mkdir()


if __name__ == "__main__":
    args = parser.parse_args([] if "__file__" not in globals() else None)

    setup(args)

    songs = get_songs(args.songs)

    build_pdf(songs, args.output / "songbook.pdf")
    build_html(songs, args.output / "html", args.templates, args.assets / "html")
