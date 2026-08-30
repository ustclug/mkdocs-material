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

import {
  SearchDocument,
  SearchIndex,
  SearchOptions,
  setupSearchDocumentMap
} from "../config"
import {
  Position,
  PositionTable,
  highlight,
  highlightAll,
  tokenize
} from "../internal"
import {
  SearchQueryTerms,
  getSearchQueryTerms,
  parseSearchQuery,
  segmentSearchQuery,
  transformSearchQuery
} from "../query"

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * Search item
 */
export interface SearchItem
  extends SearchDocument
{
  score: number                        /* Score (relevance) */
  terms: SearchQueryTerms              /* Search query terms */
}

/**
 * Search result
 */
export interface SearchResult {
  items: SearchItem[][]                /* Search items */
  suggest?: string[]                   /* Search suggestions */
}

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Extract hyphenated query terms
 *
 * A hyphen is a separator for Chinese search, but it also commonly joins
 * words in technical terms (e.g. `pre-commit`). Lunr searches the individual
 * parts as optional terms, which makes a match for just one part sufficient.
 * Keep the parts around so we can require all of them and give an exact
 * compound match a small relevance boost later on.
 *
 * @param query - Search query
 *
 * @returns Hyphenated query terms
 */
function getCompoundQueryTerms(query: string): string[][] {
  const compounds: string[][] = []

  /* Analyze whitespace-separated query parts */
  for (const part of query.replace(/"/g, "").split(/\s+/g)) {
    if (!part || part.startsWith("-"))
      continue

    /* Strip a presence modifier, field selector and query modifiers */
    const term = part
      .replace(/^\+/, "")
      .replace(/^(?:title|text|tags):/, "")
      .replace(/[~^*].*$/, "")

    /* Restrict matching to simple hyphenated words, not URLs or options */
    const terms = term.toLowerCase().split("-")
    if (
      terms.length > 1 &&
      terms.every(value => /^[\p{L}\p{N}_]+$/u.test(value))
    )
      compounds.push(terms)
  }

  return compounds
}

/**
 * Determine whether a query term matched
 *
 * @param terms - Search query terms
 * @param term - Term to check
 * @param stopWordFilter - Whether stop words are filtered
 *
 * @returns Whether the term matched
 */
function hasMatchingTerm(
  terms: SearchQueryTerms, term: string, stopWordFilter: boolean
): boolean {
  if (Object.entries(terms).some(([value, match]) =>
    match && (value === term || value.startsWith(term))
  ))
    return true

  /* Stop words are intentionally omitted from the index */
  return stopWordFilter &&
    typeof lunr.stopWordFilter !== "undefined" &&
    typeof lunr.stopWordFilter(new lunr.Token(term, {})) === "undefined"
}

/**
 * Count occurrences of a string
 *
 * @param value - Value to search
 * @param term - Term to find
 *
 * @returns Number of occurrences
 */
function countOccurrences(value: string, term: string): number {
  let count = 0
  let index = 0

  while ((index = value.indexOf(term, index)) !== -1) {
    count++
    index += term.length
  }
  return count
}

/**
 * Extract a simple multi-term phrase from a query
 *
 * @param query - Search query
 *
 * @returns Normalized phrase, if any
 */
function getPhraseQuery(query: string): string | undefined {
  const phrase = query
    .replace(/"/g, "")
    .trim()
    .replace(/\s+/g, " ")

  return /^[\p{L}\p{N}_-]+(?: [\p{L}\p{N}_-]+)+$/u.test(phrase)
    ? phrase.toLowerCase()
    : undefined
}

/**
 * Compute the exact phrase-match boost
 *
 * @param doc - Search document
 * @param phrase - Search phrase
 *
 * @returns Phrase-match boost
 */
function getPhraseMatchBoost(
  doc: SearchDocument, phrase?: string
): number {
  if (typeof phrase === "undefined")
    return 0

  let matches = 0
  const values = [
    doc.title,
    doc.text,
    doc.tags?.join(" ") || ""
  ]

  for (const value of values)
    matches += countOccurrences(
      value
        .replace(/<[^>]*>/g, " ")
        .replace(/[\s\u200b]+/g, " ")
        .toLowerCase(),
      phrase
    )

  /* Prevent repeated occurrences from overwhelming all other signals */
  return Math.min(matches, 10)
}

/**
 * Compute the exact compound-match boost
 *
 * @param doc - Search document
 * @param compounds - Hyphenated query terms
 *
 * @returns Compound-match boost
 */
function getCompoundMatchBoost(
  doc: SearchDocument, compounds: string[][]
): number {
  let matches = 0
  const values = [
    doc.title,
    doc.text,
    doc.tags?.join(" ") || ""
  ]

  for (const compound of compounds) {
    const term = compound.join("-")
    for (const value of values)
      matches += countOccurrences(
        value.replace(/<[^>]*>/g, "").toLowerCase(), term
      )
  }

  /* Prevent repeated occurrences from overwhelming all other signals */
  return Math.min(matches, 10)
}

/**
 * Create field extractor factory
 *
 * @param table - Position table map
 *
 * @returns Extractor factory
 */
function extractor(table: Map<string, PositionTable>) {
  return (name: keyof SearchDocument) => {
    return (doc: SearchDocument) => {
      if (typeof doc[name] === "undefined")
        return undefined

      /* Compute identifier and initialize table */
      const id = [doc.location, name].join(":")
      table.set(id, lunr.tokenizer.table = [])

      /* Return field value */
      return doc[name]
    }
  }
}

/**
 * Compute the difference of two lists of strings
 *
 * @param a - 1st list of strings
 * @param b - 2nd list of strings
 *
 * @returns Difference
 */
function difference(a: string[], b: string[]): string[] {
  const [x, y] = [new Set(a), new Set(b)]
  return [
    ...new Set([...x].filter(value => !y.has(value)))
  ]
}

/* ----------------------------------------------------------------------------
 * Class
 * ------------------------------------------------------------------------- */

/**
 * Search index
 */
export class Search {

  /**
   * Search document map
   */
  protected map: Map<string, SearchDocument>

  /**
   * Search options
   */
  protected options: SearchOptions

  /**
   * The underlying Lunr.js search index
   */
  protected index: lunr.Index

  /**
   * Internal position table map
   */
  protected table: Map<string, PositionTable>

  /**
   * Whether stop words are removed from the index
   */
  protected stopWordFilter: boolean

  /**
   * Create the search integration
   *
   * @param data - Search index
   */
  public constructor({ config, docs, options }: SearchIndex) {
    const field = extractor(this.table = new Map())
    this.stopWordFilter = config.pipeline.includes("stopWordFilter")

    /* Set up document map and options */
    this.map = setupSearchDocumentMap(docs)
    this.options = options

    /* Set up document index */
    this.index = lunr(function () {
      this.metadataWhitelist = ["position"]
      this.b(0)

      /* Set up (multi-)language support */
      if (config.lang.length === 1 && config.lang[0] !== "en") {
        // @ts-expect-error - namespace indexing not supported
        this.use(lunr[config.lang[0]])
      } else if (config.lang.length > 1) {
        this.use(lunr.multiLanguage(...config.lang))
      }

      /* Set up custom tokenizer (must be after language setup) */
      this.tokenizer = tokenize as typeof lunr.tokenizer
      lunr.tokenizer.separator = new RegExp(config.separator)

      /* Set up custom segmenter, if loaded */
      lunr.segmenter = "TinySegmenter" in lunr
        ? new lunr.TinySegmenter()
        : undefined

      /* Compute functions to be removed from the pipeline */
      const fns = difference([
        "trimmer", "stopWordFilter", "stemmer"
      ], config.pipeline)

      /* Remove functions from the pipeline for registered languages */
      for (const lang of config.lang.map(language => (
        // @ts-expect-error - namespace indexing not supported
        language === "en" ? lunr : lunr[language]
      )))
        for (const fn of fns) {
          this.pipeline.remove(lang[fn])
          this.searchPipeline.remove(lang[fn])
        }

      /* Set up index reference */
      this.ref("location")

      /* Set up index fields */
      for (const [name, spec] of Object.entries(config.fields))
        // @ts-expect-error - fix typings, if this proves to be a good idea
        this.field(name, { ...spec, extractor: field(name) })

      /* Add documents to index */
      for (const doc of docs)
        this.add(doc, { boost: doc.boost })
    })
  }

  /**
   * Search for matching documents
   *
   * @param query - Search query
   *
   * @returns Search result
   */
  public search(query: string): SearchResult {
    const compounds = getCompoundQueryTerms(query)
    const phrase = getPhraseQuery(query)

    /* Preserve query terms before the search pipeline applies stemming */
    const source = parseSearchQuery(transformSearchQuery(query))
      .filter(clause => (
        clause.presence !== lunr.Query.presence.PROHIBITED
      ))

    // Experimental Chinese segmentation
    query = query.replace(/\p{sc=Han}+/gu, value => {
      return segmentSearchQuery(value, this.index.invertedIndex)
    })

    // @todo: move segmenter (above) into transformSearchQuery
    query = transformSearchQuery(query, this.index.pipeline)
    if (!query)
      return { items: [] }

    /* Parse query to extract clauses for analysis */
    const clauses = parseSearchQuery(query)
      .filter(clause => (
        clause.presence !== lunr.Query.presence.PROHIBITED
      ))
    const display = source.length === clauses.length ? source : clauses

    /* Perform search and post-process results */
    const groups = this.index.search(query)

      /* Apply post-query boosts based on title and search query terms */
      .reduce<SearchItem[]>((item, { ref, score, matchData }) => {
        let doc = this.map.get(ref)
        if (typeof doc !== "undefined") {

          /* Shallow copy document */
          doc = { ...doc }
          if (doc.tags)
            doc.tags = [...doc.tags]

          /* Compute and analyze search query terms */
          const terms = getSearchQueryTerms(
            clauses,
            Object.keys(matchData.metadata)
          )

          /* Require all parts of a hyphenated technical term */
          if (compounds.some(compound => compound.some(term =>
            !hasMatchingTerm(terms, term, this.stopWordFilter)
          )))
            return item

          /* Count exact compound matches before extracting teasers */
          const compound = getCompoundMatchBoost(doc, compounds)
          const exact = getPhraseMatchBoost(doc, phrase)

          /* Restore original terms for display and page highlighting */
          const displayTerms = Object.fromEntries(Object.entries(terms).map(
            ([term, match]) => {
              const index = clauses.findIndex(clause => clause.term === term)
              return [display[index]?.term || term, match]
            }
          ))

          /* Highlight matches in fields */
          for (const field of this.index.fields) {
            if (typeof doc[field] === "undefined")
              continue

            /* Collect positions from matches */
            const positions: Position[] = []
            for (const match of Object.values(matchData.metadata))
              if (typeof match[field] !== "undefined")
                positions.push(...match[field].position)

            /* Skip highlighting, if no positions were collected */
            if (!positions.length)
              continue

            /* Load table and determine highlighting method */
            const table = this.table.get([doc.location, field].join(":"))!
            const fn = Array.isArray(doc[field])
              ? highlightAll
              : highlight

            // @ts-expect-error - stop moaning, TypeScript!
            doc[field] = fn(doc[field], table, positions, field !== "text")
          }

          /* Highlight title and text and apply post-query boosts */
          const boost = +!doc.parent +
            Object.values(terms)
              .filter(t => t).length /
            Object.keys(terms).length

          /* Append item */
          item.push({
            ...doc,
            score: score * (1 + boost ** 2) *
              (1 + compound) * (1 + exact),
            terms: displayTerms
          })
        }
        return item
      }, [])

      /* Sort search results again after applying boosts */
      .sort((a, b) => b.score - a.score)

      /* Group search results by article */
      .reduce((items, result) => {
        const doc = this.map.get(result.location)
        if (typeof doc !== "undefined") {
          const ref = doc.parent
            ? doc.parent.location
            : doc.location
          items.set(ref, [...items.get(ref) || [], result])
        }
        return items
      }, new Map<string, SearchItem[]>())

    /* Ensure that every item set has an article */
    for (const [ref, items] of groups)
      if (!items.find(item => item.location === ref)) {
        const doc = this.map.get(ref)!
        items.push({ ...doc, score: 0, terms: {} })
      }

    /* Generate search suggestions, if desired */
    let suggest: string[] | undefined
    if (this.options.suggest) {
      const titles = this.index.query(builder => {
        for (const clause of clauses)
          builder.term(clause.term, {
            fields: ["title"],
            presence: lunr.Query.presence.REQUIRED,
            wildcard: lunr.Query.wildcard.TRAILING
          })
      })

      /* Retrieve suggestions for best match */
      suggest = titles.length
        ? Object.keys(titles[0].matchData.metadata)
        : []
    }

    /* Return search result */
    return {
      items: [...groups.values()],
      ...typeof suggest !== "undefined" && { suggest }
    }
  }
}
