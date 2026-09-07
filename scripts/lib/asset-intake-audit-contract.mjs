import { basename, dirname } from 'node:path';

export function validateIntakeAuditContract({ contract, profileSha256, profile, receipt, manifests, manifestPaths = [], catalog, combinedInventory, similarityMap, urlReview }) {
  const errors = [];
  for (const [label, value] of [['profile', profile], ['receipt', receipt], ['catalog', catalog], ['combined inventory', combinedInventory], ['similarity map', similarityMap], ['URL review', urlReview]]) {
    if (value?.intakeId !== contract.intakeId) errors.push(`${label}: intakeId mismatch`);
  }
  if (profileSha256 !== contract.profileSha256) errors.push('profile: SHA-256 mismatch');
  const assets = manifests.flatMap((manifest) => manifest.assets);
  const gifAssets = assets.filter((asset) => asset.mediaType === 'image/gif');
  const sourceIds = [...new Set(manifests.map((manifest) => manifest.sourceId))].sort();
  const expectedSourceIds = [...profile.products.map((product) => product.sourceId)].sort();
  if (JSON.stringify(sourceIds) !== JSON.stringify(expectedSourceIds)) errors.push('manifests: profile product/source coverage mismatch');
  const productBySourceId = new Map(profile.products.map((product) => [product.sourceId, product]));
  for (const [index, manifest] of manifests.entries()) {
    const product = productBySourceId.get(manifest.sourceId);
    if (!product) continue;
    if (manifest.productId !== product.productId || manifest.product !== product.label) errors.push(`manifests: product identity mismatch for ${manifest.sourceId}`);
    if (manifestPaths[index] && basename(dirname(manifestPaths[index])) !== product.folder) errors.push(`manifests: product folder mismatch for ${manifest.sourceId}`);
  }
  const observed = {
    receiptEntries: receipt.entries.length,
    receiptManaged: receipt.counts.managed,
    productManifests: manifests.length,
    visualManifestPaths: assets.length,
    intakeBinaryGroups: catalog.entries.length,
    uniqueGifBinaries: new Set(gifAssets.map((asset) => asset.sha256)).size,
    gifSourcePaths: gifAssets.length,
    urlRecords: urlReview.entries.length,
    combinedCounts: combinedInventory.counts,
    visualGroups: similarityMap.visualGroupCount,
    unjudgedVisualGroups: similarityMap.unjudgedCount,
  };
  compareObject(contract.expected, observed, '', errors);
  return { errors, observed, passed: errors.length === 0 };
}

function compareObject(expected, actual, prefix, errors) {
  for (const [key, expectedValue] of Object.entries(expected)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const actualValue = actual?.[key];
    if (expectedValue && typeof expectedValue === 'object' && !Array.isArray(expectedValue)) compareObject(expectedValue, actualValue, path, errors);
    else if (actualValue !== expectedValue) errors.push(`${path}: expected ${expectedValue}, got ${actualValue}`);
  }
}
