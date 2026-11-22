import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseBundle } from './firebaseClient';
import { applyRedaction } from './piiEngine';
import type { TelemetryEvent, VaultDocument } from '../types/vault';

export interface CloudSafeVaultRecord {
  id: string;
  title: string;
  category: VaultDocument['category'];
  redactedText: string;
  redactedEntityCount: number;
  piiBytesKeptLocal: number;
  riskScore: number | null;
  riskVerdict: string | null;
  executiveSummary: string | null;
  findingsCount: number;
  zeroLeakVerified: true;
  updatedAt: unknown;
}

/**
 * Persists ONLY zero-PII redacted vault metadata & sanitized audit results to Cloud Firestore.
 * Raw PII values and the local keymap are NEVER transmitted to Firestore.
 */
export async function syncSanitizedVaultToFirestore(
  uid: string,
  vault: VaultDocument
): Promise<{ synced: boolean; bytesProtected: number; error?: string }> {
  const bundle = getFirebaseBundle();
  if (!bundle.db) return { synced: false, bytesProtected: 0, error: 'Firestore not configured' };

  const { redactedText, shieldedBytes, activeCount, zeroLeakVerified } = applyRedaction(
    vault.rawText,
    vault.entities
  );

  if (!zeroLeakVerified) {
    return {
      synced: false,
      bytesProtected: shieldedBytes,
      error: 'Zero-leak assertion failed; aborted cloud sync.',
    };
  }

  const record: CloudSafeVaultRecord = {
    id: vault.id,
    title: vault.title,
    category: vault.category,
    redactedText,
    redactedEntityCount: activeCount,
    piiBytesKeptLocal: shieldedBytes,
    riskScore: vault.auditReport?.riskScore ?? null,
    riskVerdict: vault.auditReport?.riskVerdict ?? null,
    executiveSummary: vault.auditReport?.executiveSummary ?? null,
    findingsCount: vault.auditReport?.findings.length ?? 0,
    zeroLeakVerified: true,
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(bundle.db, 'users', uid, 'vaults', vault.id), record, { merge: true });
  return { synced: true, bytesProtected: shieldedBytes };
}

export async function logTelemetryToFirestore(
  uid: string,
  event: TelemetryEvent
): Promise<void> {
  const bundle = getFirebaseBundle();
  if (!bundle.db) return;
  try {
    await setDoc(doc(bundle.db, 'users', uid, 'telemetry', event.id), {
      ...event,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Telemetry logging is best-effort and never blocks user workflow
  }
}

export async function fetchSyncedVaultSummaries(uid: string): Promise<CloudSafeVaultRecord[]> {
  const bundle = getFirebaseBundle();
  if (!bundle.db) return [];
  try {
    const q = query(
      collection(bundle.db, 'users', uid, 'vaults'),
      orderBy('updatedAt', 'desc'),
      limit(10)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CloudSafeVaultRecord);
  } catch {
    return [];
  }
}
