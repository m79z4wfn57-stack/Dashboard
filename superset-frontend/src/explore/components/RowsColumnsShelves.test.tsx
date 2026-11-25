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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import { GenericDataType } from '@apache-superset/core/common';
import { DatasourceType } from '@superset-ui/core';
import type { Datasource } from 'src/explore/types';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { RowsColumnsShelves } from './RowsColumnsShelves';

jest.mock(
  'src/explore/components/controls/DndColumnSelectControl',
  () => ({
    DndColumnMetricSelect: ({
      label,
      onChange,
      value,
    }: {
      label: string;
      onChange: (value: string[]) => void;
      value: Array<string | { label?: string }>;
    }) => {
      const values = {
        Rows: ['region'],
        Columns: ['sum_sales'],
        Labels: ['na_sales'],
        Detail: ['platform'],
      };
      return (
        <div
          data-testid={`${label.toLowerCase()}-shelf`}
          onDragOver={event => event.preventDefault()}
          onDrop={() => onChange(values[label as keyof typeof values])}
        >
          <button
            type="button"
            onClick={() => onChange(values[label as keyof typeof values])}
          >
            {label}
          </button>
          {label === 'Labels' && (
            <>
              <button type="button" onClick={() => onChange(['sales'])}>
                Labels same measure
              </button>
              <button
                type="button"
                onClick={() => onChange(['region', 'eu_sales'])}
              >
                Labels multiple
              </button>
              <button type="button" onClick={() => onChange(['platform'])}>
                Labels dimension
              </button>
            </>
          )}
          <span>
            {value
              .map(item =>
                typeof item === 'string' ? item : (item.label ?? ''),
              )
              .join(',')}
          </span>
        </div>
      );
    },
    DndFilterSelect: ({
      onChange,
    }: {
      onChange: (value: Record<string, unknown>[]) => void;
    }) => (
      <>
        <button
          type="button"
          onClick={() =>
            onChange([
              {
                expressionType: 'SIMPLE',
                subject: 'year',
                operator: 'IN',
                comparator: [2010],
                clause: 'WHERE',
              },
            ])
          }
        >
          Filters
        </button>
        <button type="button" onClick={() => onChange([])}>
          Clear filters
        </button>
      </>
    ),
  }),
);

const columns = [
  { column_name: 'region', type_generic: GenericDataType.String },
  { column_name: 'platform', type_generic: GenericDataType.String },
  { column_name: 'year', type_generic: GenericDataType.Numeric },
  { column_name: 'sales', type_generic: GenericDataType.Numeric },
  { column_name: 'na_sales', type_generic: GenericDataType.Numeric },
  { column_name: 'eu_sales', type_generic: GenericDataType.Numeric },
];
const metrics = [
  { uuid: 'metric-1', metric_name: 'sum_sales', expression: 'SUM(sales)' },
];
const datasource: Datasource = {
  id: 1,
  type: DatasourceType.Table,
  columns,
  metrics,
  column_formats: {},
  verbose_map: {},
  main_dttm_col: '',
  datasource_name: 'test',
  description: null,
};

test('updates shelf state and query controls when fields are placed', () => {
  const setControlValue = jest.fn();
  render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{ viz_type: 'table' }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Rows' }));
  expect(setControlValue).toHaveBeenNthCalledWith(1, 'row_shelf', ['region']);
  expect(setControlValue).toHaveBeenNthCalledWith(2, 'groupby', ['region']);
  expect(setControlValue).toHaveBeenNthCalledWith(3, 'metrics', []);
  expect(setControlValue).toHaveBeenNthCalledWith(
    4,
    'worksheet_state',
    expect.objectContaining({ rows: ['region'], columns: [] }),
  );

  fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
  expect(setControlValue).toHaveBeenNthCalledWith(5, 'column_shelf', [
    'sum_sales',
  ]);
  expect(setControlValue).toHaveBeenNthCalledWith(6, 'groupby', []);
  expect(setControlValue).toHaveBeenNthCalledWith(7, 'metrics', ['sum_sales']);
});

test('restores saved shelf values while preserving query configuration', () => {
  const setControlValue = jest.fn();
  render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'table',
        row_shelf: ['region'],
        column_shelf: ['sum_sales'],
        groupby: ['region'],
        metrics: ['sum_sales'],
      }}
    />,
  );

  expect(screen.getByTestId('rows-columns-shelves')).toBeInTheDocument();
  expect(setControlValue).not.toHaveBeenCalled();
});

test('restores saved shelves when live shelf fields are not hydrated', () => {
  render(
    <RowsColumnsShelves
      actions={{ setControlValue: jest.fn() }}
      columns={columns}
      metrics={metrics}
      formData={{
        datasource: '1__table',
        viz_type: 'echarts_timeseries_bar',
        x_axis: 'region',
        worksheet_state: {
          version: 1,
          datasource: '1__table',
          rows: ['region'],
          columns: ['sales'],
          labels: ['sales'],
          detail: ['platform'],
          filters: [],
          formatting: { orientation: 'horizontal' },
        },
      }}
    />,
  );

  expect(screen.getByTestId('rows-shelf')).toHaveTextContent('region');
  expect(screen.getByTestId('columns-shelf')).toHaveTextContent('sales');
  expect(screen.getByTestId('labels-shelf')).toHaveTextContent('SUM(sales)');
  expect(screen.getByTestId('detail-shelf')).toHaveTextContent('platform');
});

test('moves a field between shelves and removes it from its previous shelf', () => {
  const setControlValue = jest.fn();
  render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'table',
        row_shelf: ['sum_sales'],
        metrics: ['sum_sales'],
      }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
  expect(setControlValue).toHaveBeenNthCalledWith(1, 'column_shelf', [
    'sum_sales',
  ]);
  expect(setControlValue).toHaveBeenNthCalledWith(2, 'row_shelf', []);
  expect(setControlValue).toHaveBeenNthCalledWith(3, 'groupby', []);
  expect(setControlValue).toHaveBeenNthCalledWith(4, 'metrics', ['sum_sales']);
});

test('updates bar query controls with a dimension and SUM numeric measure', () => {
  const setControlValue = jest.fn();
  render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        column_shelf: ['sales'],
      }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Rows' }));
  expect(setControlValue).toHaveBeenCalledWith('groupby', []);
  expect(setControlValue).toHaveBeenCalledWith(
    'metrics',
    expect.arrayContaining([
      expect.objectContaining({ aggregate: 'SUM' }),
    ]),
  );
  expect(setControlValue).toHaveBeenCalledWith('x_axis', 'region');
  expect(setControlValue).toHaveBeenCalledWith('orientation', 'horizontal');
});

test('displays the default SUM aggregation for a numeric shelf column', () => {
  const setControlValue = jest.fn();
  render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        row_shelf: ['region'],
        column_shelf: ['sales'],
        detail_shelf: ['platform'],
        x_axis: 'region',
        groupby: ['platform'],
        orientation: 'horizontal',
      }}
    />,
  );

  expect(screen.getByTestId('columns-shelf')).toHaveTextContent('SUM(sales)');
  expect(setControlValue).toHaveBeenCalledWith(
    'metrics',
    expect.arrayContaining([
      expect.objectContaining({ aggregate: 'SUM', label: 'SUM(sales)' }),
    ]),
  );
});

test('selects the existing ECharts bar visualization from valid shelves', () => {
  const setControlValue = jest.fn();
  render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'table',
        row_shelf: ['region'],
        column_shelf: ['sales'],
      }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Bar chart' }));
  expect(setControlValue).toHaveBeenCalledWith(
    'viz_type',
    'echarts_timeseries_bar',
  );
  expect(setControlValue).toHaveBeenCalledWith('x_axis', 'region');
  expect(setControlValue).toHaveBeenCalledWith('orientation', 'horizontal');
  expect(setControlValue).toHaveBeenCalledWith(
    'metrics',
    expect.arrayContaining([expect.objectContaining({ aggregate: 'SUM' })]),
  );
});

test('maps Table shelves to duplicate-free Bar controls after native switching', () => {
  const setControlValue = jest.fn();
  const { rerender } = render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'table',
        row_shelf: ['region'],
        column_shelf: ['sales'],
        groupby: ['region'],
      }}
    />,
  );
  expect(setControlValue).not.toHaveBeenCalled();

  rerender(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        row_shelf: ['region'],
        column_shelf: ['sales'],
        groupby: ['region'],
      }}
    />,
  );

  expect(setControlValue).toHaveBeenCalledWith('x_axis', 'region');
  expect(setControlValue).toHaveBeenCalledWith('groupby', []);
  expect(setControlValue).toHaveBeenCalledWith('orientation', 'horizontal');
  expect(setControlValue).toHaveBeenCalledWith(
    'metrics',
    expect.arrayContaining([expect.objectContaining({ aggregate: 'SUM' })]),
  );
});

test('retains a clicked Row selection after the Bar form data rerenders', () => {
  const setControlValue = jest.fn();
  const { rerender } = render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        column_shelf: ['sales'],
      }}
    />,
  );
  setControlValue.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'Rows' }));
  expect(setControlValue).toHaveBeenCalledWith('row_shelf', ['region']);
  expect(setControlValue).toHaveBeenCalledWith('x_axis', 'region');

  setControlValue.mockClear();
  rerender(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        row_shelf: ['region'],
        column_shelf: ['sales'],
        x_axis: 'region',
        groupby: [],
        orientation: 'horizontal',
      }}
    />,
  );

  expect(screen.getByTestId('rows-shelf')).toHaveTextContent('region');
  expect(setControlValue).not.toHaveBeenCalled();
});

test('retains a Row field dropped while Bar is already active', () => {
  const setControlValue = jest.fn();
  const { rerender } = render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        column_shelf: ['sales'],
        metrics: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'sales' },
            aggregate: 'SUM',
            label: 'SUM(sales)',
          },
        ],
      }}
    />,
  );

  fireEvent.drop(screen.getByTestId('rows-shelf'));
  expect(setControlValue).toHaveBeenCalledWith('row_shelf', ['region']);
  expect(setControlValue).toHaveBeenCalledWith('x_axis', 'region');
  expect(setControlValue).toHaveBeenCalledWith('groupby', []);
  expect(setControlValue).toHaveBeenCalledWith(
    'worksheet_state',
    expect.objectContaining({ rows: ['region'], columns: ['sales'] }),
  );

  rerender(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        row_shelf: ['region'],
        column_shelf: ['sales'],
        x_axis: 'region',
        groupby: [],
        orientation: 'horizontal',
      }}
    />,
  );
  expect(screen.getByTestId('rows-shelf')).toHaveTextContent('region');
});

test('preserves canonical shelves across repeated Table and Bar switches', () => {
  const setControlValue = jest.fn();
  const tableFormData = {
    viz_type: 'table',
    row_shelf: ['region'],
    column_shelf: ['sales'],
    detail_shelf: ['platform'],
    groupby: ['region', 'platform'],
  };
  const barFormData = {
    ...tableFormData,
    viz_type: 'echarts_timeseries_bar',
    x_axis: 'region',
    groupby: ['platform'],
    orientation: 'horizontal',
  };
  const { rerender } = render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={tableFormData}
    />,
  );

  rerender(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={barFormData}
    />,
  );
  setControlValue.mockClear();
  rerender(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={tableFormData}
    />,
  );
  expect(setControlValue).toHaveBeenCalledWith('groupby', [
    'region',
    'platform',
  ]);
  setControlValue.mockClear();
  rerender(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={barFormData}
    />,
  );

  expect(screen.getByTestId('rows-shelf')).toHaveTextContent('region');
  expect(screen.getByTestId('columns-shelf')).toHaveTextContent('sales');
  expect(screen.getByTestId('detail-shelf')).toHaveTextContent('platform');
  expect(setControlValue).not.toHaveBeenCalledWith('row_shelf', []);
  expect(setControlValue).not.toHaveBeenCalledWith('column_shelf', []);
});

test('does not enable a bar chart without one dimension and one measure', () => {
  render(
    <RowsColumnsShelves
      actions={{ setControlValue: jest.fn() }}
      columns={columns}
      metrics={metrics}
      formData={{ viz_type: 'table', row_shelf: ['region'] }}
    />,
  );

  expect(screen.getByRole('button', { name: 'Bar chart' })).toBeDisabled();
});

test('maps Labels and distinct Detail dimensions to native controls', () => {
  const setControlValue = jest.fn();
  render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        row_shelf: ['region'],
        column_shelf: ['sales'],
      }}
    />,
  );

  setControlValue.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Labels' }));
  expect(setControlValue).toHaveBeenCalledWith(
    'label_shelf',
    expect.arrayContaining([
      expect.objectContaining({ aggregate: 'SUM', label: 'SUM(na_sales)' }),
    ]),
  );
  expect(setControlValue).toHaveBeenCalledWith('show_value', true);
  expect(setControlValue).toHaveBeenCalledWith(
    'label_metrics',
    expect.arrayContaining([
      expect.objectContaining({ label: 'SUM(na_sales)' }),
    ]),
  );
  expect(setControlValue).toHaveBeenCalledWith('label_fields', [
    { kind: 'metric', label: 'SUM(na_sales)' },
  ]);

  fireEvent.click(screen.getByRole('button', { name: 'Detail' }));
  expect(setControlValue).toHaveBeenCalledWith('detail_shelf', ['platform']);
  expect(setControlValue).toHaveBeenCalledWith('rich_tooltip', true);
  expect(setControlValue).toHaveBeenCalledWith('x_axis', 'region');
  expect(setControlValue).toHaveBeenCalledWith('groupby', ['platform']);
  expect(setControlValue).toHaveBeenCalledWith(
    'worksheet_state',
    expect.objectContaining({ detail: ['platform'] }),
  );
});

test('retains the same SUM measure independently in Columns and Labels', () => {
  const setControlValue = jest.fn();
  const { rerender } = render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        row_shelf: ['region'],
        column_shelf: ['sales'],
        x_axis: 'region',
        groupby: [],
        orientation: 'horizontal',
      }}
    />,
  );

  fireEvent.click(
    screen.getByRole('button', { name: 'Labels same measure' }),
  );
  expect(setControlValue).toHaveBeenCalledWith(
    'label_shelf',
    expect.arrayContaining([
      expect.objectContaining({ aggregate: 'SUM', label: 'SUM(sales)' }),
    ]),
  );
  expect(setControlValue).toHaveBeenCalledWith('show_value', true);
  expect(setControlValue).toHaveBeenCalledWith(
    'worksheet_state',
    expect.objectContaining({
      labels: [
        expect.objectContaining({ aggregate: 'SUM', label: 'SUM(sales)' }),
      ],
    }),
  );
  expect(setControlValue).not.toHaveBeenCalledWith('column_shelf', []);

  rerender(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        row_shelf: ['region'],
        column_shelf: ['sales'],
        label_shelf: ['sales'],
        x_axis: 'region',
        groupby: [],
        orientation: 'horizontal',
        show_value: true,
      }}
    />,
  );

  expect(screen.getByTestId('columns-shelf')).toHaveTextContent('SUM(sales)');
  expect(screen.getByTestId('labels-shelf')).toHaveTextContent('SUM(sales)');
});

test('queries multiple Label fields in shelf order', () => {
  const setControlValue = jest.fn();
  render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        row_shelf: ['region'],
        column_shelf: ['sales'],
        x_axis: 'region',
        groupby: [],
        orientation: 'horizontal',
      }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Labels multiple' }));
  expect(setControlValue).toHaveBeenCalledWith('label_dimensions', ['region']);
  expect(setControlValue).toHaveBeenCalledWith(
    'label_metrics',
    expect.arrayContaining([
      expect.objectContaining({ label: 'SUM(eu_sales)' }),
    ]),
  );
  expect(setControlValue).toHaveBeenCalledWith('label_fields', [
    { kind: 'dimension', label: 'region' },
    { kind: 'metric', label: 'SUM(eu_sales)' },
  ]);
});

test('adds a Label dimension to mark granularity', () => {
  const setControlValue = jest.fn();
  render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        row_shelf: ['region'],
        column_shelf: ['sales'],
        x_axis: 'region',
        groupby: [],
        orientation: 'horizontal',
      }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Labels dimension' }));
  expect(setControlValue).toHaveBeenCalledWith('label_shelf', ['platform']);
  expect(setControlValue).toHaveBeenCalledWith('label_dimensions', [
    'platform',
  ]);
  expect(setControlValue).toHaveBeenCalledWith('groupby', ['platform']);
});

test('retains a Detail dimension dropped while Bar is active', () => {
  const setControlValue = jest.fn();
  const { rerender } = render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        row_shelf: ['region'],
        column_shelf: ['sales'],
        x_axis: 'region',
        groupby: [],
        orientation: 'horizontal',
      }}
    />,
  );

  fireEvent.drop(screen.getByTestId('detail-shelf'));
  expect(setControlValue).toHaveBeenCalledWith('detail_shelf', ['platform']);
  expect(setControlValue).toHaveBeenCalledWith('groupby', ['platform']);

  rerender(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        row_shelf: ['region'],
        column_shelf: ['sales'],
        detail_shelf: ['platform'],
        x_axis: 'region',
        groupby: ['platform'],
        orientation: 'horizontal',
      }}
    />,
  );
  expect(screen.getByTestId('detail-shelf')).toHaveTextContent('platform');
});

test('round-trips numeric member filters through form data and worksheet state', () => {
  const setControlValue = jest.fn();
  const savedFilter = {
    expressionType: 'SIMPLE' as const,
    subject: 'region',
    operator: '==',
    comparator: 'East',
    clause: 'WHERE' as const,
  };
  const { rerender } = render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      datasource={datasource}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        adhoc_filters: [savedFilter],
      }}
    />,
  );

  setControlValue.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  expect(setControlValue).toHaveBeenCalledWith('adhoc_filters', [
    expect.objectContaining({ subject: 'year', comparator: ['2010'] }),
  ]);
  expect(setControlValue).toHaveBeenCalledWith(
    'worksheet_state',
    expect.objectContaining({
      filters: [expect.objectContaining({ comparator: ['2010'] })],
    }),
  );
  expect(
    new AdhocFilter({
      expressionType: 'SIMPLE',
      subject: 'year',
      operator: 'IN',
      operatorId: 'IN',
      comparator: ['2010'],
      clause: 'WHERE',
    }).translateToSql(),
  ).toBe('year IN (2010)');

  rerender(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      datasource={datasource}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        adhoc_filters: [savedFilter],
      }}
    />,
  );
  expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();

  setControlValue.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(setControlValue).toHaveBeenCalledWith('adhoc_filters', []);
  expect(setControlValue).toHaveBeenCalledWith(
    'worksheet_state',
    expect.objectContaining({ filters: [] }),
  );
});

test('undoes and redoes shelf mutations through existing query controls', () => {
  const setControlValue = jest.fn();
  render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{ viz_type: 'table' }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Rows' }));
  setControlValue.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(setControlValue).toHaveBeenCalledWith('row_shelf', []);
  expect(setControlValue).toHaveBeenCalledWith('groupby', []);

  setControlValue.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
  expect(setControlValue).toHaveBeenCalledWith('row_shelf', ['region']);
  expect(setControlValue).toHaveBeenCalledWith('groupby', ['region']);
});

test('undoes and redoes a Detail assignment with its query granularity', () => {
  const setControlValue = jest.fn();
  render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        row_shelf: ['region'],
        column_shelf: ['sales'],
        x_axis: 'region',
        groupby: [],
        orientation: 'horizontal',
      }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Detail' }));
  setControlValue.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(setControlValue).toHaveBeenCalledWith('detail_shelf', []);
  expect(setControlValue).toHaveBeenCalledWith('groupby', []);

  setControlValue.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
  expect(setControlValue).toHaveBeenCalledWith('detail_shelf', ['platform']);
  expect(setControlValue).toHaveBeenCalledWith('groupby', ['platform']);
});

test('undoes and redoes an aggregated Label assignment', () => {
  const setControlValue = jest.fn();
  render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      formData={{
        viz_type: 'echarts_timeseries_bar',
        row_shelf: ['region'],
        column_shelf: ['sales'],
        x_axis: 'region',
        groupby: [],
        orientation: 'horizontal',
      }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Labels' }));
  setControlValue.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(setControlValue).toHaveBeenCalledWith('label_shelf', []);
  expect(setControlValue).toHaveBeenCalledWith('show_value', false);

  setControlValue.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
  expect(setControlValue).toHaveBeenCalledWith(
    'label_shelf',
    expect.arrayContaining([
      expect.objectContaining({ aggregate: 'SUM', label: 'SUM(sales)' }),
    ]),
  );
  expect(setControlValue).toHaveBeenCalledWith('show_value', true);
});

test('undoes and redoes a numeric member filter', () => {
  const setControlValue = jest.fn();
  render(
    <RowsColumnsShelves
      actions={{ setControlValue }}
      columns={columns}
      metrics={metrics}
      datasource={datasource}
      formData={{ viz_type: 'echarts_timeseries_bar' }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  setControlValue.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(setControlValue).toHaveBeenCalledWith('adhoc_filters', []);

  setControlValue.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
  expect(setControlValue).toHaveBeenCalledWith('adhoc_filters', [
    expect.objectContaining({ subject: 'year', comparator: ['2010'] }),
  ]);
});

test('invalidates redo history after a new shelf edit', () => {
  render(
    <RowsColumnsShelves
      actions={{ setControlValue: jest.fn() }}
      columns={columns}
      metrics={metrics}
      formData={{ viz_type: 'table' }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Rows' }));
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled();

  fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
  expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
});
