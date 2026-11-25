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

import type { QueryFormColumn, QueryFormMetric } from '../query';

export const LABEL_DOCUMENT_VERSION = 1 as const;
export const MAX_LABEL_PARAGRAPHS = 50;
export const MAX_LABEL_NODES = 200;
export const MAX_LABEL_TEXT_LENGTH = 5000;

export type LabelTextStyle = {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
};

export type LabelNumberFormat = {
  style: 'standard' | 'compact' | 'currency' | 'percent';
  decimals: number;
  currency?: string;
  thousandsSeparator: boolean;
  nullText: string;
};

export type LabelFieldToken = {
  type: 'field';
  id: string;
  fieldType: 'dimension' | 'measure' | 'calculated' | 'parameter';
  label: string;
  queryField?: QueryFormColumn | QueryFormMetric;
  numberFormat?: string;
  format?: LabelNumberFormat;
  parameterId?: string;
  style?: LabelTextStyle;
};

export type LabelParameterDefinition = {
  id: string;
  label: string;
  valueType: 'string' | 'number' | 'boolean' | 'date';
};

export type LabelParameterContract = {
  definitions: LabelParameterDefinition[];
  values: Readonly<Record<string, string | number | boolean | null>>;
};

export type LabelMarkSelection = {
  selectedValues: readonly string[];
  highlightedValues: readonly string[];
};

export type LabelDocumentNode =
  | { type: 'text'; id: string; text: string; style?: LabelTextStyle }
  | LabelFieldToken;

export type LabelParagraph = {
  id: string;
  alignment: 'left' | 'center' | 'right';
  nodes: LabelDocumentNode[];
};

export type LabelDocument = {
  version: typeof LABEL_DOCUMENT_VERSION;
  paragraphs: LabelParagraph[];
};

export type LabelDisplaySettings = {
  visible: boolean;
  marksToLabel: 'all' | 'selected' | 'highlighted';
  allowOverlap: boolean;
  position: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'inside';
  alignment: 'left' | 'center' | 'right';
};

export const DEFAULT_LABEL_DISPLAY_SETTINGS: LabelDisplaySettings = {
  visible: true,
  marksToLabel: 'all',
  allowOverlap: false,
  position: 'auto',
  alignment: 'center',
};

export const DEFAULT_LABEL_NUMBER_FORMAT: LabelNumberFormat = {
  style: 'standard',
  decimals: 2,
  thousandsSeparator: true,
  nullText: 'N/A',
};

export type CompiledLabelSpan = {
  id: string;
  text: string;
  style?: LabelTextStyle;
};

export type CompiledLabelParagraph = {
  id: string;
  alignment: LabelParagraph['alignment'];
  spans: CompiledLabelSpan[];
};

const isStyle = (value: unknown): value is LabelTextStyle => {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const style = value as LabelTextStyle;
  return (
    (style.fontFamily === undefined || typeof style.fontFamily === 'string') &&
    (style.fontSize === undefined ||
      (typeof style.fontSize === 'number' &&
        style.fontSize >= 6 &&
        style.fontSize <= 96)) &&
    (style.bold === undefined || typeof style.bold === 'boolean') &&
    (style.italic === undefined || typeof style.italic === 'boolean') &&
    (style.underline === undefined || typeof style.underline === 'boolean') &&
    (style.color === undefined ||
      (typeof style.color === 'string' &&
        /^#[0-9a-f]{6}$/i.test(style.color)))
  );
};

const isNumberFormat = (value: unknown): value is LabelNumberFormat => {
  if (!value || typeof value !== 'object') return false;
  const format = value as Partial<LabelNumberFormat>;
  return (
    ['standard', 'compact', 'currency', 'percent'].includes(
      format.style ?? '',
    ) &&
    typeof format.decimals === 'number' &&
    Number.isInteger(format.decimals) &&
    format.decimals >= 0 &&
    format.decimals <= 6 &&
    (format.currency === undefined ||
      /^[A-Z]{3}$/.test(format.currency)) &&
    typeof format.thousandsSeparator === 'boolean' &&
    typeof format.nullText === 'string' &&
    format.nullText.length <= 100
  );
};

export function isLabelDocument(value: unknown): value is LabelDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<LabelDocument>;
  if (
    document.version !== LABEL_DOCUMENT_VERSION ||
    !Array.isArray(document.paragraphs) ||
    document.paragraphs.length > MAX_LABEL_PARAGRAPHS
  ) {
    return false;
  }
  let nodeCount = 0;
  let textLength = 0;
  return document.paragraphs.every(paragraph => {
    if (
      !paragraph ||
      typeof paragraph.id !== 'string' ||
      !['left', 'center', 'right'].includes(paragraph.alignment) ||
      !Array.isArray(paragraph.nodes)
    ) {
      return false;
    }
    nodeCount += paragraph.nodes.length;
    return paragraph.nodes.every(node => {
      if (!node || typeof node.id !== 'string' || !isStyle(node.style)) {
        return false;
      }
      if (node.type === 'text') {
        if (typeof node.text !== 'string') return false;
        textLength += node.text.length;
        return (
          nodeCount <= MAX_LABEL_NODES && textLength <= MAX_LABEL_TEXT_LENGTH
        );
      }
      return (
        node.type === 'field' &&
        typeof node.label === 'string' &&
        ['dimension', 'measure', 'calculated', 'parameter'].includes(
          node.fieldType,
        ) &&
        (node.numberFormat === undefined ||
          typeof node.numberFormat === 'string') &&
        (node.format === undefined || isNumberFormat(node.format)) &&
        (node.parameterId === undefined ||
          typeof node.parameterId === 'string') &&
        nodeCount <= MAX_LABEL_NODES
      );
    });
  });
}
export const getLabelFieldTokens = (
  document: LabelDocument,
): LabelFieldToken[] => {
  const seen = new Set<string>();
  return document.paragraphs.flatMap(paragraph =>
    paragraph.nodes.filter((node): node is LabelFieldToken => {
      if (node.type !== 'field' || seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    }),
  );
};

export const getUnsupportedLabelDependencies = (
  document: LabelDocument,
): LabelFieldToken[] =>
  getLabelFieldTokens(document).filter(token => token.queryField === undefined);

export function formatLabelValue(
  value: string | number | null | undefined,
  format: LabelNumberFormat = DEFAULT_LABEL_NUMBER_FORMAT,
): string {
  if (value === null || value === undefined || value === '') {
    return format.nullText;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return String(value);
  }
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: format.decimals,
    maximumFractionDigits: format.decimals,
    useGrouping: format.thousandsSeparator,
  };
  if (format.style === 'compact') {
    options.notation = 'compact';
    options.compactDisplay = 'short';
  } else if (format.style === 'currency') {
    options.style = 'currency';
    options.currency = format.currency ?? 'USD';
  } else if (format.style === 'percent') {
    options.style = 'percent';
  }
  return new Intl.NumberFormat('en-US', options).format(value);
}

export function compileLabelDocument(
  document: LabelDocument,
  fieldValues: ReadonlyMap<string, string | number | null | undefined>,
): CompiledLabelParagraph[] {
  return document.paragraphs.map(paragraph => ({
    id: paragraph.id,
    alignment: paragraph.alignment,
    spans: paragraph.nodes.map(node => ({
      id: node.id,
      text:
        node.type === 'text'
          ? node.text
          : node.format
            ? formatLabelValue(fieldValues.get(node.id), node.format)
            : String(fieldValues.get(node.id) ?? ''),
      style: node.style,
    })),
  }));
}
