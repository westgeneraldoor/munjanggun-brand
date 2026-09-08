import { parseArgs } from 'node:util';
import { generateStaticTileEvidence } from './lib/static-tile-evidence-generator.mjs';

const { values } = parseArgs({
  options: {
    queue: { type: 'string' },
    'queue-sha256': { type: 'string' },
    sha256: { type: 'string' },
    'all-static': { type: 'boolean', default: false },
    'output-root': { type: 'string' },
    'max-tile-size': { type: 'string', default: '1024' },
    'dry-run': { type: 'boolean', default: false },
    inventory: { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (!values.queue) throw new Error('--queue is required');
if (values.inventory && values['dry-run']) throw new Error('--inventory and --dry-run are mutually exclusive');
const mode = values.inventory ? 'inventory' : values['dry-run'] ? 'dry-run' : 'build';
const result = await generateStaticTileEvidence({
  queuePath: values.queue,
  expectedQueueSha256: values['queue-sha256'] ?? null,
  sha256: values.sha256 ?? null,
  allStatic: values['all-static'],
  outputRoot: values['output-root'] ?? null,
  maxTileSize: Number(values['max-tile-size']),
  mode,
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
