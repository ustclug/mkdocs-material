# USTCLUG maintenance fork

This repository is a maintenance fork of Material for MkDocs 9.7.x for
USTCLUG documentation projects that continue to use MkDocs 1.x.

The fork keeps upstream behavior unless a change fixes a reproducible defect
or a project explicitly enables an added extension or plugin.

## Included changes

- Chinese queries use complete, required prefix terms instead of ambiguous
  one-character OR matches.
- Hyphenated technical terms require all components and prioritize complete
  matches, so queries such as `pre-commit` don't get dominated by `commit`.
- Code blocks receive unique copy targets when several blocks share an
  anchored ancestor.
- `material.extensions.admonition` adds opt-in IDs and permalinks to
  traditional admonitions and details blocks.
- `image-dimensions` adds opt-in intrinsic dimensions to local raster and SVG
  images. It requires Pillow, which is available through the `imaging` extra.
- Google Fonts stylesheets load asynchronously, so an unavailable font service
  doesn't block the initial render and the system fallback remains usable.

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
