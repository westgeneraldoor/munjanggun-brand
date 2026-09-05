import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256File } from './asset-inventory.mjs';
import { verifyTrustedOwnerSignature } from './asset-owner-trust.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './schema-validation.mjs';

export async function verifyApprovalAuthority({
  catalog,
  catalogPath,
  ledgerPath,
  receiptPath,
  useEvidenceReceiptPath,
  ownerSignatureVerifier = verifyTrustedOwnerSignature,
}) {
  const resolvedCatalogPath = resolve(catalogPath);
  const resolvedLedgerPath = resolve(ledgerPath);
  const resolvedReceiptPath = resolve(receiptPath);
  const resolvedUseEvidenceReceiptPath = resolve(useEvidenceReceiptPath);
  const [ledger, receipt, ledgerSchema, receiptSchema] = await Promise.all([
    readJson(resolvedLedgerPath), readJson(resolvedReceiptPath),
    readJson(fileURLToPath(new URL('../../schemas/asset-owner-decisions.schema.json', import.meta.url))),
    readJson(fileURLToPath(new URL('../../schemas/asset-owner-decision-receipt.schema.json', import.meta.url))),
  ]);
  assertSchema(ledger, ledgerSchema, 'owner decision ledger');
  assertSchema(receipt, receiptSchema, 'owner decision receipt');
  await ownerSignatureVerifier(receipt, 'Owner decision receipt');
  const catalogSha256 = await sha256File(resolvedCatalogPath);
  const ledgerSha256 = await sha256File(resolvedLedgerPath);
  const receiptSha256 = await sha256File(resolvedReceiptPath);
  if (resolve(dirname(resolvedReceiptPath), receipt.ledgerRef) !== resolvedLedgerPath) throw new Error('Owner decision receipt ledger path mismatch');
  if (receipt.ledgerSha256 !== ledgerSha256) throw new Error('Owner decision receipt ledger SHA mismatch');
  if (ledger.catalogSha256 !== catalogSha256 || receipt.catalogSha256 !== catalogSha256) throw new Error('Owner decision catalog SHA mismatch');
  const useEvidenceReceiptSha256 = await sha256File(resolvedUseEvidenceReceiptPath);
  if (ledger.useEvidenceReceiptSha256 !== useEvidenceReceiptSha256 || receipt.useEvidenceReceiptSha256 !== useEvidenceReceiptSha256) throw new Error('Owner decision use evidence receipt SHA mismatch');
  if (ledger.intakeId !== catalog.intakeId || receipt.intakeId !== catalog.intakeId) throw new Error('Owner decision intakeId mismatch');
  if (ledger.assetDecisionCount !== ledger.assetDecisions.length || ledger.assetDecisionCount !== catalog.entries.length) throw new Error('Owner asset decision count mismatch');
  if (receipt.assetDecisionCount !== ledger.assetDecisionCount || receipt.escalationDecisionCount !== ledger.escalationDecisionCount) throw new Error('Owner decision receipt count mismatch');
  const assetDecisionBySha = new Map();
  const catalogBySha = new Map(catalog.entries.map((entry) => [entry.sha256, entry]));
  for (const decision of ledger.assetDecisions) {
    if (assetDecisionBySha.has(decision.sha256)) throw new Error(`Duplicate owner asset decision ${decision.sha256}`);
    const catalogEntry = catalogBySha.get(decision.sha256);
    if (!catalogEntry || catalogEntry.contentId !== decision.contentId) throw new Error(`Owner asset decision target mismatch ${decision.sha256}`);
    assetDecisionBySha.set(decision.sha256, decision);
  }
  if (assetDecisionBySha.size !== catalogBySha.size) throw new Error('Owner asset decision coverage mismatch');
  return {
    ledger,
    receipt,
    ledgerPath: resolvedLedgerPath,
    receiptPath: resolvedReceiptPath,
    ledgerSha256,
    receiptSha256,
    assetDecisionBySha,
  };
}

function assertSchema(value, schema, label) {
  const result = validateAgainstSchema(value, schema);
  if (!result.valid) throw new Error(`${label} schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
