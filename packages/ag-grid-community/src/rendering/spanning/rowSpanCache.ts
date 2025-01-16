import { BeanStub } from '../../context/beanStub';
import type { AgColumn } from '../../entities/agColumn';
import type { RowNode } from '../../entities/rowNode';
import type { BeanCollection, IRowModel, ValueService } from '../../main';

export const _doesColumnSpan = (column: AgColumn) => {
    // todo replace with new row spanning
    return column.getColDef().rowSpan;
};

export class CellSpan {
    private spannedNodes: Set<RowNode>;
    private lastNode: RowNode;

    constructor(
        public readonly col: AgColumn,
        public readonly firstNode: RowNode
    ) {
        this.firstNode = firstNode;
        this.spannedNodes = new Set([firstNode]);
        this.lastNode = firstNode;
    }

    public addSpannedNode(node: RowNode): void {
        this.spannedNodes.add(node);
        this.lastNode = node;
    }

    public getSpannedNodes() {
        return this.spannedNodes;
    }

    public getFirstNode(): RowNode {
        return this.firstNode;
    }

    public getLastNode(): RowNode {
        return this.lastNode;
    }

    public getCellHeight(): number {
        return this.lastNode.rowTop! + this.lastNode.rowHeight! - this.firstNode.rowTop! - 1; // -1 should be border height I think
    }
}

/**
 * Belongs to a column, when cells are to be rendered they call back to this service with the values.
 * This service determines if the cell should instead be replaced with a spanning cell, in which case the cell is
 * stretched over multiple rows.
 *
 * Only create if spanning is enabled for this column.
 */
export class RowSpanCache extends BeanStub {
    private readonly column: AgColumn;

    private valueService: ValueService;

    private valueNodeMap: Map<RowNode, CellSpan>;

    constructor(column: AgColumn) {
        super();
        this.column = column;
    }

    private rowModel: IRowModel;

    public wireBeans(beans: BeanCollection) {
        this.rowModel = beans.rowModel;
        this.valueService = beans.valueSvc;
    }

    public buildCache(): void {
        if (!this.rowModel.forEachFlattenedNode) {
            // invalid row model.
            return;
        }

        this.valueNodeMap = new Map();

        let lastLevel = -1;
        let lastKey: any = null;
        let lastNode: RowNode | null = null;

        let spanData: CellSpan | null = null;
        const isFullWidthCellFunc = this.beans.gos.getCallback('isFullWidthRow');
        this.rowModel.forEachFlattenedNode((node: RowNode) => {
            const isFullWidthNode =
                node.detail || (isFullWidthCellFunc ? isFullWidthCellFunc({ rowNode: node }) : false);

            // don't bother calculating span of hidden or FW rows
            if (node.rowIndex == null || isFullWidthNode) {
                lastLevel = -1;
                lastKey = null;
                lastNode = null;
                spanData = null;
                return;
            }

            // TODO: value getter might be faster, but need to consider obj values
            const key = this.valueService.getKeyForNode(this.column, node);
            // if level or key is different, cells do not span.
            if (lastNode == null || node.level !== lastLevel || key !== lastKey || node.footer) {
                lastLevel = node.level;
                lastKey = key;
                lastNode = node;
                spanData = null;
                return;
            }

            if (!spanData) {
                spanData = new CellSpan(this.column, lastNode);
                this.valueNodeMap.set(lastNode, spanData);
            }
            spanData.addSpannedNode(node);
            this.valueNodeMap.set(node, spanData);
        });
    }

    public isCellSpanning(node: RowNode): boolean {
        return !!this.valueNodeMap.get(node);
    }

    public getCellSpan(node: RowNode): CellSpan | undefined {
        return this.valueNodeMap.get(node);
    }

    public getSpannedHeight(node: RowNode): number {
        const spanData = this.valueNodeMap.get(node);
        if (!spanData) {
            return -1;
        }

        // note, should _not_ include autoheight cells
        return spanData.getCellHeight();
    }

    public getAllSpanData() {
        return this.valueNodeMap.values();
    }
}
