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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import { userEvent } from '@storybook/test';
import type { LabelDocument } from '@superset-ui/core';
import { LabelEditorModal } from './LabelEditorModal';

const document: LabelDocument = {
  version: 1,
  paragraphs: [
    {
      id: 'line',
      alignment: 'left',
      nodes: [{ type: 'text', id: 'text', text: 'Global: ' }],
    },
  ],
};

test('Apply commits edits without closing the editor', () => {
  const onApply = jest.fn();
  const onHide = jest.fn();
  render(
    <LabelEditorModal
      show
      document={document}
      availableFields={[]}
      onApply={onApply}
      onHide={onHide}
    />,
  );

  const canvas = screen.getByLabelText('Label document');
  expect(canvas).toHaveAttribute('contenteditable', 'true');
  const textSpan = canvas.querySelector('[data-label-node-id="text"]');
  if (!(textSpan instanceof HTMLElement)) {
    throw new Error('Expected editable label text');
  }
  textSpan.textContent = 'Worldwide: ';
  fireEvent.input(canvas);
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      paragraphs: [
        expect.objectContaining({
          nodes: [expect.objectContaining({ text: 'Worldwide: ' })],
        }),
      ],
    }),
  );
  expect(onHide).not.toHaveBeenCalled();
});

test('Cancel discards the draft without applying it', () => {
  const onApply = jest.fn();
  const onHide = jest.fn();
  render(
    <LabelEditorModal
      show
      document={document}
      availableFields={[]}
      onApply={onApply}
      onHide={onHide}
    />,
  );

  const canvas = screen.getByLabelText('Label document');
  const textSpan = canvas.querySelector('[data-label-node-id="text"]');
  if (!(textSpan instanceof HTMLElement)) {
    throw new Error('Expected editable label text');
  }
  textSpan.textContent = 'Discarded';
  fireEvent.input(canvas);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(onApply).not.toHaveBeenCalled();
  expect(onHide).toHaveBeenCalledTimes(1);
});

test('previews authorized field values through the shared formatter', () => {
  render(
    <LabelEditorModal
      show
      document={{
        version: 1,
        paragraphs: [
          {
            id: 'line',
            alignment: 'center',
            nodes: [
              { type: 'text', id: 'prefix', text: 'Global Sales: ' },
              {
                type: 'field',
                id: 'global',
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
      }}
      availableFields={[]}
      previewFieldValues={new Map([['SUM(global_sales)', 1750]])}
      onApply={jest.fn()}
      onHide={jest.fn()}
    />,
  );

  expect(screen.getByLabelText('Label preview')).toHaveTextContent(
    'Global Sales: 1.75K',
  );
});

test('formats only the selected text span', () => {
  const onApply = jest.fn();
  render(
    <LabelEditorModal
      show
      document={document}
      availableFields={[]}
      onApply={onApply}
      onHide={jest.fn()}
    />,
  );
  const canvas = screen.getByLabelText('Label document');
  const textSpan = canvas.querySelector('[data-label-node-id="text"]');
  if (!(textSpan instanceof HTMLElement)) {
    throw new Error('Expected editable label text');
  }
  const textNode = textSpan.firstChild;
  if (!textNode) throw new Error('Expected editable label text');
  const range = window.document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, 6);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent.mouseUp(textSpan);
  fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      paragraphs: [
        expect.objectContaining({
          nodes: [
            expect.objectContaining({ text: 'Global', style: { bold: true } }),
            expect.objectContaining({ text: ': ' }),
          ],
        }),
      ],
    }),
  );
});

test('Apply establishes a baseline that Cancel does not roll back', () => {
  const onApply = jest.fn();
  const onHide = jest.fn();
  render(
    <LabelEditorModal
      show
      document={document}
      availableFields={[]}
      onApply={onApply}
      onHide={onHide}
    />,
  );
  const canvas = screen.getByLabelText('Label document');
  const textSpan = canvas.querySelector('[data-label-node-id="text"]');
  if (!(textSpan instanceof HTMLElement)) throw new Error('Missing text span');
  textSpan.textContent = 'Applied';
  fireEvent.input(canvas);
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  textSpan.textContent = 'Unapplied';
  fireEvent.input(canvas);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(onApply).toHaveBeenCalledTimes(1);
  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      paragraphs: [
        expect.objectContaining({
          nodes: [expect.objectContaining({ text: 'Applied' })],
        }),
      ],
    }),
  );
  expect(onHide).toHaveBeenCalledTimes(1);
});

test('Reset restores the most recently applied baseline', () => {
  const onApply = jest.fn();
  render(
    <LabelEditorModal
      show
      document={document}
      availableFields={[]}
      onApply={onApply}
      onHide={jest.fn()}
    />,
  );
  const canvas = screen.getByLabelText('Label document');
  const textSpan = canvas.querySelector('[data-label-node-id="text"]');
  if (!(textSpan instanceof HTMLElement)) throw new Error('Missing text span');
  textSpan.textContent = 'Baseline';
  fireEvent.input(canvas);
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  textSpan.textContent = 'Discard me';
  fireEvent.input(canvas);
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(onApply).toHaveBeenLastCalledWith(
    expect.objectContaining({
      paragraphs: [
        expect.objectContaining({
          nodes: [expect.objectContaining({ text: 'Baseline' })],
        }),
      ],
    }),
  );
});

test('Clear formatting retains text and field tokens', () => {
  const onApply = jest.fn();
  render(
    <LabelEditorModal
      show
      document={{
        version: 1,
        paragraphs: [
          {
            id: 'line',
            alignment: 'left',
            nodes: [
              {
                type: 'text',
                id: 'prefix',
                text: 'Sales: ',
                style: { bold: true },
              },
              {
                type: 'field',
                id: 'sales',
                fieldType: 'measure',
                label: 'SUM(sales)',
                queryField: 'SUM(sales)',
                style: { color: '#00ffff' },
              },
            ],
          },
        ],
      }}
      availableFields={[]}
      onApply={onApply}
      onHide={jest.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear formatting' }));
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));

  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      paragraphs: [
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ text: 'Sales: ', style: {} }),
            expect.objectContaining({ label: 'SUM(sales)', style: {} }),
          ]),
        }),
      ],
    }),
  );
});

test('the modal close control uses Cancel semantics', () => {
  const onApply = jest.fn();
  const onHide = jest.fn();
  const { container } = render(
    <LabelEditorModal
      show
      document={document}
      availableFields={[]}
      onApply={onApply}
      onHide={onHide}
    />,
  );
  const closeIcon = container.ownerDocument.querySelector(
    '[data-test="close-modal-btn"]',
  );
  if (!(closeIcon instanceof HTMLElement)) {
    throw new Error('Expected modal close control');
  }
  fireEvent.click(closeIcon);

  expect(onApply).not.toHaveBeenCalled();
  expect(onHide).toHaveBeenCalledTimes(1);
});

test('serializes multiline canvas edits and inline token reordering', () => {
  const onApply = jest.fn();
  render(
    <LabelEditorModal
      show
      document={{
        version: 1,
        paragraphs: [
          {
            id: 'line-1',
            alignment: 'left',
            nodes: [
              { type: 'text', id: 'prefix', text: 'Genre: ' },
              {
                type: 'field',
                id: 'genre',
                fieldType: 'dimension',
                label: 'genre',
                queryField: 'genre',
              },
            ],
          },
        ],
      }}
      availableFields={[]}
      onApply={onApply}
      onHide={jest.fn()}
    />,
  );
  const canvas = screen.getByLabelText('Label document');
  const firstLine = canvas.querySelector('[data-label-paragraph-id="line-1"]');
  const prefix = canvas.querySelector('[data-label-node-id="prefix"]');
  const genre = canvas.querySelector('[data-label-node-id="genre"]');
  if (!(firstLine instanceof HTMLElement) || !prefix || !genre) {
    throw new Error('Expected structured canvas nodes');
  }
  firstLine.insertBefore(genre, prefix);
  const secondLine = window.document.createElement('div');
  secondLine.textContent = 'EU Sales: ';
  canvas.append(secondLine);
  fireEvent.input(canvas);
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      paragraphs: [
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ label: 'genre' }),
            expect.objectContaining({ text: 'Genre: ' }),
          ]),
        }),
        expect.objectContaining({
          nodes: [expect.objectContaining({ text: 'EU Sales: ' })],
        }),
      ],
    }),
  );
});

test('deleting an editor-owned token does not trigger React NotFoundError', () => {
  const onApply = jest.fn();
  render(
    <LabelEditorModal
      show
      document={{
        version: 1,
        paragraphs: [
          {
            id: 'line',
            alignment: 'left',
            nodes: [
              { type: 'text', id: 'prefix', text: 'Genre: ' },
              {
                type: 'field',
                id: 'genre',
                fieldType: 'dimension',
                label: 'genre',
                queryField: 'genre',
              },
            ],
          },
        ],
      }}
      availableFields={[]}
      onApply={onApply}
      onHide={jest.fn()}
    />,
  );
  const canvas = screen.getByLabelText('Label document');
  const token = canvas.querySelector('[data-label-node-id="genre"]');
  if (!token) throw new Error('Expected genre token');

  expect(() => {
    token.remove();
    fireEvent.input(canvas);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  }).not.toThrow();
  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      paragraphs: [
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ text: 'Genre: ' }),
          ]),
        }),
      ],
    }),
  );
  expect(JSON.stringify(onApply.mock.calls[0]?.[0])).not.toContain(
    '"label":"genre"',
  );
});

test('accepts native keyboard typing next to an existing field token', async () => {
  const user = userEvent.setup();
  const onApply = jest.fn();
  render(
    <LabelEditorModal
      show
      document={{
        version: 1,
        paragraphs: [
          {
            id: 'line',
            alignment: 'left',
            nodes: [
              {
                type: 'field',
                id: 'genre',
                fieldType: 'dimension',
                label: 'genre',
                queryField: 'genre',
              },
            ],
          },
        ],
      }}
      availableFields={[]}
      onApply={onApply}
      onHide={jest.fn()}
    />,
  );
  const canvas = screen.getByLabelText('Label document');
  const trailingAnchor = canvas.querySelector(
    '[data-label-node-id="line:caret:1"]',
  );
  if (!(trailingAnchor instanceof HTMLElement)) {
    throw new Error('Expected trailing caret anchor');
  }

  await user.click(trailingAnchor);
  expect(window.document.activeElement).toBe(canvas);
  await user.keyboard(' TEST');
  await user.click(screen.getByRole('button', { name: 'Apply' }));

  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      paragraphs: [
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ label: 'genre' }),
            expect.objectContaining({ text: ' TEST' }),
          ]),
        }),
      ],
    }),
  );
});

test('serializes typing before, between, and after field tokens', async () => {
  const user = userEvent.setup();
  const onApply = jest.fn();
  render(
    <LabelEditorModal
      show
      document={{
        version: 1,
        paragraphs: [
          {
            id: 'line',
            alignment: 'left',
            nodes: [
              {
                type: 'field',
                id: 'genre',
                fieldType: 'dimension',
                label: 'genre',
                queryField: 'genre',
              },
              {
                type: 'field',
                id: 'platform',
                fieldType: 'dimension',
                label: 'platform',
                queryField: 'platform',
              },
            ],
          },
        ],
      }}
      availableFields={[]}
      onApply={onApply}
      onHide={jest.fn()}
    />,
  );
  const canvas = screen.getByLabelText('Label document');

  for (const [nodeId, text] of [
    ['line:caret:0', 'BEFORE '],
    ['line:caret:1', ' BETWEEN '],
    ['line:caret:2', ' AFTER'],
  ]) {
    const anchor = canvas.querySelector(`[data-label-node-id="${nodeId}"]`);
    if (!(anchor instanceof HTMLElement)) {
      throw new Error(`Expected caret anchor ${nodeId}`);
    }
    await user.click(anchor);
    expect(window.document.activeElement).toBe(canvas);
    await user.keyboard(text);
  }

  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      paragraphs: [
        expect.objectContaining({
          nodes: [
            expect.objectContaining({ type: 'text', text: 'BEFORE ' }),
            expect.objectContaining({ type: 'field', label: 'genre' }),
            expect.objectContaining({ type: 'text', text: ' BETWEEN ' }),
            expect.objectContaining({ type: 'field', label: 'platform' }),
            expect.objectContaining({ type: 'text', text: ' AFTER' }),
          ],
        }),
      ],
    }),
  );
});
