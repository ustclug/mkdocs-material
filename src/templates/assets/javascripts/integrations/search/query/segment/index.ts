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

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Segment a search query using the inverted index
 *
 * This function implements a clever approach to text segmentation for Asian
 * languages, as it used the information already available in the search index.
 * The idea is to greedily segment the search query based on the tokens that are
 * already part of the index, as described in the linked issue.
 *
 * @see https://bit.ly/3lwjrk7 - GitHub issue
 *
 * @param query - Query value
 * @param index - Inverted index
 *
 * @returns Segmented query value
 */
export function segment(
  query: string, index: object
): Iterable<string> {
  const segments: string[] = []

  /* Segment query with longest matches from left to right */
  for (let start = 0; start < query.length;) {
    let end = query.length
    while (end > start && !(query.slice(start, end) in index))
      end--

    /* Preserve an unmatched suffix for prefix search */
    if (end === start) {
      segments.push(query.slice(start))
      break
    }

    segments.push(query.slice(start, end))
    start = end
  }

  /* Return segmented query value */
  return segments
}

/**
 * Transform an Asian-language query into required prefix terms
 *
 * Requiring all segments prevents common one-character terms from producing
 * unrelated results, while trailing wildcards retain search-as-you-type.
 *
 * @param query - Query value
 * @param index - Inverted index
 *
 * @returns Transformed query value
 */
export function segmentSearchQuery(
  query: string, index: object
): string {
  return [...segment(query, index)]
    .map(term => `+${term}*`)
    .join(" ")
}
