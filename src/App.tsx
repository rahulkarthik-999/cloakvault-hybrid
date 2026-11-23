import { useEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_DOCUMENTS } from './data/sampleDocuments';
import { applyRedaction, extractDeterministicPii, mergeEntities } from './lib/piiEngine';
import { extractTextFromFile } from './lib/pdfParser';
import {
  deleteLocalVault,
  loadAllLocalVaults,
  loadLocalTelemetry,
  saveLocalTelemetryEvent,
  saveLocalVault,
} from './lib/localVaultStore';
import {
  exportAuditMarkdown,
  exportRedactedDocument,
  exportZeroLeakCertificate,
  sha256Hex,
} from './lib/cryptoProof';
import {
  exportAuditDocx,
  exportAuditPdf,
  exportEntitiesCsv,
  exportRedactedDocx,
  exportRedactedHtml,
  exportRedactedPdf,
} from './lib/documentExport';
import {
  DEFAULT_REMOTE_POLICY,
  getAuthProviderKind,
  getFirebaseBundle,
  loadRemotePolicy,
  signInGuest,
  subscribeToAuth,
} from './lib/firebaseClient';
import {
  getNanoCapabilitySnapshot,
  discoverContextualPiiOnDevice,
  downloadChromeNanoModel,
  AIUnavailableError,
  runHybridDeepAudit,
  runHybridTriage,
  streamHybridChatTurn,
} from './lib/hybridAiService';
import {
  detectPlatformEnvironment,
  getChromeLanguageModelGlobal,
  shouldExposeDeveloperDiagnostics,
} from './lib/nanoPlatform';
import { logTelemetryToFirestore, syncSanitizedVaultToFirestore } from './lib/firestoreVault';
import { HeaderBar } from './components/HeaderBar';
import { VaultSidebar } from './components/VaultSidebar';
import { DocumentPaper } from './components/DocumentPaper';
import { InspectorPane } from './components/InspectorPane';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { AuthModal, type AuthModalMode } from './components/AuthModal';
import { MobileTabBar } from './components/MobileTabBar';
import type {
  ChatMessage,
  HybridInferenceMode,
  PiiType,
  RemotePolicyConfig,
  SystemCapabilities,
  TelemetryEvent,
  VaultDocument,
} from './types/vault';

function createVaultFromSample(sampleId: string): VaultDocument {
  const sample = SAMPLE_DOCUMENTS.find((s) => s.id === sampleId) ?? SAMPLE_DOCUMENTS[0];
  const now = Date.now();
  return {
    id: `${sample.id}-${now}`,
    title: sample.title,
    category: sample.category,
    rawText: sample.rawText,
    createdAt: now,
    updatedAt: now,
    entities: extractDeterministicPii(sample.rawText),
    chatHistory: [],
  };
}

export default function App() {
  const [vaults, setVaults] = useState<VaultDocument[]>(() => [
    createVaultFromSample('sample-saas-msa'),
  ]);
  const [activeVaultId, setActiveVaultId] = useState<string>(() => vaults[0].id);
  const [highlightedQuote, setHighlightedQuote] = useState<string | null>(null);
  const [airGapMode, setAirGapMode] = useState(false);
  const [busyAction, setBusyAction] = useState<'pii' | 'triage' | 'audit' | 'sync' | null>(null);
  const [nanoDownloadStalled, setNanoDownloadStalled] = useState(false);
  const activeAbortRef = useRef<AbortController | null>(null);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [firebaseModalOpen, setFirebaseModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('signin');
  const openAuthModal = (mode: AuthModalMode = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  // A task locked to on-device inference that refused to fall back to the cloud: a privacy win, not an error.
  const [shieldNotice, setShieldNotice] = useState<string | null>(null);
  // Phones/tablets show one pane at a time, switched from a bottom tab bar.
  const [mobilePane, setMobilePane] = useState<'files' | 'doc' | 'insights'>('doc');

  const reportAiFailure = (err: unknown, fallback: string) => {
    if (err instanceof AIUnavailableError && err.code === 'CANCELLED') return;
    if (err instanceof AIUnavailableError && err.code === 'NANO_REQUIRED') {
      setAiError(null);
      setShieldNotice(err.message);
      return;
    }
    setShieldNotice(null);
    setAiError(err instanceof Error ? err.message : fallback);
  };
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([]);
  const [remotePolicy, setRemotePolicy] = useState<RemotePolicyConfig>(DEFAULT_REMOTE_POLICY);

  const bundle = useMemo(() => getFirebaseBundle(), []);

  const [capabilities, setCapabilities] = useState<SystemCapabilities>({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    firebaseConfigured: bundle.configured,
    appCheckInitialized: Boolean(bundle.appCheck),
    remoteConfigLoaded: false,
    firestoreConnected: Boolean(bundle.db),
    authUserUid: null,
    authIsAnonymous: false,
    authEmail: null,
    authDisplayName: null,
    authPhotoUrl: null,
    authProvider: null,
    chromeNanoStatus: 'unsupported',
    chromeNanoDownloadProgress: null,
    nanoCapability: {
      platform: detectPlatformEnvironment(),
      hasPromptApi: getChromeLanguageModelGlobal() !== null,
      modelAvailability: 'unsupported',
      canUseOnDevice: false,
      canDownloadOnDevice: false,
      shouldExposeDiagnostics: shouldExposeDeveloperDiagnostics(),
    },
  });

  const activeVault = vaults.find((v) => v.id === activeVaultId) ?? vaults[0];

  // Hydrate persisted IndexedDB vaults, telemetry, and Chrome Extension clip handoff on mount
  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const [storedVaults, storedTelemetry] = await Promise.all([
        loadAllLocalVaults(),
        loadLocalTelemetry(),
      ]);
      if (!mounted) return;

      const params = new URLSearchParams(window.location.search);
      const requestedAuth = params.get('auth');
      if (requestedAuth === 'signin' || requestedAuth === 'signup') {
        openAuthModal(requestedAuth);
        window.history.replaceState({}, '', '/app');
      }
      const clippedText = params.get('clip');
      const clippedTitle = params.get('title') || 'Clipped Webpage Document';

      let initialVaults = storedVaults.length > 0 ? storedVaults : vaults;

      if (clippedText && clippedText.trim().length > 20) {
        const now = Date.now();
        const imported: VaultDocument = {
          id: `clip-${now}`,
          title: clippedTitle,
          category: 'general',
          rawText: clippedText,
          createdAt: now,
          updatedAt: now,
          entities: extractDeterministicPii(clippedText),
          chatHistory: [],
        };
        await saveLocalVault(imported);
        initialVaults = [imported, ...initialVaults];
        window.history.replaceState({}, '', '/app');
      } else if (storedVaults.length === 0) {
        await saveLocalVault(initialVaults[0]);
      }

      setVaults(initialVaults);
      setActiveVaultId(initialVaults[0].id);
      if (storedTelemetry.length > 0) setTelemetry(storedTelemetry);
    }

    void hydrate();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Monitor online status, Chrome Gemini Nano availability, Firebase Remote Config & Auth
  useEffect(() => {
    const onOnline = () => setCapabilities((c) => ({ ...c, online: true }));
    const onOffline = () => setCapabilities((c) => ({ ...c, online: false }));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const syncNanoSnapshot = () => {
      void getNanoCapabilitySnapshot().then((snapshot) => {
        setCapabilities((c) => {
          if (
            c.chromeNanoStatus === snapshot.modelAvailability &&
            c.nanoCapability.canUseOnDevice === snapshot.canUseOnDevice &&
            c.nanoCapability.canDownloadOnDevice === snapshot.canDownloadOnDevice &&
            c.nanoCapability.hasPromptApi === snapshot.hasPromptApi
          ) {
            return c;
          }
          return {
            ...c,
            chromeNanoStatus: snapshot.modelAvailability,
            nanoCapability: snapshot,
            chromeNanoDownloadProgress:
              snapshot.modelAvailability === 'available' ? null : c.chromeNanoDownloadProgress,
          };
        });
      });
    };

    syncNanoSnapshot();
    const initialPlatform = detectPlatformEnvironment();
    const nanoPoller =
      initialPlatform.isChromeDesktop && getChromeLanguageModelGlobal() !== null
        ? window.setInterval(syncNanoSnapshot, 3000)
        : null;

    loadRemotePolicy().then((policy) => {
      setRemotePolicy(policy);
      setCapabilities((c) => ({
        ...c,
        remoteConfigLoaded: policy.source === 'REMOTE_CONFIG',
      }));
    });

    const unsubAuth = subscribeToAuth((user) => {
      setCapabilities((c) => ({
        ...c,
        authUserUid: user?.uid ?? null,
        authIsAnonymous: user?.isAnonymous ?? false,
        authEmail: user?.email ?? null,
        authDisplayName: user?.displayName ?? null,
        authPhotoUrl: user?.photoURL ?? null,
        authProvider: getAuthProviderKind(user),
      }));
    });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (nanoPoller !== null) window.clearInterval(nanoPoller);
      unsubAuth();
    };
  }, []);

  const updateActiveVault = (updater: (v: VaultDocument) => VaultDocument) => {
    setVaults((prev) =>
      prev.map((v) => {
        if (v.id !== activeVault.id) return v;
        const updated = { ...updater(v), updatedAt: Date.now() };
        void saveLocalVault(updated);
        return updated;
      })
    );
  };

  const recordTelemetry = async (
    partial: Omit<TelemetryEvent, 'id' | 'timestamp' | 'redactedSha256'>,
    redactedText: string
  ) => {
    const redactedSha256 = await sha256Hex(redactedText);
    const event: TelemetryEvent = {
      ...partial,
      id: `tel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      redactedSha256,
    };
    setTelemetry((prev) => [event, ...prev].slice(0, 50));
    void saveLocalTelemetryEvent(event);
    if (capabilities.authUserUid) {
      void logTelemetryToFirestore(capabilities.authUserUid, event);
    }
  };

  // If Chrome stays stuck in 'downloading' with 0%/null progress (e.g. Incognito or low disk),
  // stop spinning and fall back smoothly to the calm "Cloud AI active" indicator after 35s.
  useEffect(() => {
    if (capabilities.chromeNanoStatus === 'available') {
      setNanoDownloadStalled(false);
      return;
    }
    if (
      capabilities.chromeNanoStatus === 'downloading' &&
      (capabilities.chromeNanoDownloadProgress === null || capabilities.chromeNanoDownloadProgress === 0)
    ) {
      const stallTimer = window.setTimeout(() => {
        setNanoDownloadStalled(true);
      }, 35_000);
      return () => window.clearTimeout(stallTimer);
    }
  }, [capabilities.chromeNanoStatus, capabilities.chromeNanoDownloadProgress]);

  const handleCancelBusy = () => {
    activeAbortRef.current?.abort();
    activeAbortRef.current = null;
    setBusyAction(null);
  };

  const handleDownloadNano = async () => {
    // Never attempt to download or install Gemini Nano on mobile or unsupported browsers.
    if (!capabilities.nanoCapability.canDownloadOnDevice) return;

    setAiError(null);
    setNanoDownloadStalled(false);
    setCapabilities((c) => ({
      ...c,
      chromeNanoStatus: 'downloading',
      chromeNanoDownloadProgress: 0,
    }));
    try {
      await downloadChromeNanoModel((pct) => {
        setCapabilities((c) => ({ ...c, chromeNanoDownloadProgress: pct }));
      });
      const snapshot = await getNanoCapabilitySnapshot();
      setCapabilities((c) => ({
        ...c,
        chromeNanoStatus: snapshot.modelAvailability,
        nanoCapability: snapshot,
        chromeNanoDownloadProgress: null,
      }));
    } catch (err) {
      if (err instanceof Error && err.message === 'NANO_DOWNLOAD_STALLED') {
        setNanoDownloadStalled(true);
        setAiError(
          'On-device AI download did not progress in this browser (Incognito mode or low free disk space can prevent Chrome from downloading Gemini Nano). Sanitized Cloud AI remains active.'
        );
      } else {
        const detail =
          capabilities.nanoCapability.shouldExposeDiagnostics && err instanceof Error
            ? ` (${err.message})`
            : '';
        setAiError(
          `On-device AI could not be installed right now${detail}. Sanitized Cloud AI remains active.`
        );
      }
      const snapshot = await getNanoCapabilitySnapshot();
      setCapabilities((c) => ({
        ...c,
        chromeNanoStatus: snapshot.modelAvailability,
        nanoCapability: snapshot,
        chromeNanoDownloadProgress: null,
      }));
    }
  };

  const handleRecheckNano = async () => {
    const snapshot = await getNanoCapabilitySnapshot();
    setCapabilities((c) => ({
      ...c,
      chromeNanoStatus: snapshot.modelAvailability,
      nanoCapability: snapshot,
    }));
  };

  const handleLoadSample = (sampleId: string) => {
    const created = createVaultFromSample(sampleId);
    void saveLocalVault(created);
    setVaults((prev) => [created, ...prev]);
    setActiveVaultId(created.id);
    setHighlightedQuote(null);
    setLastSyncMessage(null);
    setAiError(null);
  };

  const handleCreateBlankVault = () => {
    const now = Date.now();
    const blank: VaultDocument = {
      id: `doc-${now}`,
      title: 'Untitled Document',
      category: 'general',
      rawText: '',
      createdAt: now,
      updatedAt: now,
      entities: [],
      chatHistory: [],
    };
    void saveLocalVault(blank);
    setVaults((prev) => [blank, ...prev]);
    setActiveVaultId(blank.id);
    setHighlightedQuote(null);
  };

  const handleDeleteVault = (id: string) => {
    void deleteLocalVault(id);
    setVaults((prev) => {
      const next = prev.filter((v) => v.id !== id);
      if (id === activeVaultId && next.length > 0) {
        setActiveVaultId(next[0].id);
      }
      return next;
    });
  };

  const handleUploadFile = async (file: File) => {
    setAiError(null);
    setUploadingFile(true);
    try {
      const rawText = await extractTextFromFile(file);
      const lower = file.name.toLowerCase();
      const category: VaultDocument['category'] =
        /\b(nda|msa|contract|agreement|lease|sow)\b/.test(lower)
          ? 'legal'
          : /\b(bank|statement|invoice|ledger|receipt|tax|payroll)\b/.test(lower)
          ? 'financial'
          : /\b(med|medical|hospital|eob|clinic|patient|bill)\b/.test(lower)
          ? 'medical'
          : 'general';

      const now = Date.now();
      const created: VaultDocument = {
        id: `file-${now}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        category,
        rawText,
        createdAt: now,
        updatedAt: now,
        entities: extractDeterministicPii(rawText),
        chatHistory: [],
      };
      await saveLocalVault(created);
      setVaults((prev) => [created, ...prev]);
      setActiveVaultId(created.id);
      setHighlightedQuote(null);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to extract document locally.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleUpdateRawText = (newText: string) => {
    updateActiveVault((v) => ({
      ...v,
      rawText: newText,
      entities: extractDeterministicPii(newText),
    }));
  };

  const handleToggleEntity = (entityId: string) => {
    updateActiveVault((v) => ({
      ...v,
      entities: v.entities.map((e) => (e.id === entityId ? { ...e, enabled: !e.enabled } : e)),
    }));
  };

  const handleAddCustomEntity = (text: string, type: PiiType) => {
    updateActiveVault((v) => ({
      ...v,
      entities: mergeEntities(v.rawText, v.entities, [{ text, type, source: 'MANUAL' }]),
    }));
  };

  const handleRunNanoPiiScan = async () => {
    setAiError(null);
    setShieldNotice(null);
    setBusyAction('pii');
    try {
      const res = await discoverContextualPiiOnDevice(
        activeVault.rawText,
        remotePolicy.cloudModelName
      );
      const merged = mergeEntities(
        activeVault.rawText,
        activeVault.entities,
        res.entities.map((e) => ({ ...e, source: 'GEMINI_NANO' as const }))
      );
      updateActiveVault((v) => ({ ...v, entities: merged }));
      const redaction = applyRedaction(activeVault.rawText, merged);
      await recordTelemetry(
        {
          task: 'PII_DISCOVERY',
          requestedMode: 'only_on_device',
          actualSource: res.source,
          modelLabel: res.modelLabel,
          latencyMs: res.latencyMs,
          piiItemsShielded: redaction.activeCount,
          piiBytesKeptLocal: redaction.shieldedBytes,
          cloudPayloadBytes: 0,
          offline: airGapMode || !capabilities.online,
        },
        redaction.redactedText
      );
    } catch (err) {
      reportAiFailure(err, 'On-device PII discovery failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunTriage = async () => {
    setAiError(null);
    setShieldNotice(null);
    setBusyAction('triage');
    const controller = new AbortController();
    activeAbortRef.current = controller;
    try {
      const redaction = applyRedaction(activeVault.rawText, activeVault.entities);
      const res = await runHybridTriage({
        redactedText: redaction.redactedText,
        category: activeVault.category,
        cloudModelName: remotePolicy.cloudModelName,
        forceOffline: airGapMode || !capabilities.online,
        signal: controller.signal,
      });
      updateActiveVault((v) => ({
        ...v,
        localTriageSummary: {
          summary: res.summary,
          documentType: res.documentType,
          urgency: res.urgency,
          inferenceSource: res.source,
          latencyMs: res.latencyMs,
        },
      }));
      await recordTelemetry(
        {
          task: 'TRIAGE',
          requestedMode: airGapMode ? 'only_on_device' : 'prefer_on_device',
          actualSource: res.source,
          modelLabel: res.modelLabel,
          latencyMs: res.latencyMs,
          piiItemsShielded: redaction.activeCount,
          piiBytesKeptLocal: redaction.shieldedBytes,
          cloudPayloadBytes:
            res.source === 'IN_CLOUD'
              ? new TextEncoder().encode(redaction.redactedText).length
              : 0,
          offline: airGapMode || !capabilities.online,
        },
        redaction.redactedText
      );
    } catch (err) {
      reportAiFailure(err, 'Hybrid triage failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunDeepAudit = async () => {
    setAiError(null);
    setShieldNotice(null);
    setBusyAction('audit');
    const controller = new AbortController();
    activeAbortRef.current = controller;
    try {
      const redaction = applyRedaction(activeVault.rawText, activeVault.entities);
      if (remotePolicy.strictPiiShield && !redaction.zeroLeakVerified) {
        setAiError(
          'Strict PII Shield blocked cloud escalation because an active entity remained unredacted.'
        );
        return;
      }

      const report = await runHybridDeepAudit({
        rawText: activeVault.rawText,
        redactedText: redaction.redactedText,
        category: activeVault.category,
        mode: remotePolicy.deepAuditMode,
        cloudModelName: remotePolicy.cloudModelName,
        piiBytesProtected: redaction.shieldedBytes,
        forceOffline: airGapMode || !capabilities.online,
        signal: controller.signal,
      });

      updateActiveVault((v) => ({ ...v, auditReport: report }));
      await recordTelemetry(
        {
          task: 'DEEP_AUDIT',
          requestedMode: airGapMode ? 'only_on_device' : remotePolicy.deepAuditMode,
          actualSource: report.inferenceSource,
          modelLabel: report.modelLabel,
          latencyMs: report.latencyMs,
          piiItemsShielded: redaction.activeCount,
          piiBytesKeptLocal: redaction.shieldedBytes,
          cloudPayloadBytes:
            report.inferenceSource === 'IN_CLOUD'
              ? new TextEncoder().encode(redaction.redactedText).length
              : 0,
          offline: airGapMode || !capabilities.online,
        },
        redaction.redactedText
      );
    } catch (err) {
      reportAiFailure(err, 'Hybrid audit failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendChat = async (question: string, mode: HybridInferenceMode) => {
    setAiError(null);
    setShieldNotice(null);
    setChatStreaming(true);

    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };
    const streamMsgId = `msg-a-${Date.now() + 1}`;
    const placeholderAssistant: ChatMessage = {
      id: streamMsgId,
      role: 'assistant',
      content: '',
      rawTokenizedContent: '',
      timestamp: Date.now(),
      streaming: true,
    };

    const priorHistory = [...activeVault.chatHistory, userMsg];
    updateActiveVault((v) => ({
      ...v,
      chatHistory: [...priorHistory, placeholderAssistant],
    }));

    try {
      const redaction = applyRedaction(activeVault.rawText, activeVault.entities);
      const qRedaction = applyRedaction(question, activeVault.entities);

      const res = await streamHybridChatTurn({
        redactedText: redaction.redactedText,
        history: priorHistory,
        question: qRedaction.redactedText,
        mode,
        cloudModelName: remotePolicy.cloudModelName,
        forceOffline: airGapMode || !capabilities.online,
        onChunk: (accumulated) => {
          setVaults((prev) =>
            prev.map((v) =>
              v.id !== activeVault.id
                ? v
                : {
                    ...v,
                    chatHistory: v.chatHistory.map((m) =>
                      m.id === streamMsgId
                        ? { ...m, content: accumulated, rawTokenizedContent: accumulated }
                        : m
                    ),
                  }
            )
          );
        },
      });

      updateActiveVault((v) => ({
        ...v,
        chatHistory: v.chatHistory.map((m) =>
          m.id === streamMsgId
            ? {
                ...m,
                content: res.tokenizedAnswer,
                rawTokenizedContent: res.tokenizedAnswer,
                inferenceSource: res.source,
                latencyMs: res.latencyMs,
                ttftMs: res.ttftMs,
                requestedMode: mode,
                streaming: false,
              }
            : m
        ),
      }));

      await recordTelemetry(
        {
          task: 'HYBRID_CHAT',
          requestedMode: mode,
          actualSource: res.source,
          modelLabel: res.modelLabel,
          latencyMs: res.latencyMs,
          ttftMs: res.ttftMs,
          piiItemsShielded: redaction.activeCount,
          piiBytesKeptLocal: redaction.shieldedBytes,
          cloudPayloadBytes:
            res.source === 'IN_CLOUD'
              ? new TextEncoder().encode(redaction.redactedText).length
              : 0,
          offline: airGapMode || !capabilities.online,
        },
        redaction.redactedText
      );
    } catch (err) {
      // Remove empty streaming placeholder on error
      updateActiveVault((v) => ({
        ...v,
        chatHistory: v.chatHistory.filter((m) => m.id !== streamMsgId),
      }));
      reportAiFailure(err, 'Hybrid chat request failed.');
    } finally {
      setChatStreaming(false);
    }
  };

  const handleSyncFirestore = async () => {
    setAiError(null);
    setLastSyncMessage(null);
    setBusyAction('sync');
    try {
      let uid = capabilities.authUserUid;
      if (!uid) {
        const user = await signInGuest();
        uid = user?.uid ?? null;
      }
      if (!uid) {
        setAiError('Sign in via "Firebase Setup" to sync redacted vaults to Cloud Firestore.');
        return;
      }
      const res = await syncSanitizedVaultToFirestore(uid, activeVault);
      if (res.synced) {
        setLastSyncMessage(`Synced (${res.bytesProtected} B PII kept local)`);
      } else {
        setAiError(res.error || 'Firestore sync failed.');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Firestore sync failed.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F3F4F7] pb-[calc(64px+env(safe-area-inset-bottom))] text-[#0E1015] lg:h-screen lg:overflow-hidden lg:pb-0">
      <HeaderBar
        activeVault={activeVault}
        onUpdateTitle={(title) => updateActiveVault((v) => ({ ...v, title }))}
        capabilities={capabilities}
        remotePolicy={remotePolicy}
        airGapMode={airGapMode}
        onToggleAirGap={() => {
          setAirGapMode((v) => !v);
          setShieldNotice(null);
        }}
        onDownloadNano={handleDownloadNano}
        nanoDownloadStalled={nanoDownloadStalled}
        onDismissNanoInstall={() => setNanoDownloadStalled(true)}
        onOpenFirebaseModal={() => setFirebaseModalOpen(true)}
        onOpenAuthModal={openAuthModal}
        onExportRedactedTxt={() => exportRedactedDocument(activeVault)}
        onExportRedactedPdf={() => void exportRedactedPdf(activeVault)}
        onExportRedactedDocx={() => exportRedactedDocx(activeVault)}
        onExportRedactedHtml={() => exportRedactedHtml(activeVault)}
        onExportAuditPdf={() => exportAuditPdf(activeVault, true)}
        onExportAuditDocx={() => exportAuditDocx(activeVault, true)}
        onExportAuditMd={() => exportAuditMarkdown(activeVault, true)}
        onExportEntitiesCsv={() => exportEntitiesCsv(activeVault)}
        onExportCertificate={() => void exportZeroLeakCertificate(activeVault)}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className={`${mobilePane === 'files' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col lg:contents`}>
        <VaultSidebar
          vaults={vaults}
          activeVaultId={activeVault.id}
          onSelectVault={(id) => {
            setActiveVaultId(id);
            setHighlightedQuote(null);
            setLastSyncMessage(null);
            setAiError(null);
            setMobilePane('doc');
          }}
          onDeleteVault={handleDeleteVault}
          onLoadSample={(id) => {
            handleLoadSample(id);
            setMobilePane('doc');
          }}
          onUploadFile={handleUploadFile}
          onCreateBlankVault={handleCreateBlankVault}
          uploadingFile={uploadingFile}
        />
        </div>

        <div className={`${mobilePane === 'doc' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col lg:contents`}>
        <DocumentPaper
          vault={activeVault}
          highlightedQuote={highlightedQuote}
          onClearHighlight={() => setHighlightedQuote(null)}
          onUpdateRawText={handleUpdateRawText}
          onToggleEntity={handleToggleEntity}
          onRedactSelection={handleAddCustomEntity}
          onSyncFirestore={handleSyncFirestore}
          firestoreConfigured={capabilities.firebaseConfigured}
          syncBusy={busyAction === 'sync'}
          lastSyncMessage={lastSyncMessage}
        />
        </div>

        <div className={`${mobilePane === 'insights' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col lg:contents`}>
        <InspectorPane
          vault={activeVault}
          capabilities={capabilities}
          defaultQaMode={remotePolicy.defaultQaMode}
          airGapMode={airGapMode || !capabilities.online}
          telemetry={telemetry}
          busyAction={busyAction}
          chatStreaming={chatStreaming}
          aiError={aiError}
          onDismissError={() => setAiError(null)}
          shieldNotice={shieldNotice}
          onDismissShield={() => setShieldNotice(null)}
          onDisableAirGap={() => {
            setAirGapMode(false);
            setShieldNotice(null);
          }}
          onRunNanoPiiScan={handleRunNanoPiiScan}
          onRunTriage={handleRunTriage}
          onRunDeepAudit={handleRunDeepAudit}
          onCancelBusy={handleCancelBusy}
          onSendChat={handleSendChat}
          onToggleEntity={handleToggleEntity}
          onAddCustomEntity={handleAddCustomEntity}
          onSelectClauseQuote={(q) => {
            setHighlightedQuote(q);
            setMobilePane('doc');
          }}
          onDownloadNano={handleDownloadNano}
          onOpenFirebaseModal={() => setFirebaseModalOpen(true)}
          onExportCertificate={() => void exportZeroLeakCertificate(activeVault)}
        />
        </div>
      </div>

      <MobileTabBar
        active={mobilePane}
        onChange={setMobilePane}
        riskScore={activeVault.auditReport?.riskScore ?? null}
        busy={busyAction === 'audit' || chatStreaming}
        alert={Boolean(aiError || shieldNotice)}
      />

      <FirebaseConfigModal
        open={firebaseModalOpen}
        onClose={() => setFirebaseModalOpen(false)}
        capabilities={capabilities}
        remotePolicy={remotePolicy}
        projectId={bundle.projectId}
        authDomain={bundle.authDomain}
        onOpenAuthModal={openAuthModal}
        onRecheckNano={handleRecheckNano}
      />

      <AuthModal
        open={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          if (!user) return;
          setCapabilities((c) => ({
            ...c,
            authUserUid: user.uid,
            authIsAnonymous: user.isAnonymous,
            authEmail: user.email ?? null,
            authDisplayName: user.displayName ?? null,
            authPhotoUrl: user.photoURL ?? null,
            authProvider: getAuthProviderKind(user),
          }));
        }}
        capabilities={capabilities}
        authDomain={bundle.authDomain}
      />
    </div>
  );
}
