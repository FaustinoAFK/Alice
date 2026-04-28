import {
  PLAYGROUND_EXECUTION_MODES,
  VM_PROVIDERS,
  VM_RESOURCE_MODES,
  normalizeText,
} from './contracts';
import {
  normalizeProviderCapabilities,
  providerCanExecuteGuestCommand,
} from './localVmProviders';

export const createEmptyVmStatus = () => ({
  checkedAt: 0,
  provider: VM_PROVIDERS.NONE,
  providerStatus: 'not_configured',
  realVmAvailable: false,
  fallbackWorkspaceAvailable: true,
  executionMode: PLAYGROUND_EXECUTION_MODES.LOCAL_WORKSPACE_FALLBACK,
  status: 'idle',
  resourceMode: VM_RESOURCE_MODES.IDLE,
  machineId: '',
  machineName: '',
  workspaceRoot: '',
  providers: [],
  activeProviderCapabilities: {},
  diagnostics: null,
  smokeTest: null,
  guestCommandReady: false,
  requiresUserSetup: true,
  setupReason: 'local_vm_provider_not_configured',
  hostResources: {
    cpuPercent: 0,
    ramAvailableMb: 0,
    diskAvailableMb: 0,
  },
  message: 'Nenhuma VM local real configurada. Workspace local fallback disponivel para tarefas permitidas.',
});

export const normalizeVmStatus = (rawStatus = {}, { now = Date.now() } = {}) => {
  const providers = Array.isArray(rawStatus.providers)
    ? rawStatus.providers.map(normalizeProviderCapabilities)
    : [];
  const configuredProvider = providers.find((provider) => provider.configured && provider.available);
  const readyProvider = providers.find(providerCanExecuteGuestCommand);
  const providerName = normalizeText(rawStatus.provider || configuredProvider?.provider);
  const realVmAvailable = Boolean(rawStatus.realVmAvailable || configuredProvider);
  const guestCommandReady = Boolean(rawStatus.guestCommandReady || readyProvider);

  return {
    ...createEmptyVmStatus(),
    checkedAt: Number(rawStatus.checkedAt || now),
    provider: providerName || VM_PROVIDERS.NONE,
    providerStatus: normalizeText(rawStatus.providerStatus) || (realVmAvailable ? 'available' : 'not_configured'),
    realVmAvailable,
    fallbackWorkspaceAvailable: rawStatus.fallbackWorkspaceAvailable !== false,
    executionMode: realVmAvailable
      ? PLAYGROUND_EXECUTION_MODES.REAL_VM
      : PLAYGROUND_EXECUTION_MODES.LOCAL_WORKSPACE_FALLBACK,
    status: realVmAvailable ? normalizeText(rawStatus.status) || 'idle' : 'fallback_only',
    resourceMode: normalizeText(rawStatus.resourceMode) || VM_RESOURCE_MODES.IDLE,
    machineId: normalizeText(rawStatus.machineId || configuredProvider?.machineId),
    machineName: normalizeText(rawStatus.machineName || configuredProvider?.machineName),
    workspaceRoot: normalizeText(rawStatus.workspaceRoot),
    providers,
    activeProviderCapabilities: configuredProvider?.capabilities || rawStatus.capabilities || {},
    diagnostics: rawStatus.diagnostics || rawStatus.diagnostic || null,
    smokeTest: rawStatus.smokeTest || null,
    guestCommandReady,
    requiresUserSetup: rawStatus.requiresUserSetup ?? !guestCommandReady,
    setupReason:
      normalizeText(rawStatus.setupReason || configuredProvider?.setupReason) ||
      (guestCommandReady ? '' : 'guest_command_requires_provider_credentials_or_opt_in'),
    hostResources: {
      ...createEmptyVmStatus().hostResources,
      ...(rawStatus.hostResources || {}),
    },
    message:
      normalizeText(rawStatus.message) ||
      (realVmAvailable
        ? 'VM local real configurada.'
        : 'Nenhuma VM local real configurada. Workspace local fallback disponivel para tarefas permitidas.'),
  };
};

export const buildRealVmSessionState = ({ vmStatus, taskId = '', workspacePath = '', now = Date.now() } = {}) => {
  const normalizedStatus = normalizeVmStatus(vmStatus, { now });

  return {
    provider: normalizedStatus.provider,
    providerStatus: normalizedStatus.providerStatus,
    sessionId: normalizedStatus.machineId || normalizedStatus.machineName || `local-vm-${now}`,
    status: normalizedStatus.realVmAvailable ? 'active' : 'unavailable',
    resourceMode: normalizedStatus.resourceMode,
    activeTasks: taskId ? [taskId] : [],
    workspacePath: workspacePath || normalizedStatus.workspaceRoot,
    lastHealthCheck: normalizedStatus.checkedAt || now,
    lastResetReason: '',
    copyManifest: [],
    isRealVm: normalizedStatus.realVmAvailable,
    executionMode: normalizedStatus.executionMode,
    machineName: normalizedStatus.machineName,
    capabilities: normalizedStatus.activeProviderCapabilities,
    guestCommandReady: normalizedStatus.guestCommandReady,
    requiresUserSetup: normalizedStatus.requiresUserSetup,
    setupReason: normalizedStatus.setupReason,
    hostResources: normalizedStatus.hostResources,
    message: normalizedStatus.message,
  };
};

export const selectPlaygroundExecution = ({
  policyDecision,
  vmStatus = createEmptyVmStatus(),
  allowWorkspaceFallback = true,
} = {}) => {
  const normalizedStatus = normalizeVmStatus(vmStatus);

  if (!policyDecision?.allowed) {
    return {
      mode: PLAYGROUND_EXECUTION_MODES.UNAVAILABLE,
      provider: normalizedStatus.provider,
      allowed: false,
      isRealVm: false,
      reason: policyDecision?.reason || 'policy_denied',
    };
  }

  if (normalizedStatus.realVmAvailable) {
    return {
      mode: PLAYGROUND_EXECUTION_MODES.REAL_VM,
      provider: normalizedStatus.provider,
      allowed: true,
      isRealVm: true,
      canExecuteGuestCommand: normalizedStatus.guestCommandReady,
      reason: normalizedStatus.guestCommandReady
        ? 'real_local_vm_guest_command_ready'
        : 'real_local_vm_available_but_guest_command_not_ready',
      setupReason: normalizedStatus.setupReason,
    };
  }

  if (allowWorkspaceFallback && normalizedStatus.fallbackWorkspaceAvailable) {
    return {
      mode: PLAYGROUND_EXECUTION_MODES.LOCAL_WORKSPACE_FALLBACK,
      provider: 'local_workspace',
      allowed: true,
      isRealVm: false,
      reason: 'using_explicit_local_workspace_fallback',
    };
  }

  return {
    mode: PLAYGROUND_EXECUTION_MODES.UNAVAILABLE,
    provider: normalizedStatus.provider,
    allowed: false,
    isRealVm: false,
    reason: 'real_local_vm_unavailable',
  };
};
