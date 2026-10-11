"""Tests for song matching. Run with: uv run python -m unittest discover tests"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "bin"))

from chordpro import parse

import library
from library import Overrides, Source, Version

SOURCES = [Source("own", "Krtek", Path("songs")), Source("jradl", "JRadl", Path()), Source("bratr", "Bratr", Path())]


def version(source: str, title: str, artist: str = "") -> Version:
    text = f"{{title: {title}}}\n" + (f"{{artist: {artist}}}\n" if artist else "") + "[C]La la\n"
    return Version(source=source, key=f"{source}:{title} - {artist}.cho", song=parse(text))


def grouped(versions, overrides=None):
    return {g.id: [v.key for v in g.versions] for g in library.group_versions(versions, SOURCES, overrides)}


class NormalizeTest(unittest.TestCase):
    def test_accents_case_and_punctuation(self):
        self.assertEqual(library.normalize("Země  vzdálená!"), "zeme vzdalena")
        self.assertEqual(library.slugify("Knockin' on Heaven's Door"), "knockin-on-heaven-s-door")

    def test_czech_order(self):
        words = ["Žena", "Čert", "Cesta", "Chata", "Hora", "Ída", "Zima", "Řeka", "Rum", "Šum", "Sůl"]
        self.assertEqual(sorted(words, key=library.czech_key),
                         ["Cesta", "Čert", "Hora", "Chata", "Ída", "Rum", "Řeka", "Sůl", "Šum", "Zima", "Žena"])


class GroupTest(unittest.TestCase):
    def test_same_title_from_different_sources_is_one_song(self):
        groups = grouped([
            version("bratr", "Země vzdálená", "BSP"),
            version("own", "Země vzdálená", "BSP"),
            version("jradl", "Zeme vzdalena", "Kamil Střihavka"),
        ])
        self.assertEqual(list(groups), ["zeme-vzdalena"])

    def test_default_version_follows_source_priority(self):
        groups = grouped([version("bratr", "Magdaléna", "Jelen"), version("own", "Magdaléna", "Jelen"),
                          version("jradl", "Magdaléna", "Jelen")])
        self.assertEqual([key.split(":")[0] for key in groups["magdalena"]], ["own", "jradl", "bratr"])

    def test_same_source_twice_is_two_songs_with_artist_in_id(self):
        groups = grouped([version("jradl", "Panenka", "Robert Křesťan"), version("jradl", "Panenka", "Jiný")])
        self.assertEqual(sorted(groups), ["panenka--jiny", "panenka--robert-krestan"])

    def test_override_merge(self):
        stara = version("bratr", "Stará archa", "Spirituál kvintet")
        kocabka = version("jradl", "Kocábka (Stará archa)", "Spirituál kvintet")
        self.assertEqual(len(grouped([stara, kocabka])), 2)
        self.assertEqual(len(grouped([stara, kocabka], Overrides(merge=[[stara.key, kocabka.key]]))), 1)

    def test_override_separate(self):
        own = version("own", "Dinosaur", "Kruh 19")
        other = version("jradl", "Dinosaur", "Someone Else")
        self.assertEqual(len(grouped([own, other])), 1)
        self.assertEqual(sorted(grouped([own, other], Overrides(separate=[other.key]))),
                         ["dinosaur--kruh-19", "dinosaur--someone-else"])


if __name__ == "__main__":
    unittest.main()
