import { CellComp } from '../../rendering/cell/cellComp';
import type { CellCtrl } from '../../rendering/cell/cellCtrl';
import { RowComp } from '../../rendering/row/rowComp';
import type { RowCtrl, RowCtrlInstanceId } from '../../rendering/row/rowCtrl';
import { _setAriaRole } from '../../utils/aria';
import { _isBrowserFirefox } from '../../utils/browser';
import { _ensureDomOrder, _insertWithDomOrder } from '../../utils/dom';
import type { ComponentSelector } from '../../widgets/component';
import { Component, RefPlaceholder } from '../../widgets/component';
import type { IRowContainerComp, RowContainerName, RowContainerOptions } from './rowContainerCtrl';
import { RowContainerCtrl, _getRowContainerOptions } from './rowContainerCtrl';

function templateFactory(options: RowContainerOptions): string {
    return `<div class="${options.viewport}" data-ref="eViewport" role="presentation" style="position: relative">
                <div class="${options.container}" data-ref="eContainer"></div>
                <div class="${options.container}-spanned-cells" data-ref="eSpannedCellContainer" style="position:absolute; top: 0"></div>
            </div>`;
}

export class RowContainerComp extends Component {
    private readonly eViewport: HTMLElement = RefPlaceholder;
    private readonly eContainer: HTMLElement = RefPlaceholder;
    private readonly eSpannedCellContainer: HTMLElement = RefPlaceholder;

    private readonly name: RowContainerName;
    private readonly options: RowContainerOptions;

    private rowComps: { [id: RowCtrlInstanceId]: RowComp } = {};

    // we ensure the rows are in the dom in the order in which they appear on screen when the
    // user requests this via gridOptions.ensureDomOrder. this is typically used for screen readers.
    private domOrder: boolean;
    private lastPlacedElement: HTMLElement | null;

    constructor(params?: { name: string }) {
        super();
        this.name = params?.name as RowContainerName;
        this.options = _getRowContainerOptions(this.name);
        this.setTemplate(templateFactory(this.options));
    }

    public postConstruct(): void {
        const compProxy: IRowContainerComp = {
            setHorizontalScroll: (offset: number) => {
                this.eViewport.scrollLeft = offset;
                this.eSpannedCellContainer.scrollLeft = offset;
            },
            setViewportHeight: (height) => {
                this.eViewport.style.height = height;
                this.eSpannedCellContainer.style.height = height;
            },
            setRowCtrls: ({ rowCtrls }) => this.setRowCtrls(rowCtrls),
            updateSpannedCells: () => this.updateSpannedCells(),
            setDomOrder: (domOrder) => {
                this.domOrder = domOrder;
            },
            setContainerWidth: (width) => {
                this.eContainer.style.width = width;
                this.eSpannedCellContainer.style.width = width;
            },
            setOffsetTop: (offset) => {
                this.eContainer.style.transform = `translateY(${offset})`;
                this.eSpannedCellContainer.style.transform = `translateY(${offset})`;
            },
        };

        const ctrl = this.createManagedBean(new RowContainerCtrl(this.name));
        ctrl.setComp(compProxy, this.eContainer, this.eViewport);
    }

    public override destroy(): void {
        // destroys all row comps
        this.setRowCtrls([]);
        super.destroy();
    }

    private setRowCtrls(rowCtrls: RowCtrl[]): void {
        const oldRows = { ...this.rowComps };
        this.rowComps = {};

        this.lastPlacedElement = null;

        const processRow = (rowCon: RowCtrl) => {
            const instanceId = rowCon.instanceId;
            const existingRowComp = oldRows[instanceId];

            if (existingRowComp) {
                this.rowComps[instanceId] = existingRowComp;
                delete oldRows[instanceId];
                this.ensureDomOrder(existingRowComp.getGui(), rowCon);
            } else {
                // don't create new row comps for rows which are not displayed. still want the existing components
                // as they may be animating out.
                if (!rowCon.rowNode.displayed) {
                    return;
                }
                const rowComp = new RowComp(rowCon, this.beans, this.options.type);
                this.rowComps[instanceId] = rowComp;
                this.appendRow(rowComp.getGui());
            }
        };

        rowCtrls.forEach(processRow);
        Object.values(oldRows).forEach((oldRowComp) => {
            this.eContainer.removeChild(oldRowComp.getGui());
            oldRowComp.destroy();
        });

        _setAriaRole(this.eContainer, 'rowgroup');
    }

    /**
     * This is done inside of one container, this is because
     * for col spanning _with_ row spanning it's 2 dimensional,
     * we cannot constrain cells in either direction
     */
    private spanningCells: Map<CellCtrl, CellComp> = new Map();
    private updateSpannedCells() {
        const rowSpanSvc = this.beans.rowSpanSvc;
        if (!rowSpanSvc || !this.options.supportsSpanning) {
            return;
        }

        const spannedCtrls = this.beans.spannedCellRenderer?.getCtrls(this.options.type);
        if (!spannedCtrls) {
            return;
        }

        const spannedCells = new Map<CellCtrl, CellComp>();
        for (const ctrl of spannedCtrls) {
            const existingComp = this.spanningCells.get(ctrl);
            if (existingComp) {
                spannedCells.set(ctrl, existingComp);
                this.spanningCells.delete(ctrl);
                continue;
            }

            const comp = new CellComp(this.beans, ctrl, false, this.eSpannedCellContainer, false);
            // does not assert dom order
            this.eSpannedCellContainer.appendChild(comp.getGui());
            spannedCells.set(ctrl, comp);
        }

        // remove all missing cells
        for (const comp of this.spanningCells.values()) {
            this.eSpannedCellContainer.removeChild(comp.getGui());
            comp.destroy();
        }

        this.spanningCells = spannedCells;
    }

    public appendRow(element: HTMLElement) {
        if (this.domOrder) {
            _insertWithDomOrder(this.eContainer, element, this.lastPlacedElement);
        } else {
            this.eContainer.appendChild(element);
        }
        this.lastPlacedElement = element;
    }

    private ensureDomOrder(eRow: HTMLElement, rowCtrl: RowCtrl): void {
        if (!this.domOrder) {
            return;
        }

        // firefox fails to fire mouseleave events if nodes are removed from the DOM
        // so we manually remove the hover styles, to prevent multiple rows from being
        // style with hovered CSS while scrolling.
        if (_isBrowserFirefox()) {
            rowCtrl.resetHoveredStatus();
        }

        _ensureDomOrder(this.eContainer, eRow, this.lastPlacedElement);
        this.lastPlacedElement = eRow;
    }
}

export const RowContainerSelector: ComponentSelector = {
    selector: 'AG-ROW-CONTAINER',
    component: RowContainerComp,
};
