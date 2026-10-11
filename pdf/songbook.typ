// Songbook PDF ----------------------------------------------------------------------
// Layout of songbook.pdf: a cover, the contents, then every song on a page of its own.
// bin/pdf.py passes the songs as JSON in sys.inputs.data (see song_data() there).
// Sizes are written in CSS px (px(15)), as in the design, and converted to points.

#let data = json(bytes(sys.inputs.data))

#let px(n) = n * 0.75pt

#let ink = rgb("#1f1c17")
#let accent = rgb("#9a5b00")
#let muted = rgb("#6a6458")
#let hairline = rgb("#e0dccf")
#let paper = rgb("#fbfaf7")

// "amber" floods the cover; "paper" prints it white with an amber staff (saves ink)
#let cover-tone = "amber"

// The second font is the one bundled with Typst, used when IBM Plex is not in pdf/fonts
#let sans = ("IBM Plex Sans", "Libertinus Serif")
#let serif = ("IBM Plex Serif", "Libertinus Serif")
#let mono = ("IBM Plex Mono", "DejaVu Sans Mono")

#set document(title: data.title)
#set page(paper: "a4")
#set text(font: sans, lang: "cs", fill: ink, size: px(15), hyphenate: false, top-edge: "ascender", bottom-edge: "descender")
#set par(leading: 0.2em, spacing: 0pt, justify: false)
#set block(spacing: 0pt)

// Cover ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// The note of web/icon.svg
#let note(color) = image(
  bytes(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='" + color.to-hex() + "'>"
      + "<path d='M6 13c0 1.105-1.12 2-2.5 2S1 14.105 1 13s1.12-2 2.5-2 2.5.896 2.5 2m9-2c0 1.105-1.12 2-2.5 2s-2.5-.895-2.5-2 1.12-2 2.5-2 2.5.895 2.5 2'/>"
      + "<path fill-rule='evenodd' d='M14 11V2h1v9zM6 3v10H5V3z'/>"
      + "<path d='M5 2.905a1 1 0 0 1 .9-.995l8-.8a1 1 0 0 1 1.1.995V3L5 4z'/></svg>",
  ),
  format: "svg",
  width: px(320),
)

#let cover() = {
  let amber = cover-tone == "amber"
  let bg = if amber { accent } else { white }
  let fg = if amber { paper } else { ink }
  let staff = if amber { paper.transparentize(45%) } else { accent }

  page(margin: 0pt, fill: bg, footer: none, header: none)[
    #set text(fill: fg)
    #for y in (330, 356, 382, 408, 434) {
      place(top + left, dy: px(y), line(length: 100%, stroke: px(2) + staff))
    }
    #place(top + left, dx: px(372), dy: px(110), note(if amber { paper } else { accent }))
    #place(top + left, dx: px(72), dy: px(72), text(font: mono, weight: 600, size: px(14), tracking: 0.18em)[#upper("Texty a akordy")])
    #place(top + left, dx: px(72), dy: px(640), block(width: 100% - px(144))[
      #set par(leading: 0.08em)
      #text(font: serif, weight: 700, size: px(116), tracking: -0.01em)[#data.title]
      #v(px(28))
      #block(width: px(460), text(size: px(24))[Písně na kytaru, každá se svými akordy.])
    ])
    #place(bottom + left, dx: px(72), dy: -px(64), block(
      width: 100% - px(144),
      stroke: (top: px(2) + fg),
      inset: (top: px(16)),
      text(font: mono, weight: 500, size: px(14))[#data.songs.len() písní #h(1fr) Sestaveno #data.date],
    ))
  ]
}

// Running parts of the pages ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Queries run once per page and the book may have thousands of songs, so they use selectors (done natively)
// instead of filtering in script.

// The song a page belongs to: the last one started on or before the page
#let song-here() = {
  let started = query(selector(<song-start>).before(here()))
  if started.len() == 0 { none } else { started.last().value }
}

#let footer() = context {
  let n = here().page()
  let song = song-here()
  let brand = data.title
  let source = if song == none { none } else [verze: #song.source]
  let number = text(font: mono, weight: 600, size: px(15), fill: ink)[#n]
  set text(size: px(13), fill: muted)
  block(width: 100%, stroke: (top: 0.75pt + hairline), inset: (top: px(10)), {
    // Page numbers sit on the outer edge: right on odd pages, left on even ones
    if calc.odd(n) {
      grid(columns: (1fr, 1fr, 1fr), align: (left, center, right), brand, source, number)
    } else {
      grid(columns: (1fr, 1fr, 1fr), align: (left, center, right), number, source, brand)
    }
  })
}

// Pages after the first of a song carry its title, so a loose page can be told from the rest
#let running-head() = context {
  let n = here().page()
  let song = song-here()
  let next = query(selector(<song-start>).after(here()))
  let starts-here = next.len() > 0 and next.first().location().page() == n
  if song != none and not starts-here {
    set text(size: px(13), fill: muted)
    song.title + [ #sym.dash.en pokračování]
  }
}

// Contents ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

#let leader = box(width: 1fr, inset: (x: px(6)), repeat(gap: px(3), text(fill: muted)[.]))

#let contents-entry(song) = {
  let target = label("song-" + song.id)
  let page-number = context {
    let found = query(target)
    if found.len() > 0 { text(font: mono, weight: 600, size: px(16))[#found.first().location().page()] }
  }
  link(target, block(width: 100%, {
    set par(hanging-indent: px(16))
    text(weight: 500, size: px(18))[#song.title]
    if song.artist != none [ #h(px(4)) #text(size: px(14), fill: muted)[#song.artist]]
    leader
    page-number
  }))
}

#let letter-group(group) = block(width: 100%, breakable: true, inset: (y: px(12)), stroke: (bottom: 0.75pt + hairline), {
  grid(
    columns: (px(56), 1fr),
    row-gutter: px(10),
    ..group.songs.enumerate().map(((i, song)) => (
      if i == 0 { text(font: serif, weight: 700, size: px(40), fill: accent)[#group.letter] } else { [] },
      contents-entry(song),
    )).flatten(),
  )
})

// The "how to read" legend: a sample in a frame, a line of explanation below
#let legend-cell(sample, caption) = block(breakable: false, {
  block(width: 100%, height: px(72), stroke: 0.75pt + ink, radius: px(8), inset: (x: px(14), y: px(12)), align(horizon, sample))
  v(px(10))
  text(size: px(13))[#caption]
})

#let legend() = block(breakable: false, {
  text(font: mono, weight: 600, size: px(12), fill: muted, tracking: 0.14em)[#upper("Jak číst zpěvník")]
  v(px(14))
  grid(
    columns: (1fr,) * 4,
    column-gutter: px(16),
    legend-cell(
      box(baseline: px(4), stack(dir: ttb,
        text(font: mono, weight: 600, size: px(13), fill: accent)[Am#h(px(8))],
        text(size: px(16))[Jednou],
      )) + box(baseline: px(4), stack(dir: ttb,
        text(font: mono, weight: 600, size: px(13), fill: accent)[Em],
        text(size: px(16))[ se],
      )),
      [Akord stojí nad slabikou, na které se mění.],
    ),
    legend-cell(
      text(font: mono, weight: 600, size: px(12), fill: muted)[2#h(px(8))] + text(size: px(16))[text druhé sloky],
      [Číslo vlevo označuje sloku.],
    ),
    legend-cell(
      text(font: mono, weight: 600, size: px(12), fill: accent)[R#h(px(8))]
        + box(stroke: (left: 1.5pt + accent), inset: (left: px(8)), text(size: px(16))[text refrénu]),
      [Refrén má svislou linku a značku R.],
    ),
    legend-cell(
      grid(
        columns: (1fr, auto),
        align: horizon,
        text(size: px(15), style: "italic", fill: muted)[4x],
        box(stroke: 0.75pt + ink, radius: px(6), inset: (x: px(8), y: px(3)), text(font: mono, weight: 600, size: px(14))[Capo 2]),
      ),
      [Kurzíva je poznámka; capo se přikládá na uvedený pražec.],
    ),
  )
})

#let contents() = {
  block(width: 100%, stroke: (bottom: 1.5pt + ink), inset: (bottom: px(16)), below: px(16), grid(
    columns: (1fr, auto),
    align: bottom,
    text(font: serif, weight: 700, size: px(44))[Obsah],
    align(right, text(size: px(14), fill: muted)[Podle abecedy \ vždy výchozí verze písně]),
  ))
  // A long list runs in two columns, a short one stays a single column
  let groups = data.contents.map(letter-group).join()
  if data.songs.len() > 24 { columns(2, gutter: px(28), groups) } else { groups }
  v(px(28))
  legend()
}

// Chord diagrams ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Frets are listed per string from the low E: -1 muted, 0 open (see chord_diagram() in bin/pdf.py).
#let diagram(chord, k) = {
  let sx = px(8 * k)
  let sy = px(12 * k)
  let dot = px(7.5 * k)
  let ytop = px(19)
  let width = 5 * sx
  let height = 4 * sy
  let at(x, y, body) = place(top + left, dx: x, dy: y, body)

  align(center, stack(dir: ttb, spacing: px(2),
    text(font: mono, weight: 600, size: px(15))[#chord.name],
    box(width: width + px(20), height: ytop + height + px(3), {
      for i in range(6) {
        at(i * sx, ytop, line(start: (0pt, 0pt), end: (0pt, height), stroke: 0.75pt + ink))
      }
      for j in range(5) {
        let thick = j == 0 and chord.position == 1
        at(0pt, ytop + j * sy, line(length: width, stroke: (if thick { 2.2pt } else { 0.75pt }) + ink))
      }
      if chord.position > 1 {
        at(width + px(5), ytop + sy * 0.5 - px(5), text(size: px(10), fill: muted)[#chord.position fr])
      }
      for (i, fret) in chord.frets.enumerate() {
        if fret == -1 {
          at(i * sx - px(4), ytop - px(16), text(font: mono, weight: 600, size: px(14))[×])
        } else if fret == 0 {
          at(i * sx - px(3.5), ytop - px(13), circle(radius: px(3.5), stroke: 1pt + ink))
        } else {
          at(i * sx - dot / 2, ytop + (fret - 0.5) * sy - dot / 2, circle(radius: dot / 2, fill: ink, stroke: none))
        }
      }
      for barre in chord.barres {
        at(barre.from * sx - dot / 2, ytop + (barre.fret - 0.5) * sy - dot / 2, rect(
          width: (barre.to - barre.from) * sx + dot,
          height: dot,
          radius: dot / 2,
          fill: ink,
          stroke: none,
        ))
      }
    }),
  ))
}

#let small-heading(body) = text(font: mono, weight: 600, size: px(12), fill: muted, tracking: 0.14em)[#upper(body)]

// Songs ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// A line of chords over lyrics: each [chord, lyric] pair is a box with the chord on top
#let chord-line(segs, size) = {
  let chord-size = size * 0.83
  set par(leading: size * 0.15, hanging-indent: size * 0.8)
  // The lyric after the first chord needs no space before it: the chord has its own to the right
  let lead = segs.position(seg => seg.at(1).trim() != "")
  for (i, (chord, lyric)) in segs.enumerate() {
    // Spaces at the edge of a box would be dropped
    let text-part = (if i == lead { lyric.trim(at: start) } else { lyric }).replace(regex("^ "), "\u{a0}").replace(regex(" $"), "\u{a0}")
    box(baseline: size * 0.25, stack(dir: ttb,
      box(height: chord-size * 1.15, if chord != none {
        text(font: mono, weight: 600, size: chord-size, fill: accent)[#chord#h(chord-size * 0.6)]
      }),
      text(size: size)[#text-part],
    ))
    sym.zws // where a long line may wrap
  }
}

#let line-content(line, size, tab-size) = {
  if line.k == "chords" {
    chord-line(line.segs, size)
  } else if line.k == "note" {
    text(size: size * 0.93, style: "italic", fill: muted)[#line.t]
  } else if line.k == "tab" {
    show raw: set text(font: mono, size: tab-size, weight: 500)
    raw(line.t)
  } else {
    text(size: size)[#line.t]
  }
}

// One section: the label in the margin, a rule beside chorus and tab
#let section(sec, size, label-w, width) = {
  let rule = if sec.rule == "accent" { accent } else if sec.rule == "muted" { muted } else { none }
  let first-has-chords = sec.lines.len() > 0 and sec.lines.first().k == "chords"
  // A long label (a named interlude) would not fit the margin: it heads the section instead
  let long-label = sec.label.clusters().len() > 3
  let repeated = sec.lines.len() > 0 and sec.lines.first().k == "note" and sec.lines.first().t == sec.label
  let heading-label = text(font: mono, weight: 600, size: px(12), fill: muted)[#sec.label]
  // A tab is never wrapped, so it shrinks until its longest line fits
  let tab-chars = sec.lines.filter(line => line.k == "tab").map(line => line.t.clusters().len()).fold(1, calc.max)
  let tab-size = calc.min(px(13), (width - label-w - px(8) - px(14)) / (tab-chars * 0.6))
  let lines = sec.lines.map(line => block(width: 100%, line-content(line, size, tab-size)))
  block(width: 100%, breakable: sec.lines.len() > 12, grid(
    columns: (label-w, 1fr),
    column-gutter: px(8),
    if long-label { [] } else {
      pad(top: if first-has-chords { size * 0.83 * 1.15 } else { 0pt }, align(right, text(
        font: mono, weight: 600, size: px(12), fill: if sec.rule == "accent" { accent } else { muted },
      )[#sec.label]))
    },
    block(
      width: 100%,
      inset: (left: if rule == none { px(10) } else { px(8) }),
      stroke: if rule == none { none } else { (left: 1.5pt + rule) },
      stack(dir: ttb, spacing: size * 0.4, ..(if long-label and not repeated { (block(heading-label),) } else { () }), ..lines),
    ),
  ))
}

#let chip(label, value) = box(stroke: 0.75pt + ink, radius: px(8), inset: (x: px(12), y: px(6)), {
  set par(leading: px(4))
  text(size: px(12), weight: 500, fill: muted)[#label]
  linebreak()
  text(font: mono, weight: 600, size: px(20))[#value]
})

#let song-header(song) = block(width: 100%, stroke: (bottom: 1.5pt + ink), inset: (bottom: px(16)), grid(
  columns: (1fr, auto),
  column-gutter: px(24),
  align: bottom,
  {
    set par(leading: 0.1em)
    text(font: serif, weight: 700, size: px(36))[#song.title]
    if song.artist != none {
      v(px(8))
      text(size: px(17), fill: muted)[#song.artist]
    }
  },
  stack(dir: ltr, spacing: px(8),
    ..(
      if song.key != none { (chip([Tónina], song.key),) } else { () }
        + if song.capo != none { (chip([Capo], str(song.capo)),) } else { () }
    ),
  ),
))

// A song: one column beside a column of chords when it fits the page, else two balanced columns
// with the chords along the bottom. A song too long even for that flows on to the next page.
#let song-page(song) = {
  pagebreak(weak: true)
  [#metadata((title: song.title, source: song.source)) <song-start>]
  [#metadata(none)#label("song-" + song.id)]

  layout(size => {
    let head = song-header(song)
    let head-gap = px(26)
    let avail = size.height - measure(block(width: size.width, head)).height - head-gap
    let height-of(body, width) = measure(block(width: width, body)).height
    let stacked(items, gap) = stack(dir: ttb, spacing: gap, ..items)

    // One column
    let side-width = px(150)
    let column-gap = px(32)
    let has-chords = song.chords.len() > 0
    let single-width = if has-chords { size.width - side-width - column-gap } else { size.width }
    let single = stacked(song.sections.map(sec => section(sec, px(17), px(30), single-width)), px(20))
    let single-height = height-of(single, single-width)
    let side = {
      small-heading[Akordy]
      v(px(8))
      stacked(song.chords.map(c => diagram(c, 1.6)), px(14))
    }
    let side-height = height-of(side, side-width - px(28))
    if single-height <= avail and side-height <= avail {
      head
      v(head-gap)
      if has-chords {
        grid(
          columns: (1fr, side-width),
          column-gutter: column-gap,
          single,
          block(width: 100%, height: calc.max(single-height, side-height), stroke: (left: 0.75pt + ink), inset: (left: px(28)), side),
        )
      } else {
        single
      }
    } else {
      // Two columns of whole sections, split where the taller column is shortest. The text shrinks a
      // little before a song is allowed to run over to the next page.
      let gap = px(18)
      let col-width = (size.width - column-gap) / 2

      let per-row = calc.max(1, calc.floor((size.width - px(70)) / px(90)))
      let strip = block(width: 100%, stroke: (top: 0.75pt + ink), inset: (top: px(14), bottom: px(4)), grid(
        columns: (px(70), 1fr),
        align: top,
        small-heading[Akordy],
        grid(
          columns: (auto,) * calc.min(per-row, song.chords.len()),
          column-gutter: px(34),
          row-gutter: px(14),
          ..song.chords.map(c => diagram(c, 1.25)),
        ),
      ))
      let strip-height = if has-chords { height-of(strip, size.width) } else { 0pt }

      let plan-for(text-size) = {
        let items = song.sections.map(sec => section(sec, text-size, px(26), col-width))
        let heights = items.map(item => height-of(item, col-width))
        let count = items.len()
        let column-height(from, to) = if to <= from { 0pt } else { heights.slice(from, to).sum() + gap * (to - from - 1) }
        let split = count
        let tallest = column-height(0, count)
        for k in range(1, count) {
          let h = calc.max(column-height(0, k), column-height(k, count))
          if h < tallest {
            tallest = h
            split = k
          }
        }
        (items: items, split: split, fits: tallest + strip-height + gap <= avail)
      }
      let plan = plan-for(px(15))
      for text-px in (14, 13) {
        if plan.fits { break }
        plan = plan-for(px(text-px))
      }
      let (items, split) = plan

      head
      v(head-gap)
      if plan.fits {
        block(width: 100%, height: avail, {
          grid(
            columns: (1fr, 1fr),
            column-gutter: column-gap,
            stacked(items.slice(0, split), gap),
            stacked(items.slice(split), gap),
          )
          if has-chords { place(bottom, strip) }
        })
      } else {
        columns(2, gutter: column-gap, for item in items {
          item
          v(gap)
        })
        if has-chords {
          v(gap)
          strip
        }
      }
    }
  })
}

// Document ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

#cover()

#set page(
  paper: "a4",
  margin: (x: px(52), top: px(56), bottom: px(60)),
  header: running-head(),
  footer: footer(),
  footer-descent: px(12),
)

#contents()

#for song in data.songs {
  song-page(song)
}
