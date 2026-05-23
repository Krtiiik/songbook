#!/usr/bin/env python3
"""Build songbook in PDF and HTML formats."""

import argparse
import shutil
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from chordpro import Song, build_chord_semi_to_name, parse, render, render_many


parser = argparse.ArgumentParser(description="Build the songbook.")
parser.add_argument("--songs", default="songs", type=Path, help="Directory containing .cho song files")
parser.add_argument("--config", default="chordpro.json", type=Path, help="Path to chordpro configuration file")
parser.add_argument("--output", default="songbook", type=Path, help="Output directory for built songbooks")
parser.add_argument("--templates", default="templates", type=Path, help="Directory containing HTML templates")


def render_to_file(songs: Song | list[Song], semi_to_name, output_file: Path, format: str):
    """Render a single song or multiple songs and write to file."""
    if isinstance(songs, Song):
        content = render(songs, semi_to_name, format=format)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(content)
    else:
        content = render_many(songs, semi_to_name, format=format)
        with open(output_file, "wb") as f:
            f.write(content)


def build_pdf(songs: list[Song], semi_to_name, output_path: Path):
    """Build a single PDF songbook from all songs."""
    render_to_file(songs, semi_to_name, output_path, "pdf")


def build_html(songs: list[Song], semi_to_name, output_dir: Path, templates_dir: Path):
    """Build individual HTML files for each song and create an index."""
    output_dir.mkdir(exist_ok=True)

    # Setup Jinja2 environment
    env = Environment(loader=FileSystemLoader(templates_dir))
    song_template = env.get_template("song.html")

    # Create song files
    songs_dir = output_dir / "songs"
    songs_dir.mkdir(exist_ok=True)

    songs_info = []
    for song in songs:
        song_name_f = song.meta.title.replace(" ", "_").lower()
        filename = f"{song_name_f}.html"
        output_file = songs_dir / filename

        # Render song content with chordpro
        rendered_content = render(song, semi_to_name, format="html")

        # Render song template with Jinja2
        html = song_template.render(song=song, rendered_content=rendered_content)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(html)

        # Collect info for index
        artist = None
        if song.meta.artist:
            artist = song.meta.artist[0] if isinstance(song.meta.artist, list) else song.meta.artist

        songs_info.append({
            "title": song.meta.title,
            "filename": str(output_file.relative_to(output_dir)),
            "artist": artist,
        })

    # Create index.html and copy stylesheet
    create_html_index(songs_info, output_dir, templates_dir)
    shutil.copy(templates_dir / "stylesheet.css", output_dir / "stylesheet.css")


def create_html_index(songs_info: list[dict], output_dir: Path, templates_dir: Path):
    """Create an index.html file linking to all songs using Jinja2."""
    env = Environment(loader=FileSystemLoader(templates_dir))
    index_template = env.get_template("index.html")

    html = index_template.render(songs=songs_info)

    index_path = output_dir / "index.html"
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(html)


def get_songs(songs_dir: Path):
    """Get all .cho files in the songs directory."""
    cho_files = sorted(songs_dir.glob("*.cho"))
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
    semi_to_name = build_chord_semi_to_name("standard")

    build_pdf(songs, semi_to_name, args.output / "songbook.pdf")
    build_html(songs, semi_to_name, args.output / "html", args.templates)
