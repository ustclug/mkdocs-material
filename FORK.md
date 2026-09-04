# USTCLUG maintenance fork

This repository is a maintenance fork of Material for MkDocs 9.7.x for
USTCLUG documentation projects that continue to use MkDocs 1.x.

The fork keeps upstream behavior unless a change fixes a reproducible defect
or a project explicitly enables an added extension or plugin.

## Included changes

- [Search behavior](#search-behavior) is adjusted for Chinese segmentation,
  hyphenated technical terms, stemmed or punctuation-wrapped terms, exact
  phrase ranking, and post-navigation highlighting.
- Code blocks receive unique copy targets when several blocks share an
  anchored ancestor.
- `material.extensions.admonition` adds opt-in IDs and permalinks to
  traditional admonitions and details blocks.
- `image-dimensions` adds opt-in intrinsic dimensions to local raster and SVG
  images. It requires Pillow, which is available through the `imaging` extra.
- Google Fonts stylesheets load asynchronously, so an unavailable font service
  doesn't block the initial render and the system fallback remains usable.

## Search behavior

These changes retain Lunr's normal field boosts, query syntax, prefix search,
stemming, and stop-word handling. They correct specific cases where the query
transformation, ranking, or navigation behavior produced a misleading result.

### Chinese query segmentation

A continuous run of Han characters is segmented from left to right using the
longest term already present in the inverted index. Every resulting segment is
required and retains a trailing wildcard for search-as-you-type. A complete
indexed term is kept intact, the last character is no longer dropped, and an
unmatched suffix is preserved as a prefix query.

Counterexample: given indexed terms `实时` and `调度`, the query `实时调度` used
to become optional prefix terms. A document containing only the common
one-character or partial term could therefore appear, while a segmentation bug
could also omit the final character. The fork produces `+实时* +调度*`, so a
result must match both parts. Given an indexed complete term `系统管理员`, the
same query stays one term instead of being unnecessarily split. Given a
partially typed `网络配`, the unmatched `配` is retained rather than discarded.

### Hyphenated technical terms

For simple hyphenated words, all searchable components must match. Documents
containing the exact hyphenated spelling receive a bounded relevance boost.
Stop words removed by the configured pipeline do not make the compound
impossible to match. URLs, command-line options, prohibited terms, and other
complex query syntax are not treated as compounds by this rule.

Counterexample: Material's separator splits `pre-commit` into the optional
terms `pre` and `commit`. A section titled "Commit Message Convention" could
then outrank the section that actually documents `pre-commit`, because the
title boost is much larger than the body-text boost. The fork rejects results
that match only `commit` and ranks literal `pre-commit` occurrences above
documents that merely contain both words separately. This does not change the
query `pre commit`, which intentionally remains an OR query.

### Stemmed and punctuation-wrapped terms

Query terms are passed through the configured Lunr search pipeline before an
automatic wildcard is added. When stemming changes a term, the normalized term
is searched without a wildcard, because Lunr disables its search pipeline for
wildcard queries. During indexing, a token surrounded by punctuation also gets
an alias without the leading and trailing punctuation.

Counterexample: the English stemmer normalizes `Relative` to `relat`. Searching
for `Relative*` bypasses stemming and therefore cannot find the indexed
`relat`. In prose such as `（Relative Distinguished Name，RDN）`, tokenizer
boundaries can additionally leave `Relative` attached to full-width
punctuation. The fork searches the normalized term and indexes an unwrapped
alias, so this occurrence is discoverable. This alias only strips punctuation
at token boundaries; it does not rewrite punctuation inside a term.

### Exact multi-term phrase ranking

A simple query containing two or more whitespace-separated words receives an
additional bounded score when the original phrase occurs verbatim, ignoring
case, collapsed whitespace, zero-width spaces, and search-result markup. The
normal Lunr results are still used; this is a post-query ranking signal, not a
phrase-search filter. Field selectors, modifiers, and other complex syntax are
excluded from this extra boost.

Counterexample: for `x server`, Lunr's prefix matching and title boost can rank
a heading named `XFS` first: `x*` matches the `xf` stem in that title, even
though the section says nothing about an X server. The fork boosts the section
whose text actually contains `X server`, placing it above the prefix-only title
match. A query such as `x server` can still return documents containing the two
terms separately; they simply do not receive the exact-phrase boost.

### Highlight terms and in-section navigation

When `search.highlight` is enabled, result URLs use the original query terms
for highlighting instead of their stemmed index representation. After the
marks are inserted, navigation starts at the result's section anchor and then
scrolls the first highlighted occurrence at or after that anchor into the
center of the viewport. Matches earlier on the same page are ignored for this
scroll decision.

Counterexample: the English stemmer turns `XFS` into `xf`. The previous result
URL was `?h=xf#xfs`, so only the `XF` substring was highlighted. The fork emits
`?h=xfs#xfs`, which highlights the complete term. Separately, if a matching
sentence is halfway through a long section, normal hash navigation stops at
the heading and leaves the match off-screen; the fork continues to the first
actual mark within or after that section. If the heading itself contains the
term, its mark remains the first match and no unnecessary deeper jump occurs.

Enable this navigation behavior with the existing Material feature flag:

```yaml
theme:
  features:
    - search.highlight
```

## Installation

Until this fork has a separate package name and release channel, install a
reviewed commit directly from Git:

```text
mkdocs-material @ git+https://github.com/ustclug/mkdocs-material.git@COMMIT
```

Pin a commit rather than a branch so documentation builds remain reproducible.

## Configuration

Enable anchored admonitions as a Markdown extension:

```yaml
markdown_extensions:
  - admonition
  - pymdownx.details
  - material.extensions.admonition
```

The traditional syntax accepts an ID after the optional title:

```markdown
!!! note "Title" {#stable-id}
    Content

??? note "Collapsible title" {#collapsible-id}
    Content
```

The `material/anchor-validation` plugin can require explicit anchors on
selected heading levels and admonitions. Admonitions with an exact plain-text
title match can be exempted. It reports all violations across the site before
failing the build:

```yaml
plugins:
  - material/anchor-validation:
      required_heading_levels: [2, 3, 4, 5, 6]
      ignore_ascii_headings: true
      require_admonition_anchors: true
      ignored_admonition_titles:
        - Main authors
        - Work in progress
```

Both checks are disabled by default. The plugin enables its Markdown extension
automatically. Heading validation runs after `attr_list` has applied explicit
IDs and before `toc` generates automatic IDs. When `ignore_ascii_headings` is
enabled, headings consisting entirely of ASCII characters and containing at
least one English letter are exempt; mixed-language headings are not.

Enable intrinsic image dimensions as a plugin:

```yaml
plugins:
  - image-dimensions
  - search
```

Local images without author-provided sizing receive intrinsic `width` and
`height`. If the author supplies only one dimension, the plugin preserves it
and adds `aspect-ratio`. Remote and missing images are left unchanged.

## Upstream synchronization

Keep `https://github.com/squidfunk/mkdocs-material.git` configured as the
`upstream` remote. Import upstream maintenance and security fixes separately
from fork-specific feature commits, and rerun:

```console
npm test
npm run check
npm run build:all
python -m unittest discover -s tools/tests -p "test_*.py"
python -m build --wheel
```
