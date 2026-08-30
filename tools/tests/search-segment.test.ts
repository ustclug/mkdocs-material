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

import {
  segment,
  segmentSearchQuery
} from "../../src/templates/assets/javascripts/integrations/search/query/segment"

const indexOf = (...terms: string[]): object => {
  return Object.fromEntries(terms.map(term => [term, {}]))
}

void test("keeps a complete indexed term", () => {
  const index = indexOf("系统", "管理", "系统管理员")
  assert.deepEqual([...segment("系统管理员", index)], ["系统管理员"])
})

void test("segments a query through its final character", () => {
  const index = indexOf("网络", "配置")
  assert.deepEqual([...segment("网络配置", index)], ["网络", "配置"])
})

void test("preserves an unmatched suffix for prefix search", () => {
  const index = indexOf("网络", "配置")
  assert.deepEqual([...segment("网络配", index)], ["网络", "配"])
})

void test("preserves a query when no indexed term matches", () => {
  assert.deepEqual([...segment("未收录词", {})], ["未收录词"])
})

void test("requires every segment while retaining prefix matching", () => {
  const index = indexOf("实时", "调度")
  assert.equal(
    segmentSearchQuery("实时调度", index),
    "+实时* +调度*"
  )
})
