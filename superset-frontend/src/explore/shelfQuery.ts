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
import type {
  Metric,
  QueryFormColumn,
  QueryFormMetric,
} from '@superset-ui/core';
import {
  getColumnLabel,
  getMetricLabel,
  isAdhocColumn,
} from '@superset-ui/core';
import type { ColumnMeta } from '@superset-ui/chart-controls';
import { isEqual } from 'lodash';
import type { ShelfValue } from './shelfState';

export type ShelfQueryConfiguration = {
  groupby: QueryFormColumn[];
  metrics: QueryFormMetric[];
  labelDimensions: QueryFormColumn[];
  labelMetrics: QueryFormMetric[];
  labelFields: Array<{
    kind: 'dimension' | 'metric';
    label: string;
  }>;
  xAxis?: QueryFormColumn;
  orientation?: 'horizontal' | 'vertical';
};

const sumMetric = (column: ColumnMeta): QueryFormMetric => ({
  expressionType: 'SIMPLE',
  column: {
    column_name: column.column_name,
    type: column.type,
    type_generic: column.type_generic,
  },
  aggregate: 'SUM',
  hasCustomLabel: false,
  label: `SUM(${column.column_name})`,
});

export function normalizeShelfValues(
  values: ShelfValue[],
  columns: ColumnMeta[],
  savedMetrics: Metric[],
): ShelfValue[] {
  const metricNames = new Set(savedMetrics.map(metric => metric.metric_name));
  const columnsByName = new Map(
    columns.map(column => [column.column_name, column]),
  );
  return values.map(value => {
    if (typeof value !== 'string' || metricNames.has(value)) return value;
    const column = columnsByName.get(value);
    return column?.type_generic === GenericDataType.Numeric
      ? sumMetric(column)
      : value;
  });
}

export function isDimensionShelfValue(
  value: ShelfValue,
  columns: ColumnMeta[],
  savedMetrics: Metric[],
): boolean {
  if (typeof value !== 'string') return isAdhocColumn(value);
  if (savedMetrics.some(metric => metric.metric_name === value)) return false;
  const column = columns.find(item => item.column_name === value);
  return Boolean(
    column && column.type_generic !== GenericDataType.Numeric,
  );
}

export function getShelfQueryConfiguration(
  rows: ShelfValue[],
  shelfColumns: ShelfValue[],
  columns: ColumnMeta[],
  savedMetrics: Metric[],
  vizType: string,
  detail: ShelfValue[] = [],
  labels: ShelfValue[] = [],
): ShelfQueryConfiguration {
  const normalizedRows = normalizeShelfValues(rows, columns, savedMetrics);
  const normalizedColumns = normalizeShelfValues(
    shelfColumns,
    columns,
    savedMetrics,
  );
  const columnsByName = new Map(
    columns.map(column => [column.column_name, column]),
  );
  const metricNames = new Set(savedMetrics.map(metric => metric.metric_name));
  const classifyValues = (values: ShelfValue[]) => {
    const dimensions: QueryFormColumn[] = [];
    const queryMetrics: QueryFormMetric[] = [];
    values.forEach(value => {
      if (typeof value !== 'string') {
        if (isAdhocColumn(value)) {
          dimensions.push(value);
        } else {
          queryMetrics.push(value);
        }
        return;
      }
      if (metricNames.has(value)) {
        queryMetrics.push(value);
        return;
      }
      const column = columnsByName.get(value);
      if (!column) return;
      if (column.type_generic === GenericDataType.Numeric) {
        queryMetrics.push(sumMetric(column));
      } else {
        dimensions.push(value);
      }
    });
    return { dimensions, metrics: queryMetrics };
  };
  const rowFields = classifyValues(normalizedRows);
  const columnFields = classifyValues(normalizedColumns);
  const detailDimensions = detail.filter(
    (value): value is QueryFormColumn =>
      isDimensionShelfValue(value, columns, savedMetrics),
  );
  const labelFields = classifyValues(
    normalizeShelfValues(labels, columns, savedMetrics),
  );
  const labelDimensions = labelFields.dimensions;
  const labelMetrics = labelFields.metrics;
  const orderedLabelFields = normalizeShelfValues(
    labels,
    columns,
    savedMetrics,
  ).flatMap(value => {
    const classified = classifyValues([value]);
    const dimension = classified.dimensions[0];
    if (dimension !== undefined) {
      return [{
        kind: 'dimension' as const,
        label: getColumnLabel(dimension),
      }];
    }
    const metric = classified.metrics[0];
    if (metric !== undefined) {
      return [{
        kind: 'metric' as const,
        label: getMetricLabel(metric),
      }];
    }
    return [];
  });
  const dimensions = [
    ...rowFields.dimensions,
    ...columnFields.dimensions,
    ...detailDimensions,
    ...labelDimensions,
  ];
  const uniqueDimensions = dimensions.filter(
    (dimension, index) =>
      dimensions.findIndex(value => isEqual(value, dimension)) === index,
  );
  const queryMetrics = [...rowFields.metrics, ...columnFields.metrics];

  if (vizType === 'echarts_timeseries_bar') {
    return {
      xAxis: uniqueDimensions[0],
      groupby: uniqueDimensions.slice(1),
      metrics: queryMetrics,
      labelDimensions,
      labelMetrics,
      labelFields: orderedLabelFields,
      orientation:
        rowFields.dimensions.length > 0 ? 'horizontal' : 'vertical',
    };
  }
  return {
    groupby: uniqueDimensions,
    metrics: queryMetrics,
    labelDimensions,
    labelMetrics,
    labelFields: orderedLabelFields,
  };
}
