import unittest

from markdown import markdown


class AdmonitionExtensionTest(unittest.TestCase):

    def render(self, source):
        return markdown(source, extensions = [
            "admonition",
            "pymdownx.details",
            "material.extensions.admonition"
        ])

    def test_traditional_admonition_id_and_permalink(self):
        html = self.render('!!! note "Title" {#example}\n    Body')
        self.assertIn('<div class="admonition note" id="example">', html)
        self.assertIn('<a class="headerlink" href="#example"', html)

    def test_details_id_and_permalink(self):
        html = self.render('??? note "Title" {#details}\n    Body')
        self.assertIn('<details class="note" id="details">', html)
        self.assertIn('<a class="headerlink" href="#details"', html)

    def test_unanchored_output_has_no_permalink(self):
        html = self.render('!!! note "Title"\n    Body')
        self.assertNotIn("headerlink", html)


if __name__ == "__main__":
    unittest.main()
