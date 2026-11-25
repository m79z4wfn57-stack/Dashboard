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
import type {
  LabelDisplaySettings,
  LabelDocument,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';
import type { ShelfValue } from './shelfState';

export type WorksheetShelfFormData = QueryFormData & {
  row_shelf?: ShelfValue[];
  column_shelf?: ShelfValue[];
  label_shelf?: ShelfValue[];
  detail_shelf?: ShelfValue[];
  label_dimensions?: QueryFormColumn[];
  label_metrics?: QueryFormMetric[];
  label_fields?: Array<{
    kind: 'dimension' | 'metric';
    label: string;
  }>;
  label_document?: LabelDocument;
  label_display?: LabelDisplaySettings;
  worksheet_state?: unknown;
};

export function preserveWorksheetFormData(
  projectedFormData: QueryFormData,
  stateFormData: WorksheetShelfFormData,
  enabled: boolean,
): WorksheetShelfFormData {
  if (!enabled) return projectedFormData;
  return {
    ...projectedFormData,
    ...(stateFormData.row_shelf !== undefined && {
      row_shelf: stateFormData.row_shelf,
    }),
    ...(stateFormData.column_shelf !== undefined && {
      column_shelf: stateFormData.column_shelf,
    }),
    ...(stateFormData.label_shelf !== undefined && {
      label_shelf: stateFormData.label_shelf,
    }),
    ...(stateFormData.detail_shelf !== undefined && {
      detail_shelf: stateFormData.detail_shelf,
    }),
    ...(stateFormData.label_dimensions !== undefined && {
      label_dimensions: stateFormData.label_dimensions,
    }),
    ...(stateFormData.label_metrics !== undefined && {
      label_metrics: stateFormData.label_metrics,
    }),
    ...(stateFormData.label_fields !== undefined && {
      label_fields: stateFormData.label_fields,
    }),
    ...(stateFormData.label_document !== undefined && {
      label_document: stateFormData.label_document,
    }),
    ...(stateFormData.label_display !== undefined && {
      label_display: stateFormData.label_display,
    }),
    ...(stateFormData.worksheet_state !== undefined && {
      worksheet_state: stateFormData.worksheet_state,
    }),
  };
}
