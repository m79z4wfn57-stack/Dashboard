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
import { preserveWorksheetFormData } from './worksheetFormData';

const worksheetState = {
  version: 1,
  rows: ['genre'],
  columns: ['global_sales'],
  labels: [],
  detail: ['platform'],
  filters: [],
  formatting: { orientation: 'horizontal' },
};

test('preserves shelf state across repeated native control projections', () => {
  const stateFormData = {
    viz_type: 'echarts_timeseries_bar',
    row_shelf: ['genre'],
    column_shelf: ['global_sales'],
    detail_shelf: ['platform'],
    worksheet_state: worksheetState,
  };

  const firstProjection = preserveWorksheetFormData(
    { viz_type: 'echarts_timeseries_bar', x_axis: 'genre', groupby: [] },
    stateFormData,
    true,
  );
  const secondProjection = preserveWorksheetFormData(
    { ...firstProjection, metrics: ['SUM(global_sales)'] },
    firstProjection,
    true,
  );

  expect(secondProjection).toMatchObject({
    row_shelf: ['genre'],
    column_shelf: ['global_sales'],
    detail_shelf: ['platform'],
    worksheet_state: worksheetState,
    x_axis: 'genre',
    groupby: [],
  });
});

test('preserves shelves through Table and Bar native projections', () => {
  const tableProjection = preserveWorksheetFormData(
    { viz_type: 'table', groupby: ['genre'] },
    {
      viz_type: 'table',
      row_shelf: ['genre'],
      column_shelf: ['global_sales'],
      detail_shelf: ['platform'],
      worksheet_state: worksheetState,
    },
    true,
  );
  const barProjection = preserveWorksheetFormData(
    {
      viz_type: 'echarts_timeseries_bar',
      x_axis: 'genre',
      groupby: [],
    },
    tableProjection,
    true,
  );
  const restoredTableProjection = preserveWorksheetFormData(
    { viz_type: 'table', groupby: ['genre'] },
    barProjection,
    true,
  );

  expect(restoredTableProjection).toMatchObject({
    row_shelf: ['genre'],
    column_shelf: ['global_sales'],
    detail_shelf: ['platform'],
    worksheet_state: worksheetState,
  });
});

test('leaves native form data unchanged when parity mode is disabled', () => {
  const projectedFormData = {
    viz_type: 'echarts_timeseries_bar',
    x_axis: 'genre',
  };

  expect(
    preserveWorksheetFormData(
      projectedFormData,
      { ...projectedFormData, row_shelf: ['genre'] },
      false,
    ),
  ).toBe(projectedFormData);
});
