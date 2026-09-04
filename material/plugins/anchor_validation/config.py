# Copyright (c) 2016-2025 Martin Donath <martin.donath@squidfunk.com>

from mkdocs.config.base import Config
from mkdocs.config.config_options import ListOfItems, Type


class AnchorValidationConfig(Config):
    required_heading_levels = ListOfItems(Type(int), default = [])
    ignore_ascii_headings = Type(bool, default = False)
    require_admonition_anchors = Type(bool, default = False)
    ignored_admonition_titles = ListOfItems(Type(str), default = [])
