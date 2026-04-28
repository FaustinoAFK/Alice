import { VM_PROVIDERS, normalizeText } from './contracts';

export const VM_CAPABILITY_KEYS = [
  'can_detect',
  'can_start',
  'can_stop',
  'can_suspend',
  'can_snapshot',
  'can_restore_snapshot',
  'can_copy_files_to_guest',
  'can_execute_command_in_guest',
  'can_collect_artifacts',
  'can_report_health',
  'can_report_resource_usage',
];

export const VM_PROVIDER_STATUSES = {
  NOT_DETECTED: 'not_detected',
  DETECTED: 'detected',
  NOT_CONFIGURED: 'not_configured',
  CONFIGURED_NOT_READY: 'configured_not_ready',
  READY: 'ready',
  RUNNING: 'running',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
};

const createCapabilities = (overrides = {}) =>
  Object.fromEntries(VM_CAPABILITY_KEYS.map((key) => [key, Boolean(overrides[key])]));

export const LOCAL_VM_PROVIDER_TEMPLATES = {
  [VM_PROVIDERS.HYPER_V]: {
    provider: VM_PROVIDERS.HYPER_V,
    label: 'Hyper-V',
    capabilities: createCapabilities({
      can_detect: true,
      can_start: true,
      can_stop: true,
      can_suspend: true,
      can_snapshot: true,
      can_restore_snapshot: true,
      can_copy_files_to_guest: true,
      can_execute_command_in_guest: true,
      can_collect_artifacts: true,
      can_report_health: true,
      can_report_resource_usage: true,
    }),
  },
  [VM_PROVIDERS.VIRTUALBOX]: {
    provider: VM_PROVIDERS.VIRTUALBOX,
    label: 'VirtualBox',
    capabilities: createCapabilities({
      can_detect: true,
      can_start: true,
      can_stop: true,
      can_suspend: true,
      can_snapshot: true,
      can_restore_snapshot: true,
      can_copy_files_to_guest: true,
      can_execute_command_in_guest: true,
      can_collect_artifacts: true,
      can_report_health: true,
      can_report_resource_usage: true,
    }),
  },
  local_workspace: {
    provider: 'local_workspace',
    label: 'Workspace local fallback',
    capabilities: createCapabilities({
      can_detect: true,
      can_execute_command_in_guest: false,
      can_collect_artifacts: true,
      can_report_health: true,
      can_report_resource_usage: false,
    }),
  },
};

export const normalizeProviderCapabilities = (rawProvider = {}) => {
  const provider = normalizeText(rawProvider.name || rawProvider.provider) || 'unknown';
  const template = LOCAL_VM_PROVIDER_TEMPLATES[provider] || {
    provider,
    label: provider,
    capabilities: createCapabilities(),
  };
  const capabilities = createCapabilities({
    ...template.capabilities,
    ...(rawProvider.capabilities || {}),
  });

  return {
    provider,
    label: normalizeText(rawProvider.label) || template.label,
    available: Boolean(rawProvider.available),
    configured: Boolean(rawProvider.configured),
    ready: Boolean(rawProvider.ready),
    status: normalizeText(rawProvider.status) || (
      rawProvider.ready
        ? VM_PROVIDER_STATUSES.READY
        : rawProvider.configured
          ? VM_PROVIDER_STATUSES.CONFIGURED_NOT_READY
          : rawProvider.available
            ? VM_PROVIDER_STATUSES.NOT_CONFIGURED
            : VM_PROVIDER_STATUSES.NOT_DETECTED
    ),
    requiresUserSetup: Boolean(rawProvider.requiresUserSetup),
    setupReason: normalizeText(rawProvider.setupReason),
    missingRequirements: Array.isArray(rawProvider.missingRequirements)
      ? rawProvider.missingRequirements.map((item) => normalizeText(item)).filter(Boolean)
      : [],
    recommendedFix: normalizeText(rawProvider.recommendedFix),
    safeToRunGuestTasks: Boolean(rawProvider.safeToRunGuestTasks),
    machineName: normalizeText(rawProvider.machineName),
    capabilities,
  };
};

export const providerCanExecuteGuestCommand = (provider) =>
  Boolean(provider?.available && provider?.configured && provider?.ready && provider?.capabilities?.can_execute_command_in_guest);
