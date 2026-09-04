# Copyright (c) 2016-2025 Martin Donath <martin.donath@squidfunk.com>

"""Validate explicit anchors on headings and admonitions."""

import html
import re

from markdown.extensions import Extension
from markdown.treeprocessors import Treeprocessor
from markdown.util import HTML_PLACEHOLDER_RE


_findings = {}
_page = None


def begin_collection():
    """Reset findings before a MkDocs build."""

    global _findings, _page
    _findings = {}
    _page = None


def set_page(page):
    """Set the source page currently being converted."""

    global _page
    _page = page


def get_findings():
    """Return collected findings grouped by source page."""

    return _findings


def _plain_text(md, element):
    """Extract readable text, including stashed inline HTML such as code."""

    text = "".join(element.itertext()).strip()

    def restore(match):
        value = str(md.htmlStash.rawHtmlBlocks[int(match.group(1))])
        return re.sub(r"<[^>]+>", "", value)

    return html.unescape(HTML_PLACEHOLDER_RE.sub(restore, text))


class ExplicitAnchorTreeprocessor(Treeprocessor):
    """Require explicit IDs on selected headings and admonitions."""

    def __init__(
        self, md, heading_levels, ignore_ascii_headings,
        require_admonitions, ignored_titles, collect
    ):
        super().__init__(md)
        self.heading_tags = {f"h{level}" for level in heading_levels}
        self.ignore_ascii_headings = ignore_ascii_headings
        self.require_admonitions = require_admonitions
        self.ignored_titles = set(ignored_titles)
        self.collect = collect

    def run(self, root):
        missing = []

        for block in root.iter():
            if block.tag in self.heading_tags and not block.get("id"):
                title = _plain_text(self.md, block)
                if self.ignore_ascii_headings and (
                    title.isascii() and re.search(r"[A-Za-z]", title)
                ):
                    continue
                missing.append(f"heading {block.tag}: {title}")
                continue

            if not self.require_admonitions or block.get("id"):
                continue

            classes = set(block.get("class", "").split())
            if block.tag == "div" and "admonition" in classes:
                title = next((
                    child for child in block
                    if child.tag == "p" and
                    "admonition-title" in child.get("class", "").split()
                ), None)
            elif block.tag == "details":
                title = next(
                    (child for child in block if child.tag == "summary"),
                    None
                )
            else:
                continue

            text = _plain_text(self.md, title) if title is not None else ""
            if text not in self.ignored_titles:
                missing.append(f"admonition: {text}")

        if missing:
            if self.collect:
                _findings.setdefault(_page or "<unknown>", []).extend(missing)
                return root
            details = "\n".join(f"- {item}" for item in missing)
            raise ValueError(f"Explicit anchors are required:\n{details}")

        return root


class AnchorExtension(Extension):
    """Register explicit anchor validation."""

    def __init__(self, **kwargs):
        self.config = {
            "required_heading_levels": [
                [],
                "Heading levels that must have explicit anchors"
            ],
            "ignore_ascii_headings": [
                False,
                "Whether ASCII headings containing letters are exempt"
            ],
            "require_admonition_anchors": [
                False,
                "Whether admonitions must have explicit anchors"
            ],
            "ignored_admonition_titles": [
                [],
                "Admonition titles exempt from explicit anchor checks"
            ],
            "collect": [
                False,
                "Collect findings for the MkDocs plugin"
            ]
        }
        super().__init__(**kwargs)

    def extendMarkdown(self, md):
        heading_levels = self.getConfig("required_heading_levels")
        if not isinstance(heading_levels, (list, tuple)) or any(
            not isinstance(level, int) or isinstance(level, bool) or
            level < 1 or level > 6
            for level in heading_levels
        ):
            raise ValueError(
                "required_heading_levels must be a list of integers from 1 to 6"
            )

        ignored_titles = self.getConfig("ignored_admonition_titles")
        if not isinstance(ignored_titles, (list, tuple)) or any(
            not isinstance(title, str) for title in ignored_titles
        ):
            raise ValueError(
                "ignored_admonition_titles must be a list of strings"
            )

        md.registerExtension(self)
        md.treeprocessors.register(
            ExplicitAnchorTreeprocessor(
                md,
                heading_levels,
                self.getConfig("ignore_ascii_headings"),
                self.getConfig("require_admonition_anchors"),
                ignored_titles,
                self.getConfig("collect")
            ),
            "explicit_anchors", 7
        )


def makeExtension(**kwargs):
    """Return the Markdown extension."""

    return AnchorExtension(**kwargs)
