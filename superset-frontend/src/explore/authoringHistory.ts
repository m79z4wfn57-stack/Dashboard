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

export type AuthoringHistory<State> = Readonly<{
  past: readonly State[];
  present: State;
  future: readonly State[];
  limit: number;
}>;

export const createAuthoringHistory = <State,>(
  initialState: State,
  limit = 50,
): AuthoringHistory<State> => ({
  past: [],
  present: initialState,
  future: [],
  limit,
});

export const commitAuthoringState = <State,>(
  history: AuthoringHistory<State>,
  nextState: State,
): AuthoringHistory<State> => ({
  ...history,
  past: [...history.past, history.present].slice(-history.limit),
  present: nextState,
  future: [],
});

export const undoAuthoringState = <State,>(
  history: AuthoringHistory<State>,
): AuthoringHistory<State> => {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
};

export const redoAuthoringState = <State,>(
  history: AuthoringHistory<State>,
): AuthoringHistory<State> => {
  const [next, ...future] = history.future;
  if (next === undefined) return history;
  return {
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present: next,
    future,
  };
};
