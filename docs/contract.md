# Lesson Press — Input Contract

This document is the canonical reference for what `lesson-press` accepts
as input. The renderer assumes inputs follow this contract exactly.

## File shape

- One `.md` file = one PDF.
- Files start with a YAML frontmatter block (`---` fenced).
- The body is standard CommonMark plus Pandoc fenced divs.
- One markdown file per lesson; image sidecars in adjacent files.

## Frontmatter keys

| Key | Type | Required | Behavior |
|---|---|---|---|
| `title` | string | yes | Titlepage title; running header |
| `subtitle` | string | no | Below title on titlepage |
| `author` | string | no | Defaults to `<unit> · <curriculum>` if both set |
| `week` | int | no | Decorative; rendered on titlepage |
| `unit` | string | no | |
| `curriculum` | string | no | |
| `scripture_text` | string | no | Titlepage block under gold rule |
| `big_idea` | string | no | Titlepage block |
| `memory_verse` | string | no | Titlepage block |
| `optional_video` | map | no | Titlepage block; see below |
| `toc` | bool | no | Show TOC after titlepage; default `false` |
| `titlepage` | bool | no | Emit titlepage at all; default `true` |

Unknown keys are silently ignored. Missing optional metadata never errors.

### `optional_video`

A nested map for surfacing a single supplemental video on the titlepage. Only `title` and one URL field are required; extras are ignored.

| Key | Type | Behavior |
|---|---|---|
| `title` | string | Video title, displayed under the `OPTIONAL VIDEO` label |
| `short_url` | string | Printed prominently. Preferred over `url` when both are present |
| `url` | string | Fallback URL when `short_url` is absent |

The block is omitted entirely when `optional_video` is missing.

## Block vocabulary

Twelve fenced-div classes, each rendered as a styled callout.

| Class | Purpose |
|---|---|
| `:::read` | Scripture reference pill |
| `:::scripture` | Passage block (reference + optional text) |
| `:::say` | Teacher script (spoken) |
| `:::ask` | Teacher question to the class |
| `:::prayer` | Prayer script |
| `:::discussion` | Group of numbered discussion questions |
| `:::question` | Single standalone question |
| `:::key-truth` | Lesson's central takeaway |
| `:::note` | Teacher aside |
| `:::transition` | Pedagogical bridge |
| `:::materials` | Supplies / materials checklist |
| `:::journal` | Directive for kids to write/draw in their personal journal |

### Discussion answers

Inside `:::discussion`, an italic-only paragraph as the last child of an
ordered-list item renders as the anticipated answer:

```markdown
:::discussion
1. What is X?

   *An expected answer.*

2. Why does it matter?
:::
```

### Unknown classes

Fenced divs with classes outside this vocabulary pass through untouched
— Pandoc emits the inner content with no callout decoration. This makes
vocabulary expansion safe (additive in future versions).

## Image sidecars

Reference images with plain Markdown, relative to the input file:

```markdown
![A diagram](images/seven-days.png)
```

Supported formats: PNG, JPEG, PDF (vector). SVG requires Inkscape on
host (not a default dependency). Obsidian's `![[wikilink-image.png]]`
syntax is **not** supported in v1.

## Worked example

See [`docs/examples/lesson-1.md`](examples/lesson-1.md) for a complete
lesson exercising the full contract.
