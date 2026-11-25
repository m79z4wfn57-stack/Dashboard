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
import { SqlaFormData, VizType } from '@superset-ui/core';
import buildQuery from '../../src/Timeseries/buildQuery';

describe('Timeseries buildQuery', () => {
  const formData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    metrics: ['bar', 'baz'],
    viz_type: 'my_chart',
  };

  test('should build groupby with series in form data', () => {
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['bar', 'baz']);
  });

  test('should order by timeseries limit if orderby unspecified', () => {
    const queryContext = buildQuery({
      ...formData,
      timeseries_limit_metric: 'bar',
      order_desc: true,
    });
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['bar', 'baz']);
    expect(query.series_limit_metric).toEqual('bar');
    expect(query.order_desc).toEqual(true);
    expect(query.orderby).toEqual([['bar', false]]);
  });

  test('should not order by timeseries limit if orderby provided', () => {
    const queryContext = buildQuery({
      ...formData,
      timeseries_limit_metric: 'bar',
      order_desc: true,
      orderby: [['foo', true]],
    });
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['bar', 'baz']);
    expect(query.series_limit_metric).toEqual('bar');
    expect(query.order_desc).toEqual(true);
    expect(query.orderby).toEqual([['foo', true]]);
  });
});

describe('queryObject conversion', () => {
  const formData: SqlaFormData = {
    datasource: '5__table',
    viz_type: VizType.Table,
    granularity_sqla: 'time_column',
    time_grain_sqla: 'P1Y',
    time_range: '1 year ago : 2013',
    groupby: ['col1'],
    metrics: ['count(*)'],
  };

  test("shouldn't convert queryObject", () => {
    const { queries } = buildQuery(formData);
    expect(queries[0]).toEqual(
      expect.objectContaining({
        granularity: 'time_column',
        time_range: '1 year ago : 2013',
        extras: { time_grain_sqla: 'P1Y', having: '', where: '' },
        columns: ['col1'],
        series_columns: ['col1'],
        metrics: ['count(*)'],
        is_timeseries: true,
        post_processing: [
          {
            operation: 'pivot',
            options: {
              aggregates: { 'count(*)': { operator: 'mean' } },
              columns: ['col1'],
              drop_missing_columns: true,
              index: ['__timestamp'],
            },
          },
          { operation: 'flatten' },
        ],
      }),
    );
  });

  test('should convert queryObject', () => {
    const { queries } = buildQuery({ ...formData, x_axis: 'time_column' });
    expect(queries[0]).toMatchObject({
      granularity: 'time_column',
      time_range: '1 year ago : 2013',
      extras: { having: '', where: '', time_grain_sqla: 'P1Y' },
      columns: [
        {
          columnType: 'BASE_AXIS',
          expressionType: 'SQL',
          label: 'time_column',
          sqlExpression: 'time_column',
          timeGrain: 'P1Y',
          isColumnReference: true,
        },
        'col1',
      ],
      series_columns: ['col1'],
      metrics: ['count(*)'],
      post_processing: [
        {
          operation: 'pivot',
          options: {
            aggregates: { 'count(*)': { operator: 'mean' } },
            columns: ['col1'],
            drop_missing_columns: true,
            index: ['time_column'],
          },
        },
        { operation: 'flatten' },
      ],
    });
  });
});

test('builds a bar query from shelf-compatible dimension and SUM controls', () => {
  const sumSales = {
    expressionType: 'SIMPLE' as const,
    column: { column_name: 'sales' },
    aggregate: 'SUM' as const,
    label: 'SUM(sales)',
  };
  const { queries } = buildQuery({
    datasource: '5__table',
    viz_type: 'echarts_timeseries_bar',
    x_axis: 'region',
    groupby: [],
    metrics: [sumSales],
  });

  expect(queries[0].metrics).toEqual([sumSales]);
  expect(queries[0].columns).toEqual([
    expect.objectContaining({
      label: 'region',
      sqlExpression: 'region',
    }),
  ]);
  expect(queries[0].columns).toHaveLength(1);
});

test('builds genre and platform granularity with SUM(global_sales)', () => {
  const sumGlobalSales = {
    expressionType: 'SIMPLE' as const,
    column: { column_name: 'global_sales' },
    aggregate: 'SUM' as const,
    label: 'SUM(global_sales)',
  };
  const { queries } = buildQuery({
    datasource: '1__table',
    viz_type: 'echarts_timeseries_bar',
    x_axis: 'genre',
    groupby: ['platform'],
    metrics: [sumGlobalSales],
    orientation: 'horizontal',
    adhoc_filters: [
      {
        expressionType: 'SIMPLE',
        subject: 'year',
        operator: 'IN',
        comparator: ['2010'],
        clause: 'WHERE',
      },
    ],
  });

  expect(queries[0].columns).toEqual([
    expect.objectContaining({ label: 'genre' }),
    'platform',
  ]);
  expect(queries[0].metrics).toEqual([sumGlobalSales]);
  expect(queries[0].filters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ col: 'year', op: 'IN', val: ['2010'] }),
    ]),
  );
});

test('queries a Label measure without replacing the bar-length measure', () => {
  const sumGlobalSales = {
    expressionType: 'SIMPLE' as const,
    column: { column_name: 'global_sales' },
    aggregate: 'SUM' as const,
    label: 'SUM(global_sales)',
  };
  const sumEuSales = {
    expressionType: 'SIMPLE' as const,
    column: { column_name: 'eu_sales' },
    aggregate: 'SUM' as const,
    label: 'SUM(eu_sales)',
  };
  const { queries } = buildQuery({
    datasource: '1__table',
    viz_type: 'echarts_timeseries_bar',
    x_axis: 'genre',
    metrics: [sumGlobalSales],
    label_metrics: [sumEuSales],
  });

  expect(queries[0].metrics).toEqual([sumGlobalSales, sumEuSales]);
  expect(
    queries[0].post_processing?.find(
      operation => operation?.operation === 'pivot',
    ),
  ).toEqual(
    expect.objectContaining({
      options: expect.objectContaining({
        aggregates: {
          'SUM(global_sales)': { operator: 'mean' },
          'SUM(eu_sales)': { operator: 'mean' },
        },
      }),
    }),
  );
});
