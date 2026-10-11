"""Tests for the PDF data. Run with: uv run python -m unittest discover tests"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "bin"))

from chordpro import parse

import build
import pdf


class ChordDiagramTest(unittest.TestCase):
    def test_open_chord(self):
        diagram = pdf.chord_diagram("Am")
        self.assertEqual(diagram["frets"], [-1, 0, 2, 2, 1, 0])
        self.assertEqual(diagram["barres"], [])

    def test_barre_chord_covers_the_strings_it_bars(self):
        diagram = pdf.chord_diagram("F")
        self.assertEqual(diagram["barres"], [{"fret": 1, "from": 0, "to": 5}])
        self.assertEqual(diagram["frets"], [1, 3, 3, 2, 1, 1])

    def test_flat_german_and_alias_spellings_find_the_same_diagram(self):
        self.assertEqual(pdf.chord_diagram("Bb")["frets"], pdf.chord_diagram("A#")["frets"])
        self.assertEqual(pdf.chord_diagram("H")["frets"], pdf.chord_diagram("B")["frets"])
        self.assertEqual(pdf.chord_diagram("Ami")["frets"], pdf.chord_diagram("Am")["frets"])

    def test_things_that_are_not_chords_have_no_diagram(self):
        self.assertIsNone(pdf.chord_diagram("N.C."))
        self.assertIsNone(pdf.chord_diagram("(2x)"))


class LetterTest(unittest.TestCase):
    def test_letters(self):
        self.assertEqual(pdf.letter_of("ahoj"), "A")
        self.assertEqual(pdf.letter_of("Écho"), "E")
        self.assertEqual(pdf.letter_of("Čtyři"), "Č")
        self.assertEqual(pdf.letter_of("Chata"), "Ch")
        self.assertEqual(pdf.letter_of("(Cizí) věc"), "C")
        self.assertEqual(pdf.letter_of("1000 mil"), "#")
        self.assertEqual(pdf.letter_of("..."), "#")


class SectionsTest(unittest.TestCase):
    SONG = parse(
        "{title: T}\n"
        "{start_of_verse}\n[Am]One\n{end_of_verse}\n"
        "{start_of_chorus}\n[G]Two\n{end_of_chorus}\n"
        "{start_of_verse}\n[C]Three\n{end_of_verse}\n"
        "{chorus}\n"
    )

    def test_verses_are_numbered_and_choruses_marked(self):
        build.drop_default_labels(self.SONG)  # the build does this before the PDF
        labels = [(s["label"], s["rule"]) for s in pdf.sections_of(self.SONG)]
        self.assertEqual(labels, [("1", None), ("R", "accent"), ("2", None), ("R", "accent")])

    def test_chords_come_in_order_of_first_appearance(self):
        names = [d["name"] for d in pdf.chords_of(pdf.sections_of(self.SONG))]
        self.assertEqual(names, ["Am", "G", "C"])


if __name__ == "__main__":
    unittest.main()
