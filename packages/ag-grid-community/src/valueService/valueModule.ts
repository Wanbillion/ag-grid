import type { _ValueApi, _ValueCacheApi } from '../api/gridApi';
import type { _ModuleWithApi, _ModuleWithoutApi } from '../interfaces/iModule';
import { RowSpanService } from '../rendering/spanning/rowSpanService';
import { SpannedCellRenderer } from '../rendering/spanning/spannedCellRenderer';
import { VERSION } from '../version';
import { expireValueCache, getCellValue } from './cellApi';
import { ChangeDetectionService } from './changeDetectionService';
import { ExpressionService } from './expressionService';
import { ValueCache } from './valueCache';

/**
 * @feature Performance -> Value Cache
 * @gridOption valueCache
 */
export const ValueCacheModule: _ModuleWithApi<_ValueCacheApi> = {
    moduleName: 'ValueCache',
    version: VERSION,
    // temp, make a new module for this stuff.
    beans: [ValueCache, RowSpanService, SpannedCellRenderer],
    apiFunctions: {
        expireValueCache,
    },
};

/**
 * @feature Cells -> Expression
 */
export const ExpressionModule: _ModuleWithoutApi = {
    moduleName: 'Expression',
    version: VERSION,
    beans: [ExpressionService],
};

/**
 * @feature Change Detection
 * @gridOption suppressChangeDetection
 */
export const ChangeDetectionModule: _ModuleWithoutApi = {
    moduleName: 'ChangeDetection',
    version: VERSION,
    beans: [ChangeDetectionService],
};

/**
 * @feature Cells -> API
 */
export const CellApiModule: _ModuleWithApi<_ValueApi<any>> = {
    moduleName: 'CellApi',
    version: VERSION,
    apiFunctions: {
        getCellValue,
    },
};
