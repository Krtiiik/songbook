import argparse
from pathlib import Path
import re
import shutil
import urllib.request

from pylatexenc.latexwalker import LatexCharsNode, LatexGroupNode, LatexMacroNode, LatexWalker

from common import sanitize_filename


BRATR_URL = "https://raw.githubusercontent.com/martisekpetr/bratruv-zpevnik/master/zpevnik.tex"


parser = argparse.ArgumentParser(description="Scrape the Bratr songbook")
parser.add_argument("--output", default=Path("songs") / "bratr", type=Path, help="Output directory for scraped songs")


def latex_group_to_text(node, tex: str):
    if isinstance(node, (LatexCharsNode, LatexGroupNode, LatexMacroNode)):
        return tex[node.pos: node.pos + node.len]
    return ""


def iter_latex_nodes(nodes):
    for node in nodes:
        yield node
        if hasattr(node, "nodelist"):
            yield from iter_latex_nodes(node.nodelist)


def scrape_songs_data(url: str):
    with urllib.request.urlopen(url, timeout=30) as response:
        tex = response.read().decode("utf-8", errors="replace")

    root_nodes, _, _ = LatexWalker(tex).get_latex_nodes()
    all_nodes = list(iter_latex_nodes(root_nodes))
    songs = []
    i = 0
    while i < len(all_nodes):
        node = all_nodes[i]
        if isinstance(node, LatexMacroNode) and node.macroname == "song":
            args = []
            j = i + 1
            while j < len(all_nodes) and len(args) < 5:
                current = all_nodes[j]
                if isinstance(current, LatexGroupNode):
                    args.append(latex_group_to_text(current, tex))
                j += 1
            if len(args) >= 5:
                title = normalize_latex_literal(args[0]).strip() or "Untitled"
                artist = normalize_latex_literal(args[1]).strip()
                body = args[4].strip()
                if len(body) >= 2 and body[0] == "{" and body[-1] == "}":
                    body = body[1:-1]
                songs.append({
                    "title": title,
                    "artist": artist,
                    "body": body,
                })
                i = j
                continue
        i += 1

    return songs


def read_braced_segment(text: str, start_index: int) -> tuple[str, int]:
    """Read a { ... } block with nested braces from the opening brace at start_index."""
    depth = 0
    result: list[str] = []
    i = start_index
    while i < len(text):
        ch = text[i]
        if ch == "{":
            depth += 1
            if depth > 1:
                result.append(ch)
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return "".join(result), i + 1
            result.append(ch)
        else:
            result.append(ch)
        i += 1
    raise ValueError("Unterminated braced segment")


def read_bracketed_segment(text: str, start_index: int) -> tuple[str, int]:
    """Read a [ ... ] block with nested brackets from the opening bracket at start_index."""
    depth = 0
    result: list[str] = []
    i = start_index
    while i < len(text):
        ch = text[i]
        if ch == "[":
            depth += 1
            if depth > 1:
                result.append(ch)
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return "".join(result), i + 1
            result.append(ch)
        else:
            result.append(ch)
        i += 1
    raise ValueError("Unterminated bracketed segment")


def parse_tex_command(text: str, index: int) -> tuple[str, str | None, str | None, int]:
    if text[index] != "\\":
        raise ValueError("parse_tex_command expects a backslash")

    i = index + 1
    while i < len(text) and (text[i].isalpha() or text[i] in "@_"):
        i += 1
    command = text[index + 1 : i]

    optional = None
    if i < len(text) and text[i] == "[":
        optional, i = read_bracketed_segment(text, i)

    content = None
    if i < len(text) and text[i] == "{":
        content, i = read_braced_segment(text, i)

    return command, optional, content, i


def normalize_latex_literal(value: str) -> str:
    value = re.sub(r"\\[A-Za-z]+(?:\[[^\]]*\])?", "", value)
    value = value.replace("\\sharp", "#")
    value = value.replace("\\flat", "b")
    value = value.replace("\\textbf", "")
    value = value.replace("\\emph", "")
    value = value.replace("\\uv", "")
    value = value.replace("\\", "")
    value = value.replace("$", "")
    value = value.replace("{", "").replace("}", "")
    value = value.replace("~", " ")
    value = value.replace("\r", "")
    return value.strip()


def chord_base_name(symbol: str) -> str:
    mapping = {
        "A": "A",
        "Am": "Am",
        "B": "B",
        "Bm": "Bm",
        "C": "C",
        "Cm": "Cm",
        "D": "D",
        "Dm": "Dm",
        "E": "E",
        "Em": "Em",
        "F": "F",
        "Fm": "Fm",
        "G": "G",
        "Gm": "Gm",
        "H": "B",
        "Hm": "Bm",
        "Csm": "C#m",
        "Dsm": "D#m",
        "Esm": "E#m",
        "Fsm": "F#m",
        "Gsm": "G#m",
        "Asm": "A#m",
        "Bsm": "B#m",
    }
    return mapping.get(symbol, symbol)


def chord_from_tex(command: str, optional: str | None) -> str:
    base = chord_base_name(command)
    variant = normalize_latex_literal(optional or "")
    if not variant:
        return base

    if variant.startswith("/"):
        return f"{base}{variant}"

    if "/" in variant:
        left, right = variant.split("/", 1)
        if left:
            return f"{base}{left}/{right}"
        return f"{base}/{right}"

    return f"{base}{variant}"


def render_tex_to_chordpro(tex: str) -> str:
    result: list[str] = []
    i = 0
    while i < len(tex):
        if tex[i] == "\\":
            command, optional, content, next_index = parse_tex_command(tex, i)

            if command in {"printchords"}:
                if content:
                    result.append(render_tex_to_chordpro(content))
                i = next_index
                continue

            if command in {"verse", "chorus", "bridge", "intro", "outro", "interlude", "instrumental"}:
                section_type = {
                    "verse": "verse",
                    "chorus": "chorus",
                    "bridge": "bridge",
                    "intro": "intro",
                    "outro": "outro",
                    "interlude": "interlude",
                    "instrumental": "instrumental",
                }[command]
                result.append(f"{{start_of_{section_type}}}\n")
                i = next_index
                continue

            if command == "capo":
                capo = normalize_latex_literal(content or "")
                if capo:
                    result.append(f"{{capo: {capo}}}")
                i = next_index
                continue

            if command == "textbf":
                if content:
                    result.append(normalize_latex_literal(content))
                i = next_index
                continue

            if command == "uv":
                if content:
                    result.append(f'"{normalize_latex_literal(content)}"')
                i = next_index
                continue

            if command in {"clearpage", "medskip", "vskip", "hskip", "smallskip", "raggedcolumns", "centering", "hspace", "vspace", "noindent", "parskip", "vfill", "newpage"}:
                i = next_index
                while i < len(tex) and tex[i].isspace():
                    i += 1
                while i < len(tex) and not tex[i].isspace() and tex[i] != "\\" and tex[i] not in "\r\n":
                    i += 1
                continue

            if command == "setlength":
                i = next_index
                while i < len(tex) and tex[i].isspace():
                    i += 1
                if i < len(tex) and tex[i] == "{":
                    _, i = read_braced_segment(tex, i)
                while i < len(tex) and tex[i].isspace():
                    i += 1
                if i < len(tex) and tex[i] == "{":
                    _, i = read_braced_segment(tex, i)
                continue

            if command == "crdheight":
                i = next_index
                while i < len(tex) and tex[i] not in "\r\n":
                    i += 1
                continue

            if command in {"ldots", "ldotp", "textemdash", "textendash", "dots", "quad"}:
                result.append({"ldots": "...", "ldotp": ".", "textemdash": "—", "textendash": "-", "dots": "...", "quad": " "}.get(command, ""))
                i = next_index
                continue

            if command in {"revrpt", "rpt"}:
                result.append("{comment: Refrén}")
                i = next_index
                continue

            if command in {"A", "Am", "B", "Bm", "C", "Cm", "D", "Dm", "E", "Em", "F", "Fm", "G", "Gm", "H", "Hm", "Csm", "Dsm", "Esm", "Fsm", "Gsm", "Asm", "Bsm"}:
                value = chord_from_tex(command, optional)
                result.append(f"[{value}]")
                if content:
                    result.append(render_tex_to_chordpro(content))
                i = next_index
                continue

            if content:
                result.append(render_tex_to_chordpro(content))
            i = next_index
            continue

        if tex.startswith("\\\\", i):
            result.append("\n")
            i += 2
            continue

        if tex[i] == "%":
            newline = tex.find("\n", i)
            if newline == -1:
                break
            i = newline + 1
            continue

        if tex[i] in "\r\n":
            result.append("\n")
            i += 1
            continue

        if tex[i] == "~":
            result.append(" ")
            i += 1
            continue

        result.append(tex[i])
        i += 1

    return "".join(result)


def close_section_markers(text: str) -> str:
    section_types = ["verse", "chorus", "bridge", "intro", "outro", "interlude", "instrumental"]
    pattern = r"\{start_of_(" + "|".join(section_types) + r")\}"
    matches = list(re.finditer(pattern, text))
    if not matches:
        return text

    pieces = []
    cursor = 0
    for index, match in enumerate(matches):
        section_type = match.group(1)
        pieces.append(text[cursor:match.start()])
        pieces.append(match.group(0))
        next_start = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        pieces.append(text[match.end():next_start])
        pieces.append(f"{{end_of_{section_type}}}\n")
        cursor = next_start
    pieces.append(text[cursor:])
    return "".join(pieces)


def bratr_to_chordpro(song, index: int):
    lines = [
        f"{{title: {song['title']}}}",
        f"{{artist: {song['artist']}}}",
        "{meta: source Bratrův zpěvník}",
        f"{{meta: url https://bratruvzpevnik.cz/#/song/{index}}}",
        "",
    ]

    rendered = render_tex_to_chordpro(song["body"])
    rendered = close_section_markers(rendered)
    rendered = rendered.replace("\r", "")
    rendered = re.sub(r"\n{3,}", "\n\n", rendered)
    rendered = rendered.strip()
    if rendered:
        lines.extend(rendered.splitlines())
    lines.append("")
    return "\n".join(lines).strip() + "\n"


def scrape(output: Path):
    songs = scrape_songs_data(BRATR_URL)

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True, exist_ok=True)

    for index, song in enumerate(songs):
        song_chordpro = bratr_to_chordpro(song, index)
        safe_title = sanitize_filename(song['title'])
        safe_artist = sanitize_filename(song['artist'])
        song_file = output / f"{safe_title} - {safe_artist}.cho"
        with open(song_file, "w", encoding="utf8") as f:
            f.write(song_chordpro)


if __name__ == "__main__":
    args = parser.parse_args([] if "__file__" not in globals() else None)
    scrape(args.output)
