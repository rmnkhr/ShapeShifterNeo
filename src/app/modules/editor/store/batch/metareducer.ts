import { Action, ActionReducer } from 'app/modules/editor/store';
import { EditorState } from 'app/modules/editor/store/reducer';

import { BatchActionTypes, BatchActions } from './actions';

export function metaReducer(reducer: ActionReducer<EditorState>): ActionReducer<EditorState> {
  return (state: EditorState, action: BatchActions) => {
    const isBatchAction = action.type === BatchActionTypes.BatchAction;
    const actions: ReadonlyArray<Action> = isBatchAction ? action.payload : [action];
    return actions.reduce((accState, currAction) => reducer(accState, currAction), state);
  };
}
