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
  commitAuthoringState,
  createAuthoringHistory,
  redoAuthoringState,
  undoAuthoringState,
} from './authoringHistory';

test('undoes and redoes authoring mutations', () => {
  const initial = createAuthoringHistory({ rows: [] as string[] });
  const changed = commitAuthoringState(initial, { rows: ['region'] });
  const undone = undoAuthoringState(changed);

  expect(undone.present.rows).toEqual([]);
  expect(redoAuthoringState(undone).present.rows).toEqual(['region']);
});

test('bounds history and clears redo state after a new mutation', () => {
  const initial = createAuthoringHistory(0, 2);
  const second = commitAuthoringState(
    commitAuthoringState(initial, 1),
    2,
  );
  const third = commitAuthoringState(second, 3);
  const undone = undoAuthoringState(third);
  const changed = commitAuthoringState(undone, 4);

  expect(third.past).toEqual([1, 2]);
  expect(changed.future).toEqual([]);
  expect(redoAuthoringState(changed)).toBe(changed);
});
