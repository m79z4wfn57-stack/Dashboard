/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import type { ShelfField } from './shelfState';
import {
  emptyShelfState,
  placeShelfField,
  removeShelfField,
  restoreShelfState,
} from './shelfState';

const region: ShelfField = {
  id: 'column:region',
  kind: 'column',
  value: 'region',
};
const category: ShelfField = {
  id: 'column:category',
  kind: 'column',
  value: 'category',
};
const sales: ShelfField = {
  id: 'metric:sum-sales',
  kind: 'metric',
  value: 'sum_sales',
};

test('places typed fields on rows and columns without mutating prior state', () => {
  const initial = emptyShelfState();
  const withRow = placeShelfField(initial, 'rows', region);
  const result = placeShelfField(withRow, 'columns', sales);

  expect(initial).toEqual({ rows: [], columns: [] });
  expect(result).toEqual({ rows: [region], columns: [sales] });
});

test('reorders fields and moves them between shelves without duplicates', () => {
  const initial = placeShelfField(
    placeShelfField(emptyShelfState(), 'rows', region),
    'rows',
    category,
  );
  const reordered = placeShelfField(initial, 'rows', category, 0);
  const moved = placeShelfField(reordered, 'columns', category);

  expect(reordered.rows).toEqual([category, region]);
  expect(moved).toEqual({ rows: [region], columns: [category] });
});

test('removes fields and restores an independent shelf snapshot', () => {
  const saved = placeShelfField(emptyShelfState(), 'columns', sales);
  const removed = removeShelfField(saved, sales.id);
  const restored = restoreShelfState(saved);

  expect(removed.columns).toEqual([]);
  expect(restored).toEqual(saved);
  expect(restored).not.toBe(saved);
  expect(restored.columns).not.toBe(saved.columns);
});
