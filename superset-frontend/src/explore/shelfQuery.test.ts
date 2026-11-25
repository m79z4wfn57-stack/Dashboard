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
import { GenericDataType } from '@apache-superset/core/common';
import {
  getShelfQueryConfiguration,
  normalizeShelfValues,
} from './shelfQuery';

const columns = [
  { column_name: 'region', type_generic: GenericDataType.String },
  { column_name: 'sales', type_generic: GenericDataType.Numeric },
  { column_name: 'na_sales', type_generic: GenericDataType.Numeric },
];

test('maps a bar dimension to x_axis and a numeric measure to SUM', () => {
  expect(
    getShelfQueryConfiguration(
      ['region'],
      ['sales'],
      columns,
      [],
      'echarts_timeseries_bar',
    ),
  ).toEqual({
    xAxis: 'region',
    groupby: [],
    metrics: [
      expect.objectContaining({
        aggregate: 'SUM',
        column: expect.objectContaining({ column_name: 'sales' }),
      }),
    ],
    labelDimensions: [],
    labelMetrics: [],
    labelFields: [],
    orientation: 'horizontal',
  });
});

test('normalizes a numeric shelf pill to its default SUM metric', () => {
  expect(normalizeShelfValues(['sales'], columns, [])).toEqual([
    expect.objectContaining({
      aggregate: 'SUM',
      label: 'SUM(sales)',
      column: expect.objectContaining({ column_name: 'sales' }),
    }),
  ]);
});

test('preserves Rows and Columns orientation when shelves are exchanged', () => {
  expect(
    getShelfQueryConfiguration(
      ['sales'],
      ['region'],
      columns,
      [],
      'echarts_timeseries_bar',
    ),
  ).toEqual({
    xAxis: 'region',
    groupby: [],
    metrics: [expect.objectContaining({ aggregate: 'SUM' })],
    labelDimensions: [],
    labelMetrics: [],
    labelFields: [],
    orientation: 'vertical',
  });
});

test('maps Detail to query granularity without moving the primary dimension', () => {
  expect(
    getShelfQueryConfiguration(
      ['region'],
      ['sales'],
      [
        ...columns,
        { column_name: 'platform', type_generic: GenericDataType.String },
      ],
      [],
      'echarts_timeseries_bar',
      ['platform'],
    ),
  ).toEqual({
    xAxis: 'region',
    groupby: ['platform'],
    metrics: [expect.objectContaining({ aggregate: 'SUM' })],
    labelDimensions: [],
    labelMetrics: [],
    labelFields: [],
    orientation: 'horizontal',
  });
});

test('preserves saved metrics and dimensions for existing query controls', () => {
  expect(
    getShelfQueryConfiguration(
      ['region'],
      ['saved_sales'],
      columns,
      [{ uuid: 'metric-1', metric_name: 'saved_sales' }],
      'table',
    ),
  ).toEqual({
    groupby: ['region'],
    metrics: ['saved_sales'],
    labelDimensions: [],
    labelMetrics: [],
    labelFields: [],
  });
});

test('excludes unknown fields from query controls', () => {
  expect(
    getShelfQueryConfiguration(['unknown'], [], columns, [], 'table'),
  ).toEqual({
    groupby: [],
    metrics: [],
    labelDimensions: [],
    labelMetrics: [],
    labelFields: [],
  });
});

test('queries label measures independently from the bar-length measure', () => {
  const query = getShelfQueryConfiguration(
    ['region'],
    ['sales'],
    columns,
    [],
    'echarts_timeseries_bar',
    [],
    ['na_sales'],
  );

  expect(query.metrics).toEqual([
    expect.objectContaining({ label: 'SUM(sales)' }),
  ]);
  expect(query.labelMetrics).toEqual([
    expect.objectContaining({ label: 'SUM(na_sales)' }),
  ]);
  expect(query.labelFields).toEqual([
    { kind: 'metric', label: 'SUM(na_sales)' },
  ]);
});

test('preserves mixed Label field order', () => {
  const query = getShelfQueryConfiguration(
    ['region'],
    ['sales'],
    columns,
    [],
    'echarts_timeseries_bar',
    [],
    ['na_sales', 'region'],
  );

  expect(query.labelFields).toEqual([
    { kind: 'metric', label: 'SUM(na_sales)' },
    { kind: 'dimension', label: 'region' },
  ]);
});

test('adds label dimensions to mark granularity without moving x_axis', () => {
  const query = getShelfQueryConfiguration(
    ['region'],
    ['sales'],
    [
      ...columns,
      { column_name: 'platform', type_generic: GenericDataType.String },
    ],
    [],
    'echarts_timeseries_bar',
    [],
    ['platform'],
  );

  expect(query.xAxis).toBe('region');
  expect(query.groupby).toEqual(['platform']);
  expect(query.labelDimensions).toEqual(['platform']);
});
