import unittest

from markdown import markdown


class AnchorExtensionTest(unittest.TestCase):

    def render(self, source, config = None):
        extension = "material.extensions.anchors"
        configs = {extension: config} if config else {}
        return markdown(source, extensions = [
            "admonition",
            "attr_list",
            "pymdownx.details",
            "toc",
            "material.extensions.admonition",
            extension
        ], extension_configs = configs)

    def test_requires_configured_heading_levels(self):
        config = {"required_heading_levels": [2, 3]}
        source = "# Title\n\n## Anchored {#anchored}\n\n### Missing"

        with self.assertRaisesRegex(ValueError, "heading h3: Missing"):
            self.render(source, config)

    def test_toc_generated_heading_id_is_not_explicit(self):
        with self.assertRaisesRegex(ValueError, "heading h2: Section"):
            self.render("## Section", {"required_heading_levels": [2]})

    def test_reports_inline_code_as_plain_text(self):
        with self.assertRaisesRegex(ValueError, "heading h2: command"):
            self.render("## `command`", {"required_heading_levels": [2]})

    def test_can_ignore_ascii_headings_containing_letters(self):
        config = {
            "required_heading_levels": [2],
            "ignore_ascii_headings": True
        }
        html = self.render("## Proxmox VE (PVE) 8.4", config)
        self.assertIn("Proxmox VE (PVE) 8.4", html)

    def test_does_not_ignore_mixed_language_headings(self):
        config = {
            "required_heading_levels": [2],
            "ignore_ascii_headings": True
        }
        with self.assertRaisesRegex(ValueError, "heading h2: Linux 配置"):
            self.render("## Linux 配置", config)

    def test_does_not_ignore_ascii_headings_without_letters(self):
        config = {
            "required_heading_levels": [2],
            "ignore_ascii_headings": True
        }
        with self.assertRaisesRegex(ValueError, "heading h2: 123"):
            self.render("## 123", config)

    def test_does_not_require_unconfigured_heading_levels(self):
        html = self.render(
            "# Title\n\n## Section {#section}",
            {"required_heading_levels": [2, 3, 4, 5, 6]}
        )
        self.assertIn('<h1 id="title">Title</h1>', html)

    def test_requires_admonition_anchors(self):
        with self.assertRaisesRegex(ValueError, "admonition: Missing"):
            self.render(
                '!!! note "Missing"\n    Body',
                {"require_admonition_anchors": True}
            )

    def test_ignores_configured_admonition_titles(self):
        html = self.render(
            '!!! note "主要作者"\n    Body',
            {
                "require_admonition_anchors": True,
                "ignored_admonition_titles": ["主要作者"]
            }
        )
        self.assertIn('<p class="admonition-title">主要作者</p>', html)

    def test_validates_collapsible_admonitions(self):
        with self.assertRaisesRegex(ValueError, "admonition: Details"):
            self.render(
                '??? note "Details"\n    Body',
                {"require_admonition_anchors": True}
            )

    def test_rejects_invalid_heading_levels(self):
        with self.assertRaisesRegex(ValueError, "integers from 1 to 6"):
            self.render("# Title", {"required_heading_levels": [0, 7]})


if __name__ == "__main__":
    unittest.main()
