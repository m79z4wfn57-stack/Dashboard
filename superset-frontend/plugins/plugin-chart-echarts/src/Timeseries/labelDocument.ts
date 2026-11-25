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
  compileLabelDocument,
  getNumberFormatter,
  getLabelFieldTokens,
  isLabelDocument,
} from '@superset-ui/core';
import type { LabelDocument, LabelTextStyle } from '@superset-ui/core';

type EchartsRichStyle = {
  align: 'left' | 'center' | 'right';
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: 'bold';
  fontStyle?: 'italic';
  color?: string;
};

export type CompiledEchartsLabel = {
  text: string;
  rich: Record<string, EchartsRichStyle>;
};

const escapeRichText = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('{', '\\{').replaceAll('}', '\\}');

const toRichStyle = (
  style: LabelTextStyle | undefined,
  alignment: 'left' | 'center' | 'right',
) => ({
  align: alignment,
  ...(style?.fontFamily && { fontFamily: style.fontFamily }),
  ...(style?.fontSize && {
    fontSize: style.fontSize,
    lineHeight: Math.ceil(style.fontSize * 1.25),
  }),
  ...(style?.bold && { fontWeight: 'bold' as const }),
  ...(style?.italic && { fontStyle: 'italic' as const }),
  ...(style?.color && { color: style.color }),
});

export function compileEchartsLabelDocument(
  value: unknown,
  fieldValues: ReadonlyMap<string, string | number | null | undefined>,
): CompiledEchartsLabel | undefined {
  if (!isLabelDocument(value)) return undefined;
  const document: LabelDocument = value;
  const resolvedValues = new Map(fieldValues);
  getLabelFieldTokens(document).forEach(token => {
    const rawValue = fieldValues.get(token.id);
    if (
      typeof rawValue === 'number' &&
      token.numberFormat &&
      token.format === undefined
    ) {
      resolvedValues.set(token.id, getNumberFormatter(token.numberFormat)(rawValue));
    }
  });
  const compiledParagraphs = compileLabelDocument(document, resolvedValues);
  const rich: CompiledEchartsLabel['rich'] = {};
  const paragraphs = compiledParagraphs.map(
    (paragraph, paragraphIndex) =>
      paragraph.spans
      .map((span, nodeIndex) => {
        const styleName = `p${paragraphIndex}n${nodeIndex}`;
        rich[styleName] = toRichStyle(span.style, paragraph.alignment);
        return `{${styleName}|${escapeRichText(span.text)}}`;
      })
      .join(''),
  );
  return { text: paragraphs.join('\n'), rich };
}
