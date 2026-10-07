"""Load songs from all sources and group versions of the same song together."""

import re
import tomllib
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

from chordpro import Song, parse


# Config ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

@dataclass
class Source:
    id: str
    label: str
    path: Path
    url: str | None = None
    scraper: str | None = None


@dataclass
class Config:
    title: str
    sources: list[Source]  # in priority order


def load_config(config_file: Path, cache_dir: Path) -> Config:
    """Read songbook.toml. Paths are relative to the config file; scraped sources default to the cache dir."""
    data = tomllib.loads(config_file.read_text(encoding="utf-8"))
    root = config_file.parent
    sources = []
    for entry in data.get("sources", []):
        path = root / entry["path"] if "path" in entry else cache_dir / entry["id"]
        sources.append(Source(
            id=entry["id"],
            label=entry.get("label", entry["id"]),
            path=path,
            url=entry.get("url"),
            scraper=entry.get("scraper"),
        ))
    return Config(title=data.get("title", "Songbook"), sources=sources)


# Normalizing ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

def strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def normalize(text: str | None) -> str:
    """Lowercase words without accents or punctuation, separated by single spaces."""
    return re.sub(r"[^a-z0-9]+", " ", strip_accents(text or "").lower()).strip()


def slugify(text: str | None) -> str:
    return normalize(text).replace(" ", "-")


CZECH_LETTERS = {"č": "c", "ř": "r", "š": "s", "ž": "z"}


def czech_key(text: str) -> tuple:
    """Czech alphabetical order: č ř š ž and ch are letters of their own (after c r s z h), other accents only break ties."""
    text = text.lower()
    primary = []
    i = 0
    while i < len(text):
        if text.startswith("ch", i):
            primary.append(("h", 1))
            i += 2
            continue
        ch = text[i]
        if ch in CZECH_LETTERS:
            primary.append((CZECH_LETTERS[ch], 1))
        else:
            primary.append((strip_accents(ch), 0))
        i += 1
    return primary, text


# Songs ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

@dataclass
class Version:
    source: str  # source id
    key: str  # "<source>:<path relative to the source dir>", used in overrides
    song: Song

    @property
    def title(self) -> str:
        return self.song.meta.title or ""

    @property
    def artist(self) -> str:
        artist = self.song.meta.artist
        if isinstance(artist, list):
            artist = artist[0] if artist else ""
        return artist or ""


@dataclass
class SongGroup:
    versions: list[Version]  # default version first
    id: str = ""

    @property
    def title(self) -> str:
        return self.versions[0].title

    @property
    def artist(self) -> str:
        return next((v.artist for v in self.versions if v.artist), "")


@dataclass
class Overrides:
    merge: list[list[str]] = field(default_factory=list)  # keys that are the same song
    separate: list[str] = field(default_factory=list)  # keys that never match anything automatically


def load_overrides(overrides_file: Path) -> Overrides:
    if not overrides_file.exists():
        return Overrides()
    data = tomllib.loads(overrides_file.read_text(encoding="utf-8"))
    return Overrides(merge=data.get("merge", []), separate=data.get("separate", []))


def load_versions(sources: list[Source]) -> list[Version]:
    """Parse all .cho files of all sources, in source priority order."""
    versions = []
    for source in sources:
        if not source.path.is_dir():
            print(f"Source '{source.id}' has no songs at {source.path}, skipping.")
            continue
        for cho_file in sorted(source.path.rglob("*.cho")):
            relative = cho_file.relative_to(source.path).as_posix()
            song = parse(cho_file.read_text(encoding="utf-8"))
            if not song.meta.title:
                print(f"Skipping {source.id}:{relative}, it has no title.")
                continue
            versions.append(Version(source=source.id, key=f"{source.id}:{relative}", song=song))
    return versions


def group_versions(versions: list[Version], sources: list[Source], overrides: Overrides | None = None) -> list[SongGroup]:
    """Group versions of the same song, then apply overrides.

    Songs match on their normalized title. Artists are not compared: songbooks credit the same song differently
    (performer vs. composer, band vs. singer), so that caused more wrong splits than it prevented wrong merges.
    One song never gets two versions from the same source automatically.
    """
    overrides = overrides or Overrides()
    separate = set(overrides.separate)

    # Automatic matching
    groups: list[list[Version]] = []
    by_title: dict[str, list[list[Version]]] = {}
    for version in versions:
        if version.key in separate:
            groups.append([version])
            continue
        clusters = by_title.setdefault(normalize(version.title), [])
        cluster = next((c for c in clusters if all(v.source != version.source for v in c)), None)
        if cluster is None:
            cluster = []
            clusters.append(cluster)
            groups.append(cluster)
        cluster.append(version)

    # Manual merges
    for keys in overrides.merge:
        targets = [g for g in groups if any(v.key in keys for v in g)]
        missing = set(keys) - {v.key for g in targets for v in g}
        for key in missing:
            print(f"Override merge: no song '{key}'.")
        if len(targets) < 2:
            continue
        merged = [v for g in targets for v in g]
        groups = [g for g in groups if g not in targets] + [merged]

    # Default version first: by source priority, then by file
    priority = {source.id: index for index, source in enumerate(sources)}
    result = [SongGroup(sorted(g, key=lambda v: (priority.get(v.source, len(priority)), v.key))) for g in groups]
    result.sort(key=lambda g: (czech_key(g.title), czech_key(g.artist)))
    assign_ids(result)
    return result


def assign_ids(groups: list[SongGroup]):
    """Song id is the title slug; songs sharing a title get the artist appended."""
    title_counts: dict[str, int] = {}
    for group in groups:
        slug = slugify(group.title) or "song"
        title_counts[slug] = title_counts.get(slug, 0) + 1

    used: set[str] = set()
    for group in groups:
        song_id = slugify(group.title) or "song"
        if title_counts[song_id] > 1 and group.artist:
            song_id = f"{song_id}--{slugify(group.artist)}"
        base, n = song_id, 2
        while song_id in used:
            song_id = f"{base}-{n}"
            n += 1
        used.add(song_id)
        group.id = song_id
