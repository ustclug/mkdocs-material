# Copyright (c) 2016-2025 Martin Donath <martin.donath@squidfunk.com>

"""Collect and report missing explicit anchors across a MkDocs build."""

from collections import Counter
from html.parser import HTMLParser

from mkdocs.exceptions import PluginError
from mkdocs.plugins import BasePlugin

from material.extensions import anchors

from .config import AnchorValidationConfig


class _IdCollector(HTMLParser):

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []

    def handle_starttag(self, tag, attrs):
        self.ids.extend(
            value for name, value in attrs
            if name.lower() == "id" and value is not None
        )


class AnchorValidationPlugin(BasePlugin[AnchorValidationConfig]):

    def on_config(self, config):
        extension = "material.extensions.anchors"
        if extension not in config.markdown_extensions:
            config.markdown_extensions.append(extension)
        config.mdx_configs[extension] = {
            "required_heading_levels": self.config.required_heading_levels,
            "ignore_ascii_headings": self.config.ignore_ascii_headings,
            "require_admonition_anchors": (
                self.config.require_admonition_anchors
            ),
            "ignored_admonition_titles": (
                self.config.ignored_admonition_titles
            ),
            "collect": True
        }
        return config

    def on_pre_build(self, *, config):
        anchors.begin_collection()

    def on_page_markdown(self, markdown, *, page, config, files):
        anchors.set_page(page.file.src_uri)
        return markdown

    def on_page_content(self, html, *, page, config, files):
        if not self.config.check_duplicate_anchors:
            return html

        collector = _IdCollector()
        collector.feed(html)
        duplicates = [
            f"duplicate anchor: #{anchor} ({count} occurrences)"
            for anchor, count in Counter(collector.ids).items()
            if count > 1
        ]
        if duplicates:
            anchors.add_findings(page.file.src_uri, duplicates)
        return html

    def on_post_build(self, *, config):
        findings = anchors.get_findings()
        if not findings:
            return

        lines = ["Explicit anchors are required:"]
        for page, problems in findings.items():
            lines.append(page)
            lines.extend(f"  - {problem}" for problem in problems)
        raise PluginError("\n".join(lines))
