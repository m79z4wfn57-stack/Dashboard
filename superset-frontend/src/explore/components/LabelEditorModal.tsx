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
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import type {
  LabelDocument,
  LabelFieldToken,
  LabelNumberFormat,
  LabelParameterContract,
  LabelTextStyle,
} from '@superset-ui/core';
import {
  compileLabelDocument,
  DEFAULT_LABEL_NUMBER_FORMAT,
  isLabelDocument,
} from '@superset-ui/core';
import {
  Button,
  Checkbox,
  Flex,
  Input,
  Modal,
  Select,
} from '@superset-ui/core/components';

type EditorSelection = {
  startNodeId: string;
  startOffset: number;
  endNodeId: string;
  endOffset: number;
};
type PreviewValue = string | number | null | undefined;

const EMPTY_PREVIEW_VALUES: ReadonlyMap<string, PreviewValue> = new Map();

const parseAlignment = (value: unknown) =>
  value === 'center' || value === 'right' ? value : 'left';

export type LabelEditorModalProps = {
  show: boolean;
  document: LabelDocument;
  availableFields: LabelFieldToken[];
  previewValues?: ReadonlyMap<string, PreviewValue>;
  previewFieldValues?: ReadonlyMap<string, PreviewValue>;
  parameterContract?: LabelParameterContract;
  onApply: (document: LabelDocument) => void;
  onHide: () => void;
};

const cloneDocument = (document: LabelDocument): LabelDocument =>
  structuredClone(document);

const CARET_ANCHOR = '\u200b';

const ensureCaretTextNodes = (document: LabelDocument): LabelDocument => ({
  ...document,
  paragraphs: document.paragraphs.map(paragraph => {
    const nodes = paragraph.nodes.flatMap((node, index) => [
      ...(index === 0 && node.type === 'field'
        ? [
            {
              type: 'text' as const,
              id: `${paragraph.id}:caret:0`,
              text: '',
            },
          ]
        : []),
      node,
      ...(node.type === 'field' &&
      (paragraph.nodes[index + 1] === undefined ||
        paragraph.nodes[index + 1]?.type === 'field')
        ? [
            {
              type: 'text' as const,
              id: `${paragraph.id}:caret:${index + 1}`,
              text: '',
            },
          ]
        : []),
    ]);
    return {
      ...paragraph,
      nodes:
        nodes.length > 0
          ? nodes
          : [
              {
                type: 'text' as const,
                id: `${paragraph.id}:caret:empty`,
                text: '',
              },
            ],
    };
  }),
});

const readCanvasDocument = (
  element: HTMLElement,
  current: LabelDocument,
): LabelDocument => {
  const existingNodes = new Map(
    current.paragraphs
      .flatMap(paragraph => paragraph.nodes)
      .map(node => [node.id, node]),
  );
  const seenIds = new Set<string>();
  const readNodes = (container: Node): LabelDocument['paragraphs'][number]['nodes'] =>
    Array.from(container.childNodes).flatMap(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? '';
        return text
          ? [{ type: 'text' as const, id: crypto.randomUUID(), text }]
          : [];
      }
      if (!(child instanceof HTMLElement)) return [];
      if (child.tagName === 'BR') {
        return [{ type: 'text' as const, id: crypto.randomUUID(), text: '\n' }];
      }
      const nodeId = child.dataset.labelNodeId;
      const existing = nodeId ? existingNodes.get(nodeId) : undefined;
      if (existing?.type === 'field' && child.dataset.labelToken === 'true') {
        const id = seenIds.has(existing.id) ? crypto.randomUUID() : existing.id;
        seenIds.add(id);
        return [{ ...existing, id }];
      }
      if (existing?.type === 'text') {
        const id = seenIds.has(existing.id) ? crypto.randomUUID() : existing.id;
        seenIds.add(id);
        return [
          {
            ...existing,
            id,
            text: (child.textContent ?? '').replaceAll(CARET_ANCHOR, ''),
          },
        ];
      }
      const nestedNodes = readNodes(child);
      return child.tagName === 'DIV' || child.tagName === 'P'
        ? [
            { type: 'text' as const, id: crypto.randomUUID(), text: '\n' },
            ...nestedNodes,
          ]
        : nestedNodes;
    });

  const blockElements = Array.from(element.children);
  if (blockElements.length === 0) {
    return {
      version: 1,
      paragraphs: [
        { id: crypto.randomUUID(), alignment: 'left', nodes: readNodes(element) },
      ],
    };
  }
  const seenParagraphIds = new Set<string>();
  return {
    version: 1,
    paragraphs: blockElements.map(block => {
      const prior = current.paragraphs.find(
        paragraph => paragraph.id === block.getAttribute('data-label-paragraph-id'),
      );
      const id =
        prior && !seenParagraphIds.has(prior.id)
          ? prior.id
          : crypto.randomUUID();
      seenParagraphIds.add(id);
      return {
        id,
        alignment: prior?.alignment ?? 'left',
        nodes: readNodes(block),
      };
    }),
  };
};

const applyNodeStyle = (element: HTMLElement, style?: LabelTextStyle) => {
  element.style.color = style?.color ?? '';
  element.style.fontFamily = style?.fontFamily ?? '';
  element.style.fontSize = style?.fontSize ? `${style.fontSize}px` : '';
  element.style.fontWeight = style?.bold ? 'bold' : '';
  element.style.fontStyle = style?.italic ? 'italic' : '';
  element.style.textDecoration = style?.underline ? 'underline' : '';
};

const renderCanvasDocument = (
  element: HTMLElement,
  document: LabelDocument,
) => {
  element.replaceChildren();
  document.paragraphs.forEach(paragraph => {
    const paragraphElement = window.document.createElement('div');
    paragraphElement.dataset.labelParagraphId = paragraph.id;
    paragraphElement.style.minHeight = '1.5em';
    paragraphElement.style.textAlign = paragraph.alignment;
    paragraph.nodes.forEach(node => {
      const nodeElement = window.document.createElement('span');
      nodeElement.dataset.labelNodeId = node.id;
      applyNodeStyle(nodeElement, node.style);
      if (node.type === 'text') {
        nodeElement.textContent = node.text || CARET_ANCHOR;
        if (!node.text) {
          nodeElement.style.display = 'inline-block';
          nodeElement.style.minWidth = '0.5em';
        }
      } else {
        nodeElement.dataset.labelToken = 'true';
        nodeElement.contentEditable = 'false';
        nodeElement.draggable = true;
        nodeElement.tabIndex = 0;
        nodeElement.setAttribute('role', 'button');
        nodeElement.style.border = '1px solid currentColor';
        nodeElement.style.borderRadius = '3px';
        nodeElement.style.cursor = 'grab';
        nodeElement.style.display = 'inline-block';
        nodeElement.style.margin = '0 2px';
        nodeElement.style.padding = '0 3px';
        nodeElement.textContent = `<${node.label}>`;
      }
      paragraphElement.append(nodeElement);
    });
    element.append(paragraphElement);
  });
};

export function LabelEditorModal({
  show,
  document,
  availableFields,
  previewValues = EMPTY_PREVIEW_VALUES,
  previewFieldValues = EMPTY_PREVIEW_VALUES,
  parameterContract,
  onApply,
  onHide,
}: LabelEditorModalProps) {
  const [draft, setDraft] = useState(() =>
    ensureCaretTextNodes(cloneDocument(document)),
  );
  const [baseline, setBaseline] = useState(() =>
    ensureCaretTextNodes(cloneDocument(document)),
  );
  const [validationError, setValidationError] = useState<string>();
  const [cursor, setCursor] = useState<EditorSelection>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [restoreSelection, setRestoreSelection] = useState(false);
  const [canvasRevision, setCanvasRevision] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const clipboardToken = useRef<LabelFieldToken>();
  const wasOpen = useRef(false);
  const draftRef = useRef(draft);
  const cursorRef = useRef(cursor);
  const restoreSelectionRef = useRef(restoreSelection);
  draftRef.current = draft;
  cursorRef.current = cursor;
  restoreSelectionRef.current = restoreSelection;

  const setDraftAndRender = (
    update: LabelDocument | ((current: LabelDocument) => LabelDocument),
  ) => {
    setDraft(current =>
      typeof update === 'function' ? update(current) : update,
    );
    setCanvasRevision(current => current + 1);
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !show) return;
    renderCanvasDocument(canvas, draftRef.current);
    const pendingCursor = cursorRef.current;
    if (!restoreSelectionRef.current || !pendingCursor) return;
    const elements = Array.from(
      canvas.querySelectorAll<HTMLElement>('[data-label-node-id]'),
    );
    const startElement = elements.find(
      element => element.dataset.labelNodeId === pendingCursor.startNodeId,
    );
    const endElement = elements.find(
      element => element.dataset.labelNodeId === pendingCursor.endNodeId,
    );
    if (!startElement || !endElement) return;
    const range = window.document.createRange();
    const startNode = startElement.firstChild ?? startElement;
    const endNode = endElement.firstChild ?? endElement;
    range.setStart(
      startNode,
      Math.min(pendingCursor.startOffset, startNode.textContent?.length ?? 0),
    );
    range.setEnd(
      endNode,
      Math.min(pendingCursor.endOffset, endNode.textContent?.length ?? 0),
    );
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    startElement.focus();
    setRestoreSelection(false);
  }, [canvasRevision, show]);

  useEffect(() => {
    if (show && !wasOpen.current) {
      const openedDocument = ensureCaretTextNodes(cloneDocument(document));
      setBaseline(openedDocument);
      setDraft(cloneDocument(openedDocument));
      setCanvasRevision(current => current + 1);
      setValidationError(undefined);
    }
    wasOpen.current = show;
  }, [document, show]);

  const commitDraft = () => {
    if (!isLabelDocument(draft)) {
      setValidationError(t('The label document is invalid or exceeds its limits.'));
      return false;
    }
    const committed = cloneDocument(draft);
    onApply(committed);
    setBaseline(cloneDocument(committed));
    setValidationError(undefined);
    return true;
  };

  const cancel = () => {
    setDraft(cloneDocument(baseline));
    setValidationError(undefined);
    onHide();
  };

  const selectedNode = useMemo(
    () =>
      draft.paragraphs
        .flatMap(paragraph => paragraph.nodes)
        .find(node => node.id === selectedNodeId),
    [draft, selectedNodeId],
  );
  const compiledPreview = useMemo(() => {
    const values = new Map(previewValues);
    draft.paragraphs.forEach(paragraph =>
      paragraph.nodes.forEach(node => {
        if (node.type !== 'field') return;
        if (node.parameterId) {
          const value = parameterContract?.values[node.parameterId];
          values.set(
            node.id,
            typeof value === 'boolean' ? String(value) : value,
          );
        } else {
          values.set(node.id, previewFieldValues.get(node.label));
        }
      }),
    );
    return compileLabelDocument(draft, values);
  }, [draft, parameterContract, previewFieldValues, previewValues]);
  const unresolvedFields = useMemo(
    () =>
      draft.paragraphs.flatMap(paragraph =>
        paragraph.nodes.flatMap(node => {
          if (node.type !== 'field') return [];
          const resolved = node.parameterId
            ? Object.prototype.hasOwnProperty.call(
                parameterContract?.values ?? {},
                node.parameterId,
              )
            : previewValues.has(node.id) || previewFieldValues.has(node.label);
          return resolved ? [] : [node.label];
        }),
      ),
    [draft, parameterContract, previewFieldValues, previewValues],
  );

  const updateSelectedFieldFormat = (change: Partial<LabelNumberFormat>) => {
    if (selectedNode?.type !== 'field') return;
    setDraftAndRender(current => ({
      ...current,
      paragraphs: current.paragraphs.map(paragraph => ({
        ...paragraph,
        nodes: paragraph.nodes.map(node =>
          node.id === selectedNode.id && node.type === 'field'
            ? {
                ...node,
                format: {
                  ...DEFAULT_LABEL_NUMBER_FORMAT,
                  ...node.format,
                  ...change,
                },
              }
            : node,
        ),
      })),
    }));
  };

  const updateSelectedStyle = (change: Partial<LabelTextStyle>) => {
    if (!selectedNodeId) return;
    const orderedNodes = draft.paragraphs.flatMap(paragraph => paragraph.nodes);
    const startIndex = cursor
      ? orderedNodes.findIndex(node => node.id === cursor.startNodeId)
      : -1;
    const endIndex = cursor
      ? orderedNodes.findIndex(node => node.id === cursor.endNodeId)
      : -1;
    setDraftAndRender(current => ({
      ...current,
      paragraphs: current.paragraphs.map(paragraph => ({
        ...paragraph,
        nodes: paragraph.nodes.flatMap(node => {
          const nodeIndex = orderedNodes.findIndex(item => item.id === node.id);
          const selectedByRange =
            startIndex >= 0 && nodeIndex >= startIndex && nodeIndex <= endIndex;
          if (node.id !== selectedNodeId && !selectedByRange) return [node];
          if (
            node.type !== 'text' ||
            !cursor ||
            (cursor.startNodeId === cursor.endNodeId &&
              cursor.startOffset === cursor.endOffset)
          ) {
            return [{ ...node, style: { ...node.style, ...change } }];
          }
          const selectionStart =
            node.id === cursor.startNodeId ? cursor.startOffset : 0;
          const selectionEnd =
            node.id === cursor.endNodeId ? cursor.endOffset : node.text.length;
          const before = node.text.slice(0, selectionStart);
          const selected = node.text.slice(selectionStart, selectionEnd);
          const after = node.text.slice(selectionEnd);
          return [
            ...(before
              ? [{ ...node, id: crypto.randomUUID(), text: before }]
              : []),
            {
              ...node,
              text: selected,
              style: { ...node.style, ...change },
            },
            ...(after
              ? [{ ...node, id: crypto.randomUUID(), text: after }]
              : []),
          ];
        }),
      })),
    }));
    if (
      selectedNode?.type === 'text' &&
      cursor?.startNodeId === selectedNode.id &&
      (cursor.startNodeId !== cursor.endNodeId ||
        cursor.startOffset !== cursor.endOffset)
    ) {
      const endNode = orderedNodes.find(node => node.id === cursor.endNodeId);
      setCursor({
        ...cursor,
        startOffset: 0,
        endOffset:
          endNode?.type === 'text'
            ? cursor.endOffset -
              (cursor.startNodeId === cursor.endNodeId
                ? cursor.startOffset
                : 0)
            : 0,
      });
      setRestoreSelection(true);
    }
  };

  const captureCanvasSelection = () => {
    const selection = window.getSelection();
    if (!selection?.anchorNode || !selection.focusNode) return;
    const getNodeElement = (node: Node) =>
      (node instanceof HTMLElement ? node : node.parentElement)?.closest<HTMLElement>(
        '[data-label-node-id]',
      );
    const anchorElement = getNodeElement(selection.anchorNode);
    const focusElement = getNodeElement(selection.focusNode);
    const anchorId = anchorElement?.dataset.labelNodeId;
    const focusId = focusElement?.dataset.labelNodeId;
    if (!anchorId || !focusId) return;
    const orderedIds = draft.paragraphs.flatMap(paragraph =>
      paragraph.nodes.map(node => node.id),
    );
    const anchorIndex = orderedIds.indexOf(anchorId);
    const focusIndex = orderedIds.indexOf(focusId);
    const forward =
      anchorIndex < focusIndex ||
      (anchorIndex === focusIndex &&
        selection.anchorOffset <= selection.focusOffset);
    const nodeLength = (nodeId: string) => {
      const node = draft.paragraphs
        .flatMap(paragraph => paragraph.nodes)
        .find(candidate => candidate.id === nodeId);
      return node?.type === 'text' ? node.text.length : 0;
    };
    setCursor({
      startNodeId: forward ? anchorId : focusId,
      startOffset: Math.min(
        forward ? selection.anchorOffset : selection.focusOffset,
        nodeLength(forward ? anchorId : focusId),
      ),
      endNodeId: forward ? focusId : anchorId,
      endOffset: Math.min(
        forward ? selection.focusOffset : selection.anchorOffset,
        nodeLength(forward ? focusId : anchorId),
      ),
    });
    setSelectedNodeId(forward ? anchorId : focusId);
  };

  const removeSelectedNode = () => {
    if (!selectedNodeId) return;
    setDraftAndRender(current => ({
      ...current,
      paragraphs: current.paragraphs.map(paragraph => ({
        ...paragraph,
        nodes: paragraph.nodes.filter(node => node.id !== selectedNodeId),
      })),
    }));
    setSelectedNodeId(undefined);
  };

  const updateSelectedAlignment = (value: unknown) => {
    if (!selectedNodeId) return;
    setDraftAndRender(current => ({
      ...current,
      paragraphs: current.paragraphs.map(paragraph =>
        paragraph.nodes.some(node => node.id === selectedNodeId)
          ? { ...paragraph, alignment: parseAlignment(value) }
          : paragraph,
      ),
    }));
  };

  const syncCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDraft(current => readCanvasDocument(canvas, current));
  };

  const insertTokenAtCursor = (source: LabelFieldToken) => {
    const inserted = { ...source, id: `${source.id}:${crypto.randomUUID()}` };
    const trailingId = crypto.randomUUID();
    setDraftAndRender(current => {
      let insertedAtCursor = false;
      const paragraphs = current.paragraphs.map(paragraph => ({
        ...paragraph,
        nodes: paragraph.nodes.flatMap(node => {
          if (node.type !== 'text' || node.id !== cursor?.startNodeId) {
            return [node];
          }
          insertedAtCursor = true;
          const offset = Math.min(cursor.startOffset, node.text.length);
          return [
            { ...node, text: node.text.slice(0, offset) },
            inserted,
            { ...node, id: trailingId, text: node.text.slice(offset) },
          ];
        }),
      }));
      if (!insertedAtCursor) {
        const lastIndex = Math.max(0, paragraphs.length - 1);
        const fallbackParagraph = paragraphs[lastIndex] ?? {
          id: crypto.randomUUID(),
          alignment: 'left' as const,
          nodes: [],
        };
        paragraphs[lastIndex] = {
          ...fallbackParagraph,
          nodes: [
            ...fallbackParagraph.nodes,
            inserted,
            { type: 'text', id: trailingId, text: '' },
          ],
        };
      }
      return { ...current, paragraphs };
    });
    setSelectedNodeId(inserted.id);
    setCursor({
      startNodeId: trailingId,
      startOffset: 0,
      endNodeId: trailingId,
      endOffset: 0,
    });
    setRestoreSelection(true);
  };

  const insertField = (tokenId: string) => {
    const parameterId = tokenId.startsWith('parameter:')
      ? tokenId.slice('parameter:'.length)
      : undefined;
    const parameter = parameterContract?.definitions.find(
      definition => definition.id === parameterId,
    );
    const source =
      availableFields.find(field => field.id === tokenId) ??
      (parameter
        ? {
            type: 'field' as const,
            id: tokenId,
            fieldType: 'parameter' as const,
            label: parameter.label,
            parameterId: parameter.id,
          }
        : undefined);
    if (source) insertTokenAtCursor(source);
  };

  const moveTokenBefore = (tokenId: string, targetId?: string) => {
    setDraftAndRender(current => {
      const token = current.paragraphs
        .flatMap(paragraph => paragraph.nodes)
        .find(
          (node): node is LabelFieldToken =>
            node.type === 'field' && node.id === tokenId,
        );
      if (!token) return current;
      const withoutToken = current.paragraphs.map(paragraph => ({
        ...paragraph,
        nodes: paragraph.nodes.filter(node => node.id !== tokenId),
      }));
      const targetParagraphIndex = targetId
        ? withoutToken.findIndex(paragraph =>
            paragraph.nodes.some(node => node.id === targetId),
          )
        : withoutToken.length - 1;
      if (targetParagraphIndex < 0) return current;
      return {
        ...current,
        paragraphs: withoutToken.map((paragraph, paragraphIndex) => {
          if (paragraphIndex !== targetParagraphIndex) return paragraph;
          const targetIndex = targetId
            ? paragraph.nodes.findIndex(node => node.id === targetId)
            : paragraph.nodes.length;
          const nodes = [...paragraph.nodes];
          nodes.splice(targetIndex < 0 ? nodes.length : targetIndex, 0, token);
          return { ...paragraph, nodes };
        }),
      };
    });
  };

  const footer = (
    <Flex gap="small" justify="flex-end">
      <Button onClick={cancel}>{t('Cancel')}</Button>
      <Button onClick={() => setDraftAndRender(cloneDocument(baseline))}>
        {t('Reset')}
      </Button>
      <Button
        onClick={() =>
          setDraftAndRender(current => ({
            ...current,
            paragraphs: current.paragraphs.map(paragraph => ({
              ...paragraph,
              nodes: paragraph.nodes.map(node => ({ ...node, style: {} })),
            })),
          }))
        }
      >
        {t('Clear formatting')}
      </Button>
      <Button onClick={commitDraft}>
        {t('Apply')}
      </Button>
      <Button
        buttonStyle="primary"
        onClick={() => {
          if (commitDraft()) onHide();
        }}
      >
        {t('OK')}
      </Button>
    </Flex>
  );

  return (
    <Modal
      show={show}
      onHide={cancel}
      name={t('Edit Label')}
      title={t('Edit Label')}
      footer={footer}
      width="760px"
      destroyOnHidden
    >
      <Flex vertical gap="small">
        {validationError && <div role="alert">{validationError}</div>}
        <Flex gap="small" wrap="wrap">
          <Select
            ariaLabel={t('Font family')}
            value={selectedNode?.style?.fontFamily ?? 'Arial'}
            options={['Arial', 'Helvetica', 'Georgia', 'Courier New'].map(
              value => ({ value, label: value }),
            )}
            onChange={value =>
              updateSelectedStyle({ fontFamily: String(value) })
            }
          />
          <Select
            ariaLabel={t('Font size')}
            value={selectedNode?.style?.fontSize ?? 12}
            options={[8, 9, 10, 11, 12, 14, 16, 18, 24].map(value => ({
              value,
              label: String(value),
            }))}
            onChange={value => updateSelectedStyle({ fontSize: Number(value) })}
          />
          <Button
            aria-label={t('Bold')}
            onClick={() => updateSelectedStyle({ bold: !selectedNode?.style?.bold })}
          >
            B
          </Button>
          <Button
            aria-label={t('Italic')}
            onClick={() =>
              updateSelectedStyle({ italic: !selectedNode?.style?.italic })
            }
          >
            I
          </Button>
          <Button
            aria-label={t('Underline')}
            onClick={() =>
              updateSelectedStyle({ underline: !selectedNode?.style?.underline })
            }
          >
            U
          </Button>
          <Input
            aria-label={t('Text color')}
            type="color"
            value={selectedNode?.style?.color ?? '#000000'}
            onChange={event => updateSelectedStyle({ color: event.target.value })}
          />
          <Select
            ariaLabel={t('Insert Field')}
            placeholder={t('Insert Field')}
            options={[
              ...availableFields.map(field => ({
                value: field.id,
                label: field.label,
              })),
              ...(parameterContract?.definitions.map(parameter => ({
                value: `parameter:${parameter.id}`,
                label: parameter.label,
              })) ?? []),
            ]}
            onChange={value => insertField(String(value))}
          />
          {selectedNode?.type === 'field' && (
            <>
              <Select
                ariaLabel={t('Field number format')}
                value={
                  selectedNode.format?.style ??
                  DEFAULT_LABEL_NUMBER_FORMAT.style
                }
                options={['standard', 'compact', 'currency', 'percent'].map(
                  value => ({ value, label: value }),
                )}
                onChange={value =>
                  updateSelectedFieldFormat({
                    style:
                      value === 'compact' ||
                      value === 'currency' ||
                      value === 'percent'
                        ? value
                        : 'standard',
                  })
                }
              />
              <Select
                ariaLabel={t('Decimal places')}
                value={
                  selectedNode.format?.decimals ??
                  DEFAULT_LABEL_NUMBER_FORMAT.decimals
                }
                options={[0, 1, 2, 3, 4, 5, 6].map(value => ({
                  value,
                  label: String(value),
                }))}
                onChange={value =>
                  updateSelectedFieldFormat({ decimals: Number(value) })
                }
              />
              {selectedNode.format?.style === 'currency' && (
                <Input
                  aria-label={t('Currency code')}
                  value={selectedNode.format.currency ?? 'USD'}
                  maxLength={3}
                  onChange={event =>
                    updateSelectedFieldFormat({
                      currency: event.target.value.toUpperCase(),
                    })
                  }
                />
              )}
              <Checkbox
                checked={
                  selectedNode.format?.thousandsSeparator ??
                  DEFAULT_LABEL_NUMBER_FORMAT.thousandsSeparator
                }
                onChange={event =>
                  updateSelectedFieldFormat({
                    thousandsSeparator: event.target.checked,
                  })
                }
              >
                {t('Thousands separator')}
              </Checkbox>
              <Input
                aria-label={t('Null value text')}
                value={
                  selectedNode.format?.nullText ??
                  DEFAULT_LABEL_NUMBER_FORMAT.nullText
                }
                onChange={event =>
                  updateSelectedFieldFormat({ nullText: event.target.value })
                }
              />
            </>
          )}
          <Select
            ariaLabel={t('Paragraph alignment')}
            value={
              draft.paragraphs.find(paragraph =>
                paragraph.nodes.some(node => node.id === selectedNodeId),
              )?.alignment ?? 'left'
            }
            options={['left', 'center', 'right'].map(value => ({
              value,
              label: value,
            }))}
            onChange={updateSelectedAlignment}
          />
          <Button onClick={removeSelectedNode}>{t('Delete')}</Button>
        </Flex>
        <div
          ref={canvasRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={t('Label document')}
          onInput={syncCanvas}
          onClick={event => {
            if (!(event.target instanceof HTMLElement)) return;
            const token = event.target.closest<HTMLElement>(
              '[data-label-token="true"]',
            );
            if (token?.dataset.labelNodeId) {
              setSelectedNodeId(token.dataset.labelNodeId);
            }
          }}
          onMouseUp={captureCanvasSelection}
          onKeyUp={captureCanvasSelection}
          onKeyDown={event => {
            if (
              (event.key === 'Backspace' || event.key === 'Delete') &&
              selectedNode?.type === 'field'
            ) {
              event.preventDefault();
              removeSelectedNode();
            }
          }}
          onCopy={event => {
            if (selectedNode?.type !== 'field') return;
            clipboardToken.current = { ...selectedNode };
            event.clipboardData.setData('text/plain', `<${selectedNode.label}>`);
            event.preventDefault();
          }}
          onCut={event => {
            if (selectedNode?.type !== 'field') return;
            clipboardToken.current = { ...selectedNode };
            event.clipboardData.setData('text/plain', `<${selectedNode.label}>`);
            event.preventDefault();
            removeSelectedNode();
          }}
          onDragOver={event => event.preventDefault()}
          onDragStart={event => {
            if (!(event.target instanceof HTMLElement)) return;
            const token = event.target.closest<HTMLElement>(
              '[data-label-token="true"]',
            );
            const tokenId = token?.dataset.labelNodeId;
            if (!tokenId) return;
            event.dataTransfer.setData(
              'application/x-nunomics-label-token',
              tokenId,
            );
            event.dataTransfer.effectAllowed = 'move';
          }}
          onDrop={event => {
            event.preventDefault();
            const tokenId = event.dataTransfer.getData(
              'application/x-nunomics-label-token',
            );
            if (!tokenId) return;
            const target =
              event.target instanceof HTMLElement
                ? event.target.closest<HTMLElement>('[data-label-node-id]')
                : null;
            moveTokenBefore(tokenId, target?.dataset.labelNodeId);
          }}
          onPaste={event => {
            event.preventDefault();
            if (clipboardToken.current) {
              insertTokenAtCursor(clipboardToken.current);
              clipboardToken.current = undefined;
              return;
            }
            const selection = window.getSelection();
            if (!selection?.rangeCount) return;
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const text = event.clipboardData.getData('text/plain');
            const textNode = window.document.createTextNode(text);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            syncCanvas();
          }}
          style={{
            border: '1px solid currentColor',
            borderRadius: 4,
            minHeight: 240,
            overflow: 'auto',
            padding: 12,
            whiteSpace: 'pre-wrap',
          }}
        />
        <Flex vertical gap="small" aria-label={t('Label preview')}>
          {unresolvedFields.length > 0 && (
            <div role="alert">
              {t(
                'Preview values are unavailable for: %s. Apply the label and run the chart query.',
                Array.from(new Set(unresolvedFields)).join(', '),
              )}
            </div>
          )}
          {compiledPreview.map(paragraph => (
            <div
              key={paragraph.id}
              style={{
                minHeight: '1.5em',
                overflowWrap: 'anywhere',
                textAlign: paragraph.alignment,
                whiteSpace: 'pre-wrap',
              }}
            >
              {paragraph.spans.map(span => (
                <span
                  key={span.id}
                  style={{
                    color: span.style?.color,
                    fontFamily: span.style?.fontFamily,
                    fontSize: span.style?.fontSize,
                    fontWeight: span.style?.bold ? 'bold' : undefined,
                    fontStyle: span.style?.italic ? 'italic' : undefined,
                    textDecoration: span.style?.underline
                      ? 'underline'
                      : undefined,
                  }}
                >
                  {span.text}
                </span>
              ))}
            </div>
          ))}
        </Flex>
      </Flex>
    </Modal>
  );
}
