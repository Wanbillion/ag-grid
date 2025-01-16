import type { BeanCollection } from '../../context/context';
import type { CellFocusedEvent } from '../../events';
import { _findFocusableElements, _isCellFocusSuppressed } from '../../utils/focus';
import { CellCtrl } from '../cell/cellCtrl';
import type { CellSpan } from './rowSpanCache';

const CSS_CELL_FOCUS = 'ag-cell-focus';

export class SpannedCellCtrl extends CellCtrl {
    constructor(
        public readonly cellSpan: CellSpan,
        beans: BeanCollection
    ) {
        super(cellSpan.col, cellSpan.firstNode, beans, undefined!);
    }

    public override shouldRestoreFocus(): boolean {
        // Used in React to determine if the cell should restore focus after re-rendering
        return this.beans.focusSvc.shouldRestoreFocusToCellSpan(this.cellSpan);
    }

    public override onFocusOut(): void {
        // Used in React
        this.beans.focusSvc.clearRestoreFocus();
    }

    public override onCellFocused(event?: CellFocusedEvent): void {
        const { beans } = this;
        if (_isCellFocusSuppressed(beans)) {
            return;
        }
        const cellFocused = beans.focusSvc.isSpanFocused(this.cellSpan);

        if (!this.comp) {
            if (cellFocused && event?.forceBrowserFocus) {
                // The cell comp has not been rendered yet, but the browser focus is being forced for this cell
                // so lets save the event to apply it when setComp is called in the next turn.
                this.focusEventToRestore = event;
            }
            return;
        }
        // Clear the saved focus event
        this.focusEventToRestore = undefined;

        this.comp.addOrRemoveCssClass(CSS_CELL_FOCUS, cellFocused);

        // see if we need to force browser focus - this can happen if focus is programmatically set
        if (cellFocused && event && event.forceBrowserFocus) {
            let focusEl = this.comp.getFocusableElement();

            if (this.editing) {
                const focusableEls = _findFocusableElements(focusEl, null, true);
                if (focusableEls.length) {
                    focusEl = focusableEls[0];
                }
            }

            focusEl.focus({ preventScroll: !!event.preventScrollOnBrowserFocus });
        }

        // if another cell was focused, and we are editing, then stop editing
        const fullRowEdit = beans.gos.get('editType') === 'fullRow';

        if (!cellFocused && !fullRowEdit && this.editing) {
            beans.editSvc?.stopRowOrCellEdit(this);
        }

        // TODO
        if (cellFocused && this.rowCtrl) {
            this.rowCtrl.announceDescription();
        }
    }
}
