import { batchWorkerExecutor } from 'ag-shared/plugin-utils';
import { versions } from 'process';

if (versions.node < '18.18') {
    // eslint-disable-next-line no-console
    throw new Error('Upgrade Node.js to v18.18.0 for multi-threaded thumbnail generation; found: ' + versions.node);
}
const executor = batchWorkerExecutor(`${module.path}/batch-instance.js`);

export default executor;
