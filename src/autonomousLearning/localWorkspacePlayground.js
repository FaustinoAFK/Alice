import {
  AUTONOMOUS_LIMITS,
  ENVIRONMENT_TYPES,
  PLAYGROUND_EXECUTION_MODES,
  VM_RESOURCE_MODES,
  normalizeText,
} from './contracts';

const DEFAULT_RESOURCE_POLICY = {
  maxCpuPercent: 50,
  maxRamMb: 2048,
  maxDiskMb: 4096,
};

const sanitizePathSegment = (value) =>
  normalizeText(value)
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'item';

const basename = (value) => {
  const parts = String(value || '').split(/[\\/]/).filter(Boolean);
  return parts.at(-1) || 'file';
};

const isSafeRelativeTargetPath = (value) => {
  const text = normalizeText(value);
  if (!text) {
    return true;
  }
  if (/^[a-z]:/i.test(text) || text.startsWith('/') || text.startsWith('\\')) {
    return false;
  }
  return !text.split(/[\\/]/).some((segment) => segment === '..');
};

export const evaluateLocalWorkspaceResourcePolicy = ({
  requestedResources = {},
  hostResources = {},
  resourcePolicy = DEFAULT_RESOURCE_POLICY,
} = {}) => {
  const requested = {
    cpuPercent: Number(requestedResources.cpuPercent || 0),
    ramMb: Number(requestedResources.ramMb || 0),
    diskMb: Number(requestedResources.diskMb || 0),
  };
  const host = {
    cpuPercent: Number(hostResources.cpuPercent || 100),
    ramMb: Number(hostResources.ramMb || resourcePolicy.maxRamMb),
    diskMb: Number(hostResources.diskMb || resourcePolicy.maxDiskMb),
  };
  const caps = {
    cpuPercent: Math.min(resourcePolicy.maxCpuPercent, host.cpuPercent),
    ramMb: Math.min(resourcePolicy.maxRamMb, host.ramMb),
    diskMb: Math.min(resourcePolicy.maxDiskMb, host.diskMb),
  };
  const violations = [];

  if (requested.cpuPercent > caps.cpuPercent) {
    violations.push('cpu_limit_exceeded');
  }
  if (requested.ramMb > caps.ramMb) {
    violations.push('ram_limit_exceeded');
  }
  if (requested.diskMb > caps.diskMb) {
    violations.push('disk_limit_exceeded');
  }

  return {
    allowed: violations.length === 0,
    requested,
    caps,
    violations,
    resourceMode:
      requested.cpuPercent > 35 || requested.ramMb > 1024 || requested.diskMb > 2048
        ? VM_RESOURCE_MODES.ACTIVE
        : requested.cpuPercent > 0 || requested.ramMb > 0 || requested.diskMb > 0
          ? VM_RESOURCE_MODES.LEARNING_LIGHT
          : VM_RESOURCE_MODES.IDLE,
  };
};

export const createLocalWorkspacePlan = ({
  taskId,
  sourceFiles = [],
  workspaceRoot = 'alice-local-workspace',
  requestedResources = { cpuPercent: 20, ramMb: 512, diskMb: 256 },
  hostResources = {},
  resourcePolicy = DEFAULT_RESOURCE_POLICY,
} = {}) => {
  const normalizedTaskId = sanitizePathSegment(taskId || `task-${Date.now()}`);
  const directAccessFiles = sourceFiles.filter((file) => file?.directAccess);
  const resourceDecision = evaluateLocalWorkspaceResourcePolicy({
    requestedResources,
    hostResources,
    resourcePolicy,
  });

  if (directAccessFiles.length > 0) {
    return {
      ok: false,
      message: 'O fallback de workspace local deve receber copias, nunca arquivos reais diretamente.',
      environment: ENVIRONMENT_TYPES.LOCAL_WORKSPACE_FALLBACK,
      executionMode: PLAYGROUND_EXECUTION_MODES.LOCAL_WORKSPACE_FALLBACK,
      resourceDecision,
      copyManifest: [],
      violations: ['direct_real_file_access'],
      isRealVm: false,
    };
  }

  if (!resourceDecision.allowed) {
    return {
      ok: false,
      message: 'Recursos solicitados excedem limites conservadores do workspace local.',
      environment: ENVIRONMENT_TYPES.LOCAL_WORKSPACE_FALLBACK,
      executionMode: PLAYGROUND_EXECUTION_MODES.LOCAL_WORKSPACE_FALLBACK,
      resourceDecision,
      copyManifest: [],
      violations: resourceDecision.violations,
      isRealVm: false,
    };
  }

  if (sourceFiles.some((file) => !isSafeRelativeTargetPath(file.targetPath))) {
    return {
      ok: false,
      message: 'Caminho de destino inseguro para workspace local.',
      environment: ENVIRONMENT_TYPES.LOCAL_WORKSPACE_FALLBACK,
      executionMode: PLAYGROUND_EXECUTION_MODES.LOCAL_WORKSPACE_FALLBACK,
      resourceDecision,
      copyManifest: [],
      violations: ['unsafe_target_path'],
      isRealVm: false,
    };
  }

  const workspacePath = `${workspaceRoot}/${normalizedTaskId}`;
  const copyManifest = sourceFiles.map((file, index) => {
    const sourcePath = normalizeText(file.path || file.sourcePath);
    const targetPath = normalizeText(file.targetPath);
    const targetName = targetPath || `${String(index + 1).padStart(3, '0')}-${sanitizePathSegment(basename(sourcePath))}`;
    const workspacePathForFile = `${workspacePath}/input/${targetName}`;

    return {
      sourcePath,
      workspacePath: workspacePathForFile,
      mode: file.content ? 'inline_copy' : 'copy',
      contentHash: normalizeText(file.contentHash),
      sizeBytes: Number(file.sizeBytes || String(file.content || '').length || 0),
    };
  });

  return {
    ok: true,
    message: 'Workspace local fallback preparado com manifesto de copias. Isto nao e uma VM real.',
    environment: ENVIRONMENT_TYPES.LOCAL_WORKSPACE_FALLBACK,
    executionMode: PLAYGROUND_EXECUTION_MODES.LOCAL_WORKSPACE_FALLBACK,
    provider: 'local_workspace',
    workspacePath,
    copyManifest,
    directRealFileAccess: false,
    resourceDecision,
    limits: AUTONOMOUS_LIMITS,
    isRealVm: false,
  };
};

export const buildWorkspaceSessionState = ({ workspacePlan, now = Date.now() } = {}) => ({
  provider: 'local_workspace',
  providerStatus: 'fallback',
  sessionId: workspacePlan?.workspacePath || `local-workspace-${now}`,
  status: workspacePlan?.ok ? 'active' : 'blocked',
  resourceMode: workspacePlan?.resourceDecision?.resourceMode || VM_RESOURCE_MODES.IDLE,
  activeTasks: [],
  workspacePath: workspacePlan?.workspacePath || '',
  lastHealthCheck: now,
  lastResetReason: '',
  copyManifest: workspacePlan?.copyManifest || [],
  isRealVm: false,
  executionMode: PLAYGROUND_EXECUTION_MODES.LOCAL_WORKSPACE_FALLBACK,
});
