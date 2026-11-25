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
import { DatasourceType } from '@superset-ui/core';
import type { Dataset } from '@superset-ui/chart-controls';
import { shouldUseTimeRangeFilter } from './filterSemantics';

const datasource: Dataset = {
  id: 20,
  type: DatasourceType.Table,
  columns: [
    {
      column_name: 'year',
      type: 'DOUBLE',
      type_generic: GenericDataType.Numeric,
      is_dttm: true,
    },
    {
      column_name: 'event_time',
      type: 'TIMESTAMP',
      type_generic: GenericDataType.Temporal,
      is_dttm: true,
    },
  ],
  metrics: [],
  column_formats: {},
  verbose_map: {},
  main_dttm_col: 'event_time',
  datasource_name: 'video_game_sales',
  description: null,
};

test('uses member filtering for a numeric year only in parity mode', () => {
  expect(shouldUseTimeRangeFilter('year', datasource, true)).toBe(false);
  expect(shouldUseTimeRangeFilter('year', datasource, false)).toBe(true);
});

test('preserves time ranges for genuine temporal columns', () => {
  expect(shouldUseTimeRangeFilter('event_time', datasource, true)).toBe(true);
});
