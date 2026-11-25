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
import type { AdhocFilter, LabelDocument } from '@superset-ui/core';
import {
  createWorksheetState,
  restoreWorksheetState,
  withWorksheetState,
} from './worksheetPersistence';

const formData = {
  datasource: '7__table',
  viz_type: 'echarts_timeseries_bar',
  row_shelf: ['region'],
  column_shelf: ['sum_sales'],
  label_shelf: ['sum_sales'],
  detail_shelf: ['region'],
  adhoc_filters: [
    {
      expressionType: 'SIMPLE' as const,
      subject: 'region',
      operator: '==',
      comparator: 'West',
      clause: 'WHERE' as const,
    } satisfies AdhocFilter,
  ],
  show_value: true,
  rich_tooltip: true,
  orientation: 'vertical',
  color_scheme: 'supersetColors',
};

test('round-trips bounded worksheet semantics and formatting', () => {
  const persisted = withWorksheetState(formData);
  expect(restoreWorksheetState(persisted)).toEqual(
    createWorksheetState(formData),
  );
});

test('round-trips a selected numeric member filter', () => {
  const selectedYearFilter = {
    expressionType: 'SIMPLE' as const,
    subject: 'year',
    operator: 'IN' as const,
    comparator: ['2010'],
    clause: 'WHERE' as const,
  } satisfies AdhocFilter;
  const persisted = withWorksheetState({
    ...formData,
    adhoc_filters: [selectedYearFilter],
  });

  expect(restoreWorksheetState(persisted)?.filters).toEqual([
    selectedYearFilter,
  ]);
});

test('rejects invalid and cross-dataset worksheet payloads', () => {
  expect(
    restoreWorksheetState({
      ...formData,
      worksheet_state: { version: 1, datasource: '8__table' },
    }),
  ).toBeUndefined();
  expect(
    restoreWorksheetState({
      ...formData,
      worksheet_state: {
        ...createWorksheetState(formData),
        rows: Array.from({ length: 51 }, (_, index) => `field_${index}`),
      },
    }),
  ).toBeUndefined();
});

test('bounds oversized state when preparing an existing chart save', () => {
  const state = createWorksheetState({
    ...formData,
    row_shelf: Array.from({ length: 60 }, (_, index) => `field_${index}`),
  });
  expect(state.rows).toHaveLength(50);
});

test('round-trips the structured Label document and display settings', () => {
  const labelDocument = {
    version: 1,
    paragraphs: [
      {
        id: 'line',
        alignment: 'left',
        nodes: [
          { type: 'text', id: 'prefix', text: 'Sales: ' },
          {
            type: 'field',
            id: 'sales',
            fieldType: 'measure',
            label: 'SUM(sales)',
            queryField: 'SUM(sales)',
          },
        ],
      },
    ],
  } satisfies LabelDocument;
  const persisted = withWorksheetState({
    ...formData,
    label_document: labelDocument,
    label_display: {
      visible: true,
      marksToLabel: 'all',
      allowOverlap: false,
      position: 'right',
      alignment: 'left',
    },
  });

  expect(restoreWorksheetState(persisted)?.formatting).toEqual(
    expect.objectContaining({
      labelDocument,
      labelDisplay: expect.objectContaining({ position: 'right' }),
    }),
  );
});
