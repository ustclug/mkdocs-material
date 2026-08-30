# Copyright (c) 2016-2025 Martin Donath <martin.donath@squidfunk.com>

from mkdocs.config.base import Config
from mkdocs.config.config_options import Type


class ImageDimensionsConfig(Config):
    enabled = Type(bool, default = True)
