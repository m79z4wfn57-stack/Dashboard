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
import type { LabelDocument } from '@superset-ui/core';
import { compileEchartsLabelDocument } from '../../src/Timeseries/labelDocument';

const document: LabelDocument = {
  version: 1,
  paragraphs: [
    {
      id: 'global-line',
      alignment: 'left',
      nodes: [
        {
          type: 'text',
          id: 'global-prefix',
          text: 'Global: ',
          style: { bold: true, fontSize: 16, color: '#0000ff' },
        },
        {
          type: 'field',
          id: 'global',
          fieldType: 'measure',
          label: 'SUM(global_sales)',
          queryField: 'SUM(global_sales)',
          numberFormat: '.1f',
        },
      ],
    },
    {
      id: 'eu-line',
      alignment: 'right',
      nodes: [
        { type: 'text', id: 'eu-prefix', text: 'EU: ' },
        {
          type: 'field',
          id: 'eu',
          fieldType: 'measure',
          label: 'SUM(eu_sales)',
          queryField: 'SUM(eu_sales)',
        },
      ],
    },
  ],
};

test('compiles styled text and distinct field values to ECharts rich text', () => {
  const compiled = compileEchartsLabelDocument(
    document,
    new Map([
      ['global', 100],
      ['eu', 25],
    ]),
  );

  expect(compiled?.text).toContain('Global: ');
  expect(compiled?.text).toContain('100.0');
  expect(compiled?.text).toContain('EU: ');
  expect(compiled?.text).toContain('25');
  expect(compiled?.text).toContain('\n');
  expect(compiled?.rich.p0n0).toEqual(
    expect.objectContaining({
      fontWeight: 'bold',
      fontSize: 16,
      color: '#0000ff',
      align: 'left',
    }),
  );
  expect(compiled?.rich.p1n0).toEqual(expect.objectContaining({ align: 'right' }));
});

test('escapes literal ECharts rich-text delimiters', () => {
  const compiled = compileEchartsLabelDocument(
    {
      version: 1,
      paragraphs: [
        {
          id: 'line',
          alignment: 'left',
          nodes: [{ type: 'text', id: 'text', text: '{unsafe}' }],
        },
      ],
    },
    new Map(),
  );

  expect(compiled?.text).toContain('\\{unsafe\\}');
});

test('uses the shared structured number format for rendered labels', () => {
  const compiled = compileEchartsLabelDocument(
    {
      version: 1,
      paragraphs: [
        {
          id: 'line',
          alignment: 'center',
          nodes: [
            {
              type: 'field',
              id: 'sales',
              fieldType: 'measure',
              label: 'SUM(global_sales)',
              queryField: 'SUM(global_sales)',
              format: {
                style: 'compact',
                decimals: 2,
                thousandsSeparator: true,
                nullText: 'N/A',
              },
            },
          ],
        },
      ],
    },
    new Map([['sales', 1750]]),
  );

  expect(compiled?.text).toContain('1.75K');
});
