import type { NamedBean } from '../../context/bean';
import { BeanStub } from '../../context/beanStub';
import type { RowContainerType } from '../../gridBodyComp/rowContainer/rowContainerCtrl';
import type { CellPosition } from '../../main';
import type { CellCtrl } from '../cell/cellCtrl';
import type { CellSpan } from './rowSpanCache';
import { SpannedCellCtrl } from './spannedCellCtrl';

export class SpannedCellRenderer
    extends BeanStub<'leftSpannedCellsUpdated' | 'centerSpannedCellsUpdated' | 'rightSpannedCellsUpdated'>
    implements NamedBean
{
    beanName = 'spannedCellRenderer' as const;

    public postConstruct(): void {
        this.addManagedEventListeners({
            // if virtualised rows change, ensure correct ctrls
            displayedRowsChanged: this.createAllCtrls.bind(this),

            // if virtualised cols change, ensure correct ctrls
            displayedColumnsChanged: this.createAllCtrls.bind(this),
            virtualColumnsChanged: this.createAllCtrls.bind(this),

            // if pinning changes, recreate ctrls
            columnPinned: this.createAllCtrls.bind(this),
        });
    }

    // all rendered cell ctrls
    // private cellCtrls = new Map<CellSpan, CellCtrl>();
    private allCtrlsArr: CellCtrl[] | undefined;

    private ctrls = {
        left: new Map<CellSpan, CellCtrl>(),
        center: new Map<CellSpan, CellCtrl>(),
        right: new Map<CellSpan, CellCtrl>(),
    };

    private createAllCtrls() {
        this.createCtrls('left');
        this.createCtrls('center');
        this.createCtrls('right');
    }

    /**
     * When displayed rows or cols change, the spanned cell ctrls need to update
     */
    private createCtrls(viewport: 'left' | 'center' | 'right') {
        const previousCtrls = this.ctrls[viewport];

        // all currently rendered row ctrls which may have spanned cells
        const rowCtrls = this.beans.rowRenderer.getAllRowCtrls();

        const newCellCtrls = new Map<CellSpan, CellCtrl>();

        let hasNew = false;
        const sectionCols = new Set(this.beans.visibleCols[`${viewport}Cols`]); // ensure virtualized cols only
        for (const ctrl of rowCtrls) {
            this.beans.rowSpanSvc?.forEachSpannedColumn(ctrl.rowNode, (col, cellSpan) => {
                // ignore if col invisible
                if (!sectionCols.has(col)) {
                    return;
                }

                const existingCtrl = previousCtrls.get(cellSpan);
                if (existingCtrl) {
                    newCellCtrls.set(cellSpan, existingCtrl);
                    previousCtrls.delete(cellSpan);
                    return;
                }

                hasNew = true;
                const newCtrl = new SpannedCellCtrl(cellSpan, this.beans);
                newCellCtrls.set(cellSpan, newCtrl);
            });
        }

        const sameCount = newCellCtrls.size === previousCtrls.size;
        if (!hasNew && sameCount) return;

        for (const oldCtrl of previousCtrls.values()) {
            oldCtrl.destroy();
        }

        // slow/inefficient, work on better approach for this...
        // refresh existing rowCtrls to make sure they recreate cells which are no longer spanned
        // rowCtrls.forEach((ctrl) => {
        //     ctrl.recreateCell(undefined!);
        // });

        this.ctrls[viewport] = newCellCtrls;
        this.allCtrlsArr = undefined;

        this.dispatchLocalEvent({
            type: `${viewport}SpannedCellsUpdated`,
        });
    }

    public getCellByPosition(cellPosition: CellPosition) {
        if (cellPosition.rowPinned) {
            // not currently supported
            return undefined;
        }

        const centerCols = new Set(this.beans.visibleCols.centerCols);
        if (centerCols) {
            for (const [span, ctrl] of this.ctrls.center.entries()) {
                if (span.col !== cellPosition.column) {
                    continue;
                }

                for (const node of span.getSpannedNodes()) {
                    if (node.rowIndex === cellPosition.rowIndex) {
                        return ctrl;
                    }
                }
            }
        }
        return undefined;
    }

    public getAllCtrlsArr() {
        if (!this.allCtrlsArr) {
            this.allCtrlsArr = [
                ...this.ctrls.center.values(),
                ...this.ctrls.left.values(),
                ...this.ctrls.right.values(),
            ];
        }
        return this.allCtrlsArr;
    }

    public getCtrls(type: RowContainerType) {
        if (type === 'fullWidth') return undefined;
        return this.ctrls[type].values();
    }

    public override destroy(): void {
        super.destroy();
    }
}
