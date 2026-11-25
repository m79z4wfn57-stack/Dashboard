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
import type { QueryFormColumn, QueryFormMetric } from '@superset-ui/core';

export type ShelfName = 'rows' | 'columns';
export type ShelfValue = QueryFormColumn | QueryFormMetric;

export type ShelfField =
  | {
      id: string;
      kind: 'column';
      value: QueryFormColumn;
    }
  | {
      id: string;
      kind: 'metric';
      value: QueryFormMetric;
    };

export type ShelfState = Readonly<Record<ShelfName, readonly ShelfField[]>>;

export const emptyShelfState = (): ShelfState => ({ rows: [], columns: [] });

const withoutField = (state: ShelfState, fieldId: string): ShelfState => ({
  rows: state.rows.filter(field => field.id !== fieldId),
  columns: state.columns.filter(field => field.id !== fieldId),
});

/** Place a field on a shelf, moving an existing field instead of duplicating it. */
export function placeShelfField(
  state: ShelfState,
  shelf: ShelfName,
  field: ShelfField,
  index = state[shelf].length,
): ShelfState {
  const nextState = withoutField(state, field.id);
  const values = [...nextState[shelf]];
  const boundedIndex = Math.max(0, Math.min(index, values.length));
  values.splice(boundedIndex, 0, field);
  return { ...nextState, [shelf]: values };
}

export function removeShelfField(
  state: ShelfState,
  fieldId: string,
): ShelfState {
  return withoutField(state, fieldId);
}

/** Clone persisted shelf values so subsequent authoring cannot mutate the snapshot. */
export function restoreShelfState(state: ShelfState): ShelfState {
  return { rows: [...state.rows], columns: [...state.columns] };
}
