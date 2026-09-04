import unittest

from types import SimpleNamespace

from markdown import markdown
from mkdocs.exceptions import PluginError

from material.plugins.anchor_validation.plugin import AnchorValidationPlugin


class AnchorValidationPluginTest(unittest.TestCase):

    def setUp(self):
        self.plugin = AnchorValidationPlugin()
        self.plugin.load_config({
            "required_heading_levels": [2],
            "ignore_ascii_headings": True,
            "require_admonition_anchors": True,
            "ignored_admonition_titles": ["Ignored"]
        })
        self.config = SimpleNamespace(
            markdown_extensions=["admonition", "attr_list", "toc"],
            mdx_configs={}
        )
        self.plugin.on_config(self.config)
        self.plugin.on_pre_build(config=self.config)

    def render_page(self, source, path):
        page = SimpleNamespace(file=SimpleNamespace(src_uri=path))
        source = self.plugin.on_page_markdown(
            source, page=page, config=self.config, files=None
        )
        return markdown(
            source,
            extensions=self.config.markdown_extensions,
            extension_configs=self.config.mdx_configs
        )

    def test_reports_all_pages_at_end_of_build(self):
        self.render_page("## 第一个", "first.md")
        self.render_page(
            '## 第二个\n\n!!! warning "Problem"\n    Body',
            "second.md"
        )

        with self.assertRaises(PluginError) as raised:
            self.plugin.on_post_build(config=self.config)

        message = str(raised.exception)
        self.assertIn("first.md\n  - heading h2: 第一个", message)
        self.assertIn("second.md\n  - heading h2: 第二个", message)
        self.assertIn("  - admonition: Problem", message)

    def test_ignores_configured_title_and_accepts_anchors(self):
        self.render_page(
            '## Section {#section}\n\n!!! note "Ignored"\n    Body',
            "valid.md"
        )
        self.assertIsNone(self.plugin.on_post_build(config=self.config))

    def test_ignores_ascii_heading(self):
        self.render_page("## English heading", "english.md")
        self.assertIsNone(self.plugin.on_post_build(config=self.config))
