import type { NamedBean } from '../../context/bean';
import { BeanStub } from '../../context/beanStub';
import type { AgColumn } from '../../entities/agColumn';
import type { RowNode } from '../../entities/rowNode';
import type { CellSpan } from './rowSpanCache';
import { RowSpanCache } from './rowSpanCache';

export class RowSpanService extends BeanStub implements NamedBean {
    beanName = 'rowSpanSvc' as const;

    /**
     * Columns that currently have spanning, used for dispatching row node value changed events
     * to update the spanning cache.
     */
    private spanningColumns: Map<AgColumn, RowSpanCache> = new Map();

    /**
     * When a new column is created with spanning (or spanning changes for a column)
     * @param column column that is now spanning
     */
    public register(column: AgColumn): void {
        if (this.spanningColumns.has(column)) {
            return;
        }
        const cache = this.createManagedBean(new RowSpanCache(column));
        this.spanningColumns.set(column, cache);
    }

    /**
     * When a new column is destroyed with spanning (or spanning changes for a column)
     * @param column column that is now spanning
     */
    public deregister(column: AgColumn): void {
        this.spanningColumns.delete(column);
    }

    private buildCaches(): void {
        this.spanningColumns.forEach((cache) => cache.buildCache());
    }

    public shouldSkipCell(col: AgColumn, rowNode: RowNode): boolean {
        const cache = this.spanningColumns.get(col);
        if (!cache) {
            return false;
        }
        return cache.shouldSkipCell(rowNode);
    }

    public isCellSpanning(col: AgColumn, rowNode: RowNode): boolean {
        const cache = this.spanningColumns.get(col);
        if (!cache) {
            return false;
        }

        return cache.isCellSpanning(rowNode);
    }

    public getSpannedHeight(col: AgColumn, rowNode: RowNode): number | undefined {
        const cache = this.spanningColumns.get(col);
        if (!cache) {
            return undefined;
        }

        return cache.getSpannedHeight(rowNode);
    }

    public forEachSpannedColumn(rowNode: RowNode, callback: (col: AgColumn, span: CellSpan) => void): void {
        for (const [col, cache] of this.spanningColumns) {
            if (cache.isCellSpanning(rowNode)) {
                const spanningNode = cache.getCellSpan(rowNode)!;
                callback(col, spanningNode);
            }
        }
    }

    public postConstruct(): void {
        this.addManagedEventListeners({
            modelUpdated: this.buildCaches.bind(this),
        });
    }

    public forEachCellSpan(callback: (sd: CellSpan) => void): void {
        this.spanningColumns.forEach((cache) => {
            for (const span of cache.getAllSpanData()) {
                callback(span);
            }
        });
    }

    public override destroy(): void {
        super.destroy();
    }
}
