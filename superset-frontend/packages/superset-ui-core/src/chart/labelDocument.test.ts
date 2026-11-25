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
  getLabelFieldTokens,
  getUnsupportedLabelDependencies,
  isLabelDocument,
  LabelDocument,
  formatLabelValue,
} from './labelDocument';

const document: LabelDocument = {
  version: 1,
  paragraphs: [
    {
      id: 'line-1',
      alignment: 'left',
      nodes: [
        { type: 'text', id: 'text-1', text: 'Global: ', style: { bold: true } },
        {
          type: 'field',
          id: 'global',
          fieldType: 'measure',
          label: 'SUM(global_sales)',
          queryField: 'SUM(global_sales)',
        },
      ],
    },
    {
      id: 'line-2',
      alignment: 'left',
      nodes: [
        {
          type: 'field',
          id: 'parameter',
          fieldType: 'parameter',
          label: 'Region parameter',
        },
      ],
    },
  ],
};

test('validates and retains stable field identities', () => {
  expect(isLabelDocument(document)).toBe(true);
  expect(getLabelFieldTokens(document).map(token => token.id)).toEqual([
    'global',
    'parameter',
  ]);
});

test('reports unsupported analytical dependencies', () => {
  expect(getUnsupportedLabelDependencies(document)).toEqual([
    expect.objectContaining({ id: 'parameter', fieldType: 'parameter' }),
  ]);
});

test('rejects unbounded or unsafe style data', () => {
  expect(
    isLabelDocument({
      ...document,
      paragraphs: [
        {
          id: 'unsafe',
          alignment: 'left',
          nodes: [
            {
              type: 'text',
              id: 'text',
              text: 'label',
              style: { color: 'javascript:alert(1)' },
            },
          ],
        },
      ],
    }),
  ).toBe(false);
});

test('formats compact, currency, percent, grouped, and null values', () => {
  expect(
    formatLabelValue(1750, {
      style: 'compact',
      decimals: 2,
      thousandsSeparator: true,
      nullText: '—',
    }),
  ).toBe('1.75K');
  expect(
    formatLabelValue(1750, {
      style: 'currency',
      decimals: 0,
      currency: 'USD',
      thousandsSeparator: true,
      nullText: '—',
    }),
  ).toBe('$1,750');
  expect(
    formatLabelValue(0.125, {
      style: 'percent',
      decimals: 1,
      thousandsSeparator: true,
      nullText: '—',
    }),
  ).toBe('12.5%');
  expect(
    formatLabelValue(null, {
      style: 'standard',
      decimals: 2,
      thousandsSeparator: true,
      nullText: '—',
    }),
  ).toBe('—');
});
