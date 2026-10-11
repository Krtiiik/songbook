#!/usr/bin/env python3
"""Build the songbook website and PDF.

Songs come from the sources in songbook.toml. Versions of the same song from different sources are grouped
(see library.py and songs/.overrides.toml). The website is the web/ folder plus generated data:

    dist/index.json        site title, sources and the list of songs with their versions
    dist/songs/<id>.json   rendered versions of one song, loaded when the song is opened
    dist/songbook.pdf      default version of every song
"""

import argparse
import importlib
import json
import shutil
from pathlib import Path

from chordpro import Song, build_chord_semi_to_name, parse, render

import library
import pdf

ROOT = Path(__file__).resolve().parent.parent

parser = argparse.ArgumentParser(description="Build the songbook.")
parser.add_argument("--config", default=ROOT / "songbook.toml", type=Path, help="Songbook configuration")
parser.add_argument("--overrides", default=ROOT / "songs" / ".overrides.toml", type=Path, help="Manual song matching")
parser.add_argument("--web", default=ROOT / "web", type=Path, help="Static website files")
parser.add_argument("--cache", default=ROOT / ".cache" / "sources", type=Path, help="Scraped songs")
parser.add_argument("--output", default=ROOT / "dist", type=Path, help="Output directory")
parser.add_argument("--scrape", default=True, action=argparse.BooleanOptionalAction, help="Scrape online songbooks")
parser.add_argument("--pdf", default=True, action=argparse.BooleanOptionalAction, help="Build the PDF songbook")

SEMI_TO_NAME = build_chord_semi_to_name("standard")


# Scraping ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

def scrape_sources(sources: list[library.Source]):
    """Run each source's scraper. A failed scrape keeps the previous songs, so the build can go on."""
    for source in sources:
        if not source.scraper:
            continue
        print(f"Scraping {source.id}...")
        partial = source.path.with_name(source.path.name + ".partial")
        try:
            importlib.import_module(f"scraping.{source.scraper}").scrape(partial)
        except Exception as error:
            shutil.rmtree(partial, ignore_errors=True)
            fallback = "using the previous scrape" if source.path.is_dir() else "skipping the source"
            print(f"::warning::Scraping {source.id} failed ({error!r}), {fallback}.")
            continue
        shutil.rmtree(source.path, ignore_errors=True)
        partial.rename(source.path)


# Website data ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

def version_ids(group: library.SongGroup) -> list[str]:
    """A version is identified by its source; a source appearing twice (manual merge) gets a number."""
    ids = []
    for version in group.versions:
        version_id, n = version.source, 2
        while version_id in ids:
            version_id = f"{version.source}-{n}"
            n += 1
        ids.append(version_id)
    return ids


def version_info(version_id: str, version: library.Version) -> dict:
    meta = version.song.meta
    first = lambda value: (value[0] if value else None) if isinstance(value, list) else value
    key = first(meta.key)
    return {
        "id": version_id,
        "source": version.source,
        "title": version.title,
        "artist": version.artist or None,
        "key": key or None,
        "capo": meta.capo or None,
        "url": first(meta.meta.get("url")),
    }


_default_labels: dict[str, str] = {}


def drop_default_labels(song: Song):
    """The parser labels unlabelled sections with their kind ("Verse", "Chorus"); keep only labels from the song."""
    for section in song.body:
        if not (hasattr(section, "kind") and hasattr(section, "label")):
            continue  # not a section
        if section.kind not in _default_labels:
            probe = parse(f"{{start_of_{section.kind}}}\nx\n{{end_of_{section.kind}}}")
            _default_labels[section.kind] = probe.body[0].label
        if section.label == _default_labels[section.kind]:
            section.label = ""


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def build_data(config: library.Config, groups: list[library.SongGroup], output: Path, pdf: bool):
    index = {
        "title": config.title,
        "pdf": pdf,
        "sources": {s.id: {"label": s.label, "url": s.url} for s in config.sources},
        "songs": [],
    }

    for group in groups:
        versions = []
        for version_id, version in zip(version_ids(group), group.versions):
            info = version_info(version_id, version)
            drop_default_labels(version.song)
            info["html"] = render(version.song, SEMI_TO_NAME, format="html")
            versions.append(info)

        write_json(output / "songs" / f"{group.id}.json", {"id": group.id, "versions": versions})
        index["songs"].append({
            "id": group.id,
            "title": group.title,
            "artist": group.artist or None,
            "versions": [{k: v[k] for k in ("id", "source", "key", "capo")} for v in versions],
        })

    write_json(output / "index.json", index)


def build_pdf(config: library.Config, groups: list[library.SongGroup], output_file: Path):
    """One PDF with the default version of each song, laid out by Typst (see pdf.py)."""
    for group in groups:
        drop_default_labels(group.versions[0].song)
    pdf.build_pdf(config, groups, output_file)


# Main ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

def main(args):
    config = library.load_config(args.config, args.cache)

    if args.scrape:
        scrape_sources(config.sources)

    versions = library.load_versions(config.sources)
    if not versions:
        raise SystemExit("No songs found.")
    groups = library.group_versions(versions, config.sources, library.load_overrides(args.overrides))
    print(f"{len(versions)} versions of {len(groups)} songs.")

    # Empty the output folder rather than deleting it, so a server running in it survives a rebuild
    args.output.mkdir(parents=True, exist_ok=True)
    for child in args.output.iterdir():
        shutil.rmtree(child) if child.is_dir() else child.unlink()
    shutil.copytree(args.web, args.output, dirs_exist_ok=True)

    build_data(config, groups, args.output, pdf=args.pdf)
    if args.pdf:
        build_pdf(config, groups, args.output / "songbook.pdf")


if __name__ == "__main__":
    main(parser.parse_args([] if "__file__" not in globals() else None))
