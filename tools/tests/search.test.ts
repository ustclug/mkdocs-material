/// <reference path="../../typings/lunr/index.d.ts" />

/*
 * Copyright (c) 2016-2025 Martin Donath <martin.donath@squidfunk.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import assert from "node:assert/strict"
import test from "node:test"
import lunr from "lunr"

import { Search } from "../../src/templates/assets/javascripts/integrations/search/_"

/* Expose Lunr in the same way as the search worker */
Object.assign(globalThis, { lunr })

const createSearch = (
  pipeline: ("stemmer" | "stopWordFilter")[] = ["stemmer"]
): Search => {
  return new Search({
    config: {
      lang: ["en"],
      separator: "[\\s\\-]+",
      pipeline,
      fields: {
        title: { boost: 1e3 },
        text: { boost: 1e0 },
        tags: { boost: 1e6 }
      }
    },
    docs: [
      {
        location: "docs/dev/vcs/git/",
        title: "Git Usage",
        text: ""
      },
      {
        location: "docs/dev/vcs/git/#git-commit-message",
        title: "Commit Message Convention",
        text: "commit messages"
      },
      {
        location: "docs/dev/vcs/git/#git-rebase-merge",
        title: "Rebase and Merge",
        text: "pre-commit can check merge commits"
      },
      {
        location: "docs/dev/vcs/git/#git-hooks",
        title: "Git Hook",
        text: "pre-commit runs before each commit; pre-commit is configurable"
      }
    ],
    options: { suggest: false }
  })
}

void test("prioritizes an exact hyphenated term over a partial title match", () => {
  const [group] = createSearch().search("pre-commit").items
  assert.equal(group[0].location, "docs/dev/vcs/git/#git-hooks")
  assert.equal(group[1].location, "docs/dev/vcs/git/#git-rebase-merge")
})

void test("keeps independent terms as an OR query", () => {
  const [group] = createSearch().search("pre commit").items
  assert.equal(group[0].location, "docs/dev/vcs/git/#git-commit-message")
})

void test("does not require stop words in a hyphenated term", () => {
  const search = new Search({
    config: {
      lang: ["en"],
      separator: "[\\s\\-]+",
      pipeline: ["stopWordFilter"],
      fields: {
        title: { boost: 1e3 },
        text: { boost: 1e0 },
        tags: { boost: 1e6 }
      }
    },
    docs: [
      {
        location: "docs/",
        title: "Git Usage",
        text: ""
      },
      {
        location: "docs/#hooks",
        title: "Git Hook",
        text: "end-to-end checks"
      }
    ],
    options: { suggest: false }
  })

  assert.equal(search.search("end-to-end").items[0][0].location, "docs/#hooks")
})
