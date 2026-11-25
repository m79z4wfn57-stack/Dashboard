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
  buildQueryContext,
  ensureIsArray,
  getMetricLabel,
  getXAxisColumn,
  isXAxisSet,
  normalizeOrderBy,
  PostProcessingPivot,
  QueryFormData,
} from '@superset-ui/core';
import {
  contributionOperator,
  extractExtraMetrics,
  flattenOperator,
  isTimeComparison,
  pivotOperator,
  prophetOperator,
  renameOperator,
  resampleOperator,
  rollingWindowOperator,
  sortOperator,
  timeComparePivotOperator,
  timeCompareOperator,
} from '@superset-ui/chart-controls';

export default function buildQuery(formData: QueryFormData) {
  const labelMetrics = ensureIsArray(formData.label_metrics);
  const queryMetrics = [...ensureIsArray(formData.metrics)];
  labelMetrics.forEach(metric => {
    const label = getMetricLabel(metric);
    if (!queryMetrics.some(value => getMetricLabel(value) === label)) {
      queryMetrics.push(metric);
    }
  });
  const queryFormData =
    labelMetrics.length > 0 ? { ...formData, metrics: queryMetrics } : formData;
  const { groupby } = queryFormData;
  return buildQueryContext(queryFormData, baseQueryObject => {
    /* the `pivotOperatorInRuntime` determines how to pivot the dataframe returned from the raw query.
       1. If it's a time compared query, there will return a pivoted dataframe that append time compared metrics. for instance:

                            MAX(value) MAX(value)__1 year ago MIN(value) MIN(value)__1 year ago
          city               LA                     LA         LA                     LA
          __timestamp
          2015-01-01      568.0                  671.0        5.0                    6.0
          2015-02-01      407.0                  649.0        4.0                    3.0
          2015-03-01      318.0                  465.0        0.0                    3.0

       2. If it's a normal query, there will return a pivoted dataframe.

                     MAX(value)  MIN(value)
          city               LA          LA
          __timestamp
          2015-01-01      568.0         5.0
          2015-02-01      407.0         4.0
          2015-03-01      318.0         0.0

     */
    // only add series limit metric if it's explicitly needed e.g. for sorting
    const extra_metrics = extractExtraMetrics(queryFormData);

    const pivotOperatorInRuntime: PostProcessingPivot = isTimeComparison(
      queryFormData,
      baseQueryObject,
    )
      ? timeComparePivotOperator(queryFormData, baseQueryObject)
      : pivotOperator(queryFormData, baseQueryObject);

    const columns = [
      ...(isXAxisSet(queryFormData)
        ? ensureIsArray(getXAxisColumn(queryFormData))
        : []),
      ...ensureIsArray(groupby),
    ];

    const time_offsets = isTimeComparison(queryFormData, baseQueryObject)
      ? queryFormData.time_compare
      : [];

    return [
      {
        ...baseQueryObject,
        metrics: [...(baseQueryObject.metrics || []), ...extra_metrics],
        columns,
        series_columns: groupby,
        ...(isXAxisSet(queryFormData) ? {} : { is_timeseries: true }),
        // todo: move `normalizeOrderBy to extractQueryFields`
        orderby: normalizeOrderBy(baseQueryObject).orderby,
        time_offsets,
        /* Note that:
          1. The resample, rolling, cum, timeCompare operators should be after pivot.
          2. Resample must come before rolling so that imputed values are
             included in the rolling window calculation.
          3. the flatOperator makes multiIndex Dataframe into flat Dataframe
        */
        post_processing: [
          pivotOperatorInRuntime,
          resampleOperator(queryFormData, baseQueryObject),
          rollingWindowOperator(queryFormData, baseQueryObject),
          timeCompareOperator(queryFormData, baseQueryObject),
          renameOperator(queryFormData, baseQueryObject),
          contributionOperator(queryFormData, baseQueryObject, time_offsets),
          sortOperator(queryFormData, baseQueryObject),
          flattenOperator(queryFormData, baseQueryObject),
          // todo: move prophet before flatten
          prophetOperator(queryFormData, baseQueryObject),
        ],
      },
    ];
  });
}
