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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import type {
  AdhocFilter,
  Metric,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
  LabelDisplaySettings,
  LabelDocument,
  LabelFieldToken,
  DataRecord,
} from '@superset-ui/core';
import {
  DEFAULT_LABEL_DISPLAY_SETTINGS,
  ensureIsArray,
  getColumnLabel,
  getLabelFieldTokens,
  getMetricLabel,
  isAdhocColumn,
  isBinaryOperator,
  isSetOperator,
  isUnaryOperator,
} from '@superset-ui/core';
import { Button, Checkbox, Flex, Select } from '@superset-ui/core/components';
import type { ColumnMeta } from '@superset-ui/chart-controls';
import { isEqual } from 'lodash';
import {
  DndColumnMetricSelect,
  DndFilterSelect,
} from 'src/explore/components/controls/DndColumnSelectControl';
import type { ExploreActions } from 'src/explore/actions/exploreActions';
import type { Datasource } from 'src/explore/types';
import {
  getShelfQueryConfiguration,
  isDimensionShelfValue,
  normalizeShelfValues,
} from 'src/explore/shelfQuery';
import type { ShelfValue } from 'src/explore/shelfState';
import {
  commitAuthoringState,
  createAuthoringHistory,
  redoAuthoringState,
  undoAuthoringState,
} from 'src/explore/authoringHistory';
import {
  createWorksheetState,
  restoreWorksheetState,
} from 'src/explore/worksheetPersistence';
import { LabelEditorModal } from './LabelEditorModal';

type ShelfFormData = QueryFormData & {
  row_shelf?: ShelfValue[];
  column_shelf?: ShelfValue[];
  label_shelf?: ShelfValue[];
  detail_shelf?: ShelfValue[];
  label_dimensions?: QueryFormColumn[];
  label_metrics?: QueryFormMetric[];
  label_fields?: ShelfQueryConfiguration['labelFields'];
  label_document?: LabelDocument;
  label_display?: LabelDisplaySettings;
  worksheet_state?: unknown;
};

type AuthoringSnapshot = Pick<
  ShelfFormData,
  | 'row_shelf'
  | 'column_shelf'
  | 'label_shelf'
  | 'detail_shelf'
  | 'adhoc_filters'
  | 'viz_type'
  | 'label_document'
  | 'label_display'
>;

const createDefaultLabelDocument = (
  fields: LabelFieldToken[],
): LabelDocument => ({
  version: 1,
  paragraphs: [
    {
      id: 'default',
      alignment: 'left',
      nodes: fields.flatMap((field, index) => [
        ...(index > 0
          ? [{ type: 'text' as const, id: `space-${index}`, text: ' ' }]
          : []),
        { ...field, id: `default-${index}-${field.id}` },
      ]),
    },
  ],
});

const getShelfFieldLabel = (field: ShelfValue) =>
  typeof field === 'string' || !isAdhocColumn(field)
    ? getMetricLabel(field)
    : getColumnLabel(field);

const parseMarksToLabel = (
  value: unknown,
): LabelDisplaySettings['marksToLabel'] =>
  value === 'selected' || value === 'highlighted' ? value : 'all';

const parseLabelPosition = (
  value: unknown,
): LabelDisplaySettings['position'] =>
  value === 'top' ||
  value === 'bottom' ||
  value === 'left' ||
  value === 'right' ||
  value === 'inside'
    ? value
    : 'auto';

const normalizeAdhocFilter = (value: unknown): AdhocFilter | undefined => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('clause' in value) ||
    (value.clause !== 'WHERE' && value.clause !== 'HAVING') ||
    !('expressionType' in value)
  ) {
    return undefined;
  }
  if (value.expressionType === 'SQL') {
    return 'sqlExpression' in value && typeof value.sqlExpression === 'string'
      ? {
          clause: value.clause,
          expressionType: 'SQL',
          sqlExpression: value.sqlExpression,
        }
      : undefined;
  }
  if (
    value.expressionType !== 'SIMPLE' ||
    !('subject' in value) ||
    typeof value.subject !== 'string' ||
    !('operator' in value) ||
    typeof value.operator !== 'string'
  ) {
    return undefined;
  }
  if (isUnaryOperator(value.operator)) {
    return {
      clause: value.clause,
      expressionType: 'SIMPLE',
      subject: value.subject,
      operator: value.operator,
    };
  }
  if (!('comparator' in value)) {
    return undefined;
  }
  if (
    isBinaryOperator(value.operator) &&
    ['string', 'number', 'boolean'].includes(typeof value.comparator)
  ) {
    return {
      clause: value.clause,
      expressionType: 'SIMPLE',
      subject: value.subject,
      operator: value.operator,
      comparator: String(value.comparator),
    };
  }
  if (
    isSetOperator(value.operator) &&
    Array.isArray(value.comparator) &&
    value.comparator.every(item =>
      ['string', 'number', 'boolean'].includes(typeof item),
    )
  ) {
    return {
      clause: value.clause,
      expressionType: 'SIMPLE',
      subject: value.subject,
      operator: value.operator,
      comparator: value.comparator.map(String),
    };
  }
  return undefined;
};

const snapshotFromFormData = (formData: ShelfFormData): AuthoringSnapshot => ({
  row_shelf:
    formData.row_shelf ??
    restoreWorksheetState(formData)?.rows ??
    formData.groupby ??
    [],
  column_shelf:
    formData.column_shelf ??
    restoreWorksheetState(formData)?.columns ??
    formData.metrics ??
    [],
  label_shelf:
    formData.label_shelf ?? restoreWorksheetState(formData)?.labels ?? [],
  detail_shelf:
    formData.detail_shelf ?? restoreWorksheetState(formData)?.detail ?? [],
  adhoc_filters:
    formData.adhoc_filters ?? restoreWorksheetState(formData)?.filters ?? [],
  viz_type: formData.viz_type,
  label_document:
    formData.label_document ??
    restoreWorksheetState(formData)?.formatting.labelDocument,
  label_display:
    formData.label_display ??
    restoreWorksheetState(formData)?.formatting.labelDisplay,
});

export type RowsColumnsShelvesProps = {
  actions: Pick<ExploreActions, 'setControlValue'>;
  columns: ColumnMeta[];
  metrics: Metric[];
  formData: ShelfFormData;
  datasource?: Datasource;
  previewRecord?: DataRecord;
  previewLabelMap?: Record<string, string[]>;
};

export function RowsColumnsShelves({
  actions,
  columns,
  metrics,
  formData,
  datasource,
  previewRecord,
  previewLabelMap = {},
}: RowsColumnsShelvesProps) {
  const restoredWorksheet = useMemo(
    () => restoreWorksheetState(formData),
    [formData],
  );
  const [history, setHistory] = useState(() =>
    createAuthoringHistory(snapshotFromFormData(formData)),
  );
  const [labelEditorOpen, setLabelEditorOpen] = useState(false);
  const rawRows =
    formData.row_shelf ?? restoredWorksheet?.rows ?? formData.groupby ?? [];
  const rawColumnShelf =
    formData.column_shelf ??
    restoredWorksheet?.columns ??
    formData.metrics ??
    [];
  const rows = useMemo(
    () => normalizeShelfValues(rawRows, columns, metrics),
    [columns, metrics, rawRows],
  );
  const columnShelf = useMemo(
    () => normalizeShelfValues(rawColumnShelf, columns, metrics),
    [columns, metrics, rawColumnShelf],
  );
  const rawLabelShelf =
    formData.label_shelf ?? restoredWorksheet?.labels ?? [];
  const labelShelf = useMemo(
    () => normalizeShelfValues(rawLabelShelf, columns, metrics),
    [columns, metrics, rawLabelShelf],
  );
  const detailShelf = formData.detail_shelf ?? restoredWorksheet?.detail ?? [];
  const filterShelf =
    formData.adhoc_filters ?? restoredWorksheet?.filters ?? [];
  const availableLabelFields = useMemo<LabelFieldToken[]>(() => {
    const columnFields = columns.map(column => {
      const queryField = normalizeShelfValues(
        [column.column_name],
        columns,
        metrics,
      )[0];
      const dimension = isDimensionShelfValue(
        queryField,
        columns,
        metrics,
      );
      return {
        type: 'field' as const,
        id: dimension
          ? `column:${column.column_name}`
          : `column:${column.column_name}:SUM`,
        fieldType: dimension ? ('dimension' as const) : ('measure' as const),
        label: dimension ? column.column_name : getShelfFieldLabel(queryField),
        queryField,
      };
    });
    const metricFields = metrics.map(metric => ({
      type: 'field' as const,
      id: `metric:${metric.uuid ?? metric.metric_name}`,
      fieldType: 'calculated' as const,
      label: metric.metric_name,
      queryField: metric.metric_name,
    }));
    return [...columnFields, ...metricFields];
  }, [columns, metrics]);
  const labelDocument =
    formData.label_document ??
    restoredWorksheet?.formatting.labelDocument ??
    createDefaultLabelDocument(
      labelShelf.flatMap((field, index) => {
        const match = availableLabelFields.find(candidate =>
          isEqual(candidate.queryField, field),
        );
        return match ? [{ ...match, id: `${match.id}:${index}` }] : [];
      }),
    );
  const labelDisplay =
    formData.label_display ??
    restoredWorksheet?.formatting.labelDisplay ??
    DEFAULT_LABEL_DISPLAY_SETTINGS;
  const labelPreviewValues = useMemo(
    () =>
      new Map(
        getLabelFieldTokens(labelDocument).map(token => {
          if (!previewRecord || token.queryField === undefined) {
            return [token.id, undefined] as const;
          }
          const fieldLabel =
            token.fieldType === 'dimension'
              ? getColumnLabel(token.queryField)
              : getMetricLabel(token.queryField);
          const mappedKey = Object.keys(previewLabelMap).find(
            key => previewLabelMap[key]?.[0] === fieldLabel,
          );
          const value = previewRecord[fieldLabel] ??
            (mappedKey ? previewRecord[mappedKey] : undefined);
          return [
            token.id,
            typeof value === 'string' ||
            typeof value === 'number' ||
            value === null
              ? value
              : undefined,
          ] as const;
        }),
      ),
    [labelDocument, previewLabelMap, previewRecord],
  );
  const labelPreviewFieldValues = useMemo(
    () =>
      new Map(
        availableLabelFields.map(field => {
          if (!previewRecord) return [field.label, undefined] as const;
          const mappedKey = Object.keys(previewLabelMap).find(
            key => previewLabelMap[key]?.[0] === field.label,
          );
          const value = previewRecord[field.label] ??
            (mappedKey ? previewRecord[mappedKey] : undefined);
          return [
            field.label,
            typeof value === 'string' ||
            typeof value === 'number' ||
            value === null
              ? value
              : undefined,
          ] as const;
        }),
      ),
    [availableLabelFields, previewLabelMap, previewRecord],
  );
  const persistWorksheetState = useCallback(
    (changes: Partial<ShelfFormData>) => {
      actions.setControlValue(
        'worksheet_state',
        createWorksheetState({
          ...formData,
          row_shelf: rows,
          column_shelf: columnShelf,
          label_shelf: labelShelf,
          detail_shelf: detailShelf,
          adhoc_filters: filterShelf,
          ...changes,
        }),
      );
    },
    [
      actions,
      columnShelf,
      detailShelf,
      filterShelf,
      formData,
      labelShelf,
      rows,
    ],
  );
  const barQuery = useMemo(
    () =>
      getShelfQueryConfiguration(
        rows,
        columnShelf,
        columns,
        metrics,
        'echarts_timeseries_bar',
        detailShelf,
        labelShelf,
      ),
    [columnShelf, columns, detailShelf, labelShelf, metrics, rows],
  );
  const synchronizedVizType = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (
      formData.viz_type !== 'table' &&
      formData.viz_type !== 'echarts_timeseries_bar'
    ) {
      synchronizedVizType.current = undefined;
      return;
    }
    if (synchronizedVizType.current === formData.viz_type) return;
    synchronizedVizType.current = formData.viz_type;
    const query = getShelfQueryConfiguration(
      rows,
      columnShelf,
      columns,
      metrics,
      formData.viz_type,
      detailShelf,
      labelShelf,
    );
    if (!isEqual(formData.groupby ?? [], query.groupby)) {
      actions.setControlValue('groupby', query.groupby);
    }
    if (!isEqual(formData.metrics ?? [], query.metrics)) {
      actions.setControlValue('metrics', query.metrics);
    }
    actions.setControlValue('label_dimensions', query.labelDimensions);
    actions.setControlValue('label_metrics', query.labelMetrics);
    actions.setControlValue('label_fields', query.labelFields);
    if (formData.viz_type === 'echarts_timeseries_bar') {
      if (!isEqual(formData.x_axis, query.xAxis)) {
        actions.setControlValue('x_axis', query.xAxis);
      }
      if (formData.orientation !== query.orientation) {
        actions.setControlValue('orientation', query.orientation);
      }
    }
  }, [
    actions,
    columnShelf,
    columns,
    formData.groupby,
    formData.metrics,
    formData.orientation,
    formData.viz_type,
    formData.x_axis,
    metrics,
    rows,
    detailShelf,
    labelShelf,
  ]);
  const recordChange = useCallback((changes: Partial<AuthoringSnapshot>) => {
    setHistory(current =>
      commitAuthoringState(current, { ...current.present, ...changes }),
    );
  }, []);

  const updateQueryControls = useCallback(
    (
      nextRows: ShelfValue[],
      nextColumns: ShelfValue[],
      nextDetail: ShelfValue[] = detailShelf,
      nextLabels: ShelfValue[] = labelShelf,
    ) => {
      const query = getShelfQueryConfiguration(
        nextRows,
        nextColumns,
        columns,
        metrics,
        formData.viz_type,
        nextDetail,
        nextLabels,
      );
      actions.setControlValue('groupby', query.groupby);
      actions.setControlValue('metrics', query.metrics);
      actions.setControlValue('label_dimensions', query.labelDimensions);
      actions.setControlValue('label_metrics', query.labelMetrics);
      actions.setControlValue('label_fields', query.labelFields);
      if (formData.viz_type === 'echarts_timeseries_bar') {
        actions.setControlValue('x_axis', query.xAxis);
        actions.setControlValue('orientation', query.orientation);
      }
      return query;
    },
    [
      actions,
      columns,
      detailShelf,
      formData.viz_type,
      labelShelf,
      metrics,
    ],
  );

  const updateShelf = useCallback(
    (
      name: 'row_shelf' | 'column_shelf',
      value: ShelfValue | ShelfValue[] | null | undefined,
    ) => {
      const nextValue = normalizeShelfValues(
        value == null ? [] : ensureIsArray(value),
        columns,
        metrics,
      );
      const otherName =
        name === 'row_shelf' ? 'column_shelf' : 'row_shelf';
      const otherValues = name === 'row_shelf' ? columnShelf : rows;
      const nextOtherValues = otherValues.filter(
        otherValue =>
          !nextValue.some(nextShelfValue => isEqual(otherValue, nextShelfValue)),
      );
      actions.setControlValue(name, nextValue);
      if (!isEqual(otherValues, nextOtherValues)) {
        actions.setControlValue(otherName, nextOtherValues);
      }
      const query = updateQueryControls(
        name === 'row_shelf' ? nextValue : nextOtherValues,
        name === 'column_shelf' ? nextValue : nextOtherValues,
      );
      persistWorksheetState({
        row_shelf: name === 'row_shelf' ? nextValue : nextOtherValues,
        column_shelf: name === 'column_shelf' ? nextValue : nextOtherValues,
        orientation: query.orientation ?? formData.orientation,
      });
      recordChange({
        row_shelf: name === 'row_shelf' ? nextValue : nextOtherValues,
        column_shelf: name === 'column_shelf' ? nextValue : nextOtherValues,
      });
    },
    [
      actions,
      columnShelf,
      columns,
      formData.orientation,
      metrics,
      persistWorksheetState,
      recordChange,
      rows,
      updateQueryControls,
    ],
  );

  const selectBarChart = useCallback(() => {
    actions.setControlValue('viz_type', 'echarts_timeseries_bar');
    actions.setControlValue('groupby', barQuery.groupby);
    actions.setControlValue('metrics', barQuery.metrics);
    actions.setControlValue('label_dimensions', barQuery.labelDimensions);
    actions.setControlValue('label_metrics', barQuery.labelMetrics);
    actions.setControlValue('label_fields', barQuery.labelFields);
    actions.setControlValue('x_axis', barQuery.xAxis);
    actions.setControlValue('orientation', barQuery.orientation);
    persistWorksheetState({ orientation: barQuery.orientation });
    recordChange({ viz_type: 'echarts_timeseries_bar' });
  }, [actions, barQuery, persistWorksheetState, recordChange]);

  const updateMarkShelf = useCallback(
    (
      name: 'label_shelf' | 'detail_shelf',
      value: ShelfValue | ShelfValue[] | null | undefined,
    ) => {
      const requestedValues = value == null ? [] : ensureIsArray(value);
      const normalizedValues =
        name === 'label_shelf'
          ? normalizeShelfValues(requestedValues, columns, metrics)
          : requestedValues;
      const nextValue = normalizedValues.filter(markField =>
        name === 'detail_shelf'
          ? isDimensionShelfValue(markField, columns, metrics)
          : typeof markField !== 'string' ||
            columns.some(column => column.column_name === markField) ||
            metrics.some(metric => metric.metric_name === markField),
      );
      actions.setControlValue(name, nextValue);
      actions.setControlValue(
        name === 'label_shelf' ? 'show_value' : 'rich_tooltip',
        nextValue.length > 0,
      );
      if (name === 'detail_shelf') {
        updateQueryControls(rows, columnShelf, nextValue);
      } else {
        updateQueryControls(rows, columnShelf, detailShelf, nextValue);
      }
      if (name === 'label_shelf') {
        const retainedDocument: LabelDocument = {
          ...labelDocument,
          paragraphs: labelDocument.paragraphs.map(paragraph => ({
            ...paragraph,
            nodes: paragraph.nodes.filter(
              node =>
                node.type === 'text' ||
                node.queryField === undefined ||
                nextValue.some(field => isEqual(field, node.queryField)),
            ),
          })),
        };
        const retainedFields = getLabelFieldTokens(retainedDocument);
        const missingFields = nextValue.flatMap((field, index) => {
          if (
            retainedFields.some(token => isEqual(token.queryField, field))
          ) {
            return [];
          }
          const source = availableLabelFields.find(candidate =>
            isEqual(candidate.queryField, field),
          );
          return source
            ? [{ ...source, id: `${source.id}:shelf-${index}` }]
            : [];
        });
        const lastIndex = retainedDocument.paragraphs.length - 1;
        const nextDocument = {
          ...retainedDocument,
          paragraphs: retainedDocument.paragraphs.map((paragraph, index) =>
            index === lastIndex
              ? { ...paragraph, nodes: [...paragraph.nodes, ...missingFields] }
              : paragraph,
          ),
        };
        actions.setControlValue('label_document', nextDocument);
        persistWorksheetState({
          label_shelf: nextValue,
          label_document: nextDocument,
        });
        recordChange({
          label_shelf: nextValue,
          label_document: nextDocument,
        });
      } else {
        persistWorksheetState({ detail_shelf: nextValue });
        recordChange({ detail_shelf: nextValue });
      }
    },
    [
      actions,
      columnShelf,
      columns,
      detailShelf,
      availableLabelFields,
      labelDocument,
      metrics,
      persistWorksheetState,
      recordChange,
      rows,
      updateQueryControls,
    ],
  );

  const applySnapshot = useCallback(
    (snapshot: AuthoringSnapshot) => {
      const snapshotRows = snapshot.row_shelf ?? [];
      const snapshotColumns = snapshot.column_shelf ?? [];
      const query = getShelfQueryConfiguration(
        snapshotRows,
        snapshotColumns,
        columns,
        metrics,
        snapshot.viz_type,
        snapshot.detail_shelf ?? [],
        snapshot.label_shelf ?? [],
      );
      actions.setControlValue('row_shelf', snapshotRows);
      actions.setControlValue('column_shelf', snapshotColumns);
      actions.setControlValue('label_shelf', snapshot.label_shelf ?? []);
      actions.setControlValue('detail_shelf', snapshot.detail_shelf ?? []);
      actions.setControlValue('adhoc_filters', snapshot.adhoc_filters ?? []);
      actions.setControlValue('viz_type', snapshot.viz_type);
      actions.setControlValue('groupby', query.groupby);
      actions.setControlValue('metrics', query.metrics);
      actions.setControlValue('label_dimensions', query.labelDimensions);
      actions.setControlValue('label_metrics', query.labelMetrics);
      actions.setControlValue('label_fields', query.labelFields);
      actions.setControlValue('label_document', snapshot.label_document);
      actions.setControlValue('label_display', snapshot.label_display);
      actions.setControlValue('x_axis', query.xAxis);
      if (snapshot.viz_type === 'echarts_timeseries_bar') {
        actions.setControlValue('orientation', query.orientation);
      }
      persistWorksheetState({
        ...snapshot,
        orientation:
          query.orientation ??
          restoreWorksheetState(formData)?.formatting.orientation,
      });
      actions.setControlValue(
        'show_value',
        snapshot.label_display?.visible ??
          (snapshot.label_shelf?.length ?? 0) > 0,
      );
      actions.setControlValue(
        'rich_tooltip',
        (snapshot.detail_shelf?.length ?? 0) > 0,
      );
    },
    [actions, columns, formData, metrics, persistWorksheetState],
  );

  const undo = useCallback(() => {
    const nextHistory = undoAuthoringState(history);
    setHistory(nextHistory);
    applySnapshot(nextHistory.present);
  }, [applySnapshot, history]);

  const redo = useCallback(() => {
    const nextHistory = redoAuthoringState(history);
    setHistory(nextHistory);
    applySnapshot(nextHistory.present);
  }, [applySnapshot, history]);

  const applyLabelDocument = useCallback(
    (nextDocument: LabelDocument) => {
      const fields = normalizeShelfValues(
        getLabelFieldTokens(nextDocument).flatMap(token =>
          token.queryField === undefined ? [] : [token.queryField],
        ),
        columns,
        metrics,
      ).filter(field =>
        availableLabelFields.some(candidate =>
          isEqual(candidate.queryField, field),
        ) || labelShelf.some(existing => isEqual(existing, field)),
      );
      actions.setControlValue('label_shelf', fields);
      actions.setControlValue('show_value', fields.length > 0);
      updateQueryControls(rows, columnShelf, detailShelf, fields);
      actions.setControlValue('label_document', nextDocument);
      persistWorksheetState({
        label_document: nextDocument,
        label_shelf: fields,
      });
      recordChange({
        label_document: nextDocument,
        label_shelf: fields,
      });
    },
    [
      actions,
      availableLabelFields,
      columnShelf,
      columns,
      detailShelf,
      metrics,
      labelShelf,
      persistWorksheetState,
      recordChange,
      rows,
      updateQueryControls,
    ],
  );

  const updateLabelDisplay = useCallback(
    (nextDisplay: LabelDisplaySettings) => {
      actions.setControlValue('label_display', nextDisplay);
      actions.setControlValue('show_value', nextDisplay.visible);
      persistWorksheetState({ label_display: nextDisplay });
      recordChange({ label_display: nextDisplay });
    },
    [actions, persistWorksheetState, recordChange],
  );

  return (
    <div data-test="rows-columns-shelves">
      <DndColumnMetricSelect
        name="row_shelf"
        label={t('Rows')}
        columns={columns}
        savedMetrics={metrics}
        selectedMetrics={formData.metrics}
        value={rows}
        actions={actions}
        formData={formData}
        onChange={value => updateShelf('row_shelf', value)}
      />
      <DndColumnMetricSelect
        name="column_shelf"
        label={t('Columns')}
        columns={columns}
        savedMetrics={metrics}
        selectedMetrics={formData.metrics}
        value={columnShelf}
        actions={actions}
        formData={formData}
        onChange={value => updateShelf('column_shelf', value)}
      />
      <DndColumnMetricSelect
        name="label_shelf"
        label={t('Labels')}
        columns={columns}
        savedMetrics={metrics}
        selectedMetrics={formData.metrics}
        value={labelShelf}
        actions={actions}
        formData={formData}
        onChange={value => updateMarkShelf('label_shelf', value)}
      />
      <Flex vertical gap="small">
        <Checkbox
          checked={labelDisplay.visible}
          onChange={event =>
            updateLabelDisplay({
              ...labelDisplay,
              visible: event.target.checked,
            })
          }
        >
          {t('Show Mark Labels')}
        </Checkbox>
        <Button onClick={() => setLabelEditorOpen(true)}>
          {t('Edit Label')}
        </Button>
        <Select
          ariaLabel={t('Marks to Label')}
          value={labelDisplay.marksToLabel}
          options={[
            { value: 'all', label: t('All marks') },
            { value: 'selected', label: t('Selected marks') },
            {
              value: 'highlighted',
              label: t('Highlighted marks'),
            },
          ]}
          onChange={value =>
            updateLabelDisplay({
              ...labelDisplay,
              marksToLabel: parseMarksToLabel(value),
            })
          }
        />
        <Checkbox
          checked={labelDisplay.allowOverlap}
          onChange={event =>
            updateLabelDisplay({
              ...labelDisplay,
              allowOverlap: event.target.checked,
            })
          }
        >
          {t('Allow labels to overlap')}
        </Checkbox>
        <Select
          ariaLabel={t('Label position')}
          value={labelDisplay.position}
          options={['auto', 'top', 'bottom', 'left', 'right', 'inside'].map(
            value => ({ value, label: value }),
          )}
          onChange={value =>
            updateLabelDisplay({
              ...labelDisplay,
              position: parseLabelPosition(value),
            })
          }
        />
        <Select
          ariaLabel={t('Label alignment')}
          value={labelDisplay.alignment}
          options={['left', 'center', 'right'].map(value => ({
            value,
            label: value,
          }))}
          onChange={value =>
            updateLabelDisplay({
              ...labelDisplay,
              alignment:
                value === 'left' || value === 'right' ? value : 'center',
            })
          }
        />
      </Flex>
      <DndColumnMetricSelect
        name="detail_shelf"
        label={t('Detail')}
        columns={columns}
        savedMetrics={metrics}
        selectedMetrics={formData.metrics}
        value={detailShelf}
        actions={actions}
        formData={formData}
        onChange={value => updateMarkShelf('detail_shelf', value)}
      />
      {datasource && (
        <DndFilterSelect
          name="adhoc_filters"
          label={t('Filters')}
          columns={columns}
          savedMetrics={metrics}
          selectedMetrics={formData.metrics ?? []}
          datasource={datasource}
          value={filterShelf}
          actions={actions}
          formData={formData}
          onChange={value => {
            const filters = value
              .map(normalizeAdhocFilter)
              .filter((filter): filter is AdhocFilter => filter !== undefined);
            actions.setControlValue('adhoc_filters', filters);
            persistWorksheetState({ adhoc_filters: filters });
            recordChange({ adhoc_filters: filters });
          }}
        />
      )}
      <Button disabled={history.past.length === 0} onClick={undo}>
        {t('Undo')}
      </Button>
      <Button disabled={history.future.length === 0} onClick={redo}>
        {t('Redo')}
      </Button>
      <Button
        buttonStyle={
          formData.viz_type === 'echarts_timeseries_bar'
            ? 'primary'
            : 'secondary'
        }
        disabled={!barQuery.xAxis || barQuery.metrics.length !== 1}
        onClick={selectBarChart}
      >
        {t('Bar chart')}
      </Button>
      <LabelEditorModal
        show={labelEditorOpen}
        document={labelDocument}
        availableFields={availableLabelFields}
        previewValues={labelPreviewValues}
        previewFieldValues={labelPreviewFieldValues}
        onApply={applyLabelDocument}
        onHide={() => setLabelEditorOpen(false)}
      />
    </div>
  );
}
