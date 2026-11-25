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
import {
  isLabelDocument,
  type AdhocFilter,
  type LabelDisplaySettings,
  type LabelDocument,
  type QueryFormData,
} from '@superset-ui/core';
import type { ShelfValue } from './shelfState';

const MAX_SHELF_FIELDS = 50;
const MAX_FILTERS = 100;

export type WorksheetState = {
  version: 1;
  datasource?: string;
  rows: ShelfValue[];
  columns: ShelfValue[];
  labels: ShelfValue[];
  detail: ShelfValue[];
  filters: AdhocFilter[];
  formatting: {
    showValue?: boolean;
    richTooltip?: boolean;
    orientation?: string;
    colorScheme?: string;
    numberFormat?: string;
    labelDocument?: LabelDocument;
    labelDisplay?: LabelDisplaySettings;
  };
};

type WorksheetFormData = QueryFormData & {
  row_shelf?: ShelfValue[];
  column_shelf?: ShelfValue[];
  label_shelf?: ShelfValue[];
  detail_shelf?: ShelfValue[];
  worksheet_state?: unknown;
  label_document?: LabelDocument;
  label_display?: LabelDisplaySettings;
};

const isBoundedArray = (value: unknown, limit: number): value is unknown[] =>
  Array.isArray(value) && value.length <= limit;

const isLabelDisplaySettings = (
  value: unknown,
): value is LabelDisplaySettings => {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Partial<LabelDisplaySettings>;
  return (
    typeof settings.visible === 'boolean' &&
    ['all', 'selected', 'highlighted'].includes(settings.marksToLabel ?? '') &&
    typeof settings.allowOverlap === 'boolean' &&
    ['auto', 'top', 'bottom', 'left', 'right', 'inside'].includes(
      settings.position ?? '',
    ) &&
    ['left', 'center', 'right'].includes(settings.alignment ?? '')
  );
};

export function createWorksheetState(
  formData: WorksheetFormData,
): WorksheetState {
  return {
    version: 1,
    datasource: formData.datasource,
    rows: (formData.row_shelf ?? formData.groupby ?? []).slice(
      0,
      MAX_SHELF_FIELDS,
    ),
    columns: (formData.column_shelf ?? formData.metrics ?? []).slice(
      0,
      MAX_SHELF_FIELDS,
    ),
    labels: (formData.label_shelf ?? []).slice(0, MAX_SHELF_FIELDS),
    detail: (formData.detail_shelf ?? []).slice(0, MAX_SHELF_FIELDS),
    filters: (formData.adhoc_filters ?? []).slice(0, MAX_FILTERS),
    formatting: {
      showValue: formData.show_value,
      richTooltip: formData.rich_tooltip,
      orientation: formData.orientation,
      colorScheme: formData.color_scheme,
      numberFormat: formData.y_axis_format,
      labelDocument: formData.label_document,
      labelDisplay: formData.label_display,
    },
  };
}

export function restoreWorksheetState(
  formData: WorksheetFormData,
): WorksheetState | undefined {
  const value = formData.worksheet_state;
  if (!value || typeof value !== 'object') return undefined;
  const state = value as Partial<WorksheetState>;
  if (
    state.version !== 1 ||
    (state.datasource !== undefined && state.datasource !== formData.datasource) ||
    !isBoundedArray(state.rows, MAX_SHELF_FIELDS) ||
    !isBoundedArray(state.columns, MAX_SHELF_FIELDS) ||
    !isBoundedArray(state.labels, MAX_SHELF_FIELDS) ||
    !isBoundedArray(state.detail, MAX_SHELF_FIELDS) ||
    !isBoundedArray(state.filters, MAX_FILTERS) ||
    !state.formatting ||
    typeof state.formatting !== 'object'
  ) {
    return undefined;
  }
  if (
    state.formatting.labelDisplay !== undefined &&
    !isLabelDisplaySettings(state.formatting.labelDisplay)
  ) {
    return undefined;
  }
  if (
    state.formatting.labelDocument !== undefined &&
    !isLabelDocument(state.formatting.labelDocument)
  ) {
    return undefined;
  }
  return state as WorksheetState;
}

export function withWorksheetState(
  formData: WorksheetFormData,
): WorksheetFormData & { worksheet_state: WorksheetState } {
  return { ...formData, worksheet_state: createWorksheetState(formData) };
}
