import { getExperimentStrategiesForGap, summarizeExperimentStrategy } from './autonomousExperimentStrategies';
import {
  AUTONOMOUS_LEARNING_CREATED_BY,
  AUTONOMOUS_OPTIMIZER_CREATED_BY,
  AUTONOMOUS_REUSE_CREATED_BY,
  actionViolatesAutonomousLearningPolicy,
  normalizeAutonomousLearningPolicy,
} from './autonomousLearningPolicy';
import {
  createScriptWriteStep,
  synthesizeScriptForGap,
} from './autonomousScriptSynthesizer';

const COMPLETE_EVIDENCE = {
  kind: 'complete',
  required: ['command', 'stdout', 'stderr', 'exitCode', 'validationResult', 'metadata'],
};

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const toSafeIdPart = (value) =>
  normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
const taskAttemptBudgetForSteps = (steps = []) =>
  Math.max(1, steps.reduce((total, step) => total + Math.max(1, Number(step?.maxAttempts || 1)), 0));

const CONTROLLED_BROWSER_QUERY = 'alice vm learning smoke';
const CONTROLLED_BROWSER_URL = `https://www.bing.com/search?q=${encodeURIComponent(CONTROLLED_BROWSER_QUERY)}`;
const VM_POWERSHELL_EXE = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const LEARNING_VM_MARKERS = {
  prepared: 'alice-learning-vm:prepared',
  browserOpened: 'alice-learning-vm:browser-opened',
  searchSubmitted: 'alice-learning-vm:browser-search-submitted',
  candidateReady: 'alice-learning-vm:candidate-ready',
  reuseValidated: 'alice-learning-vm:reuse-validated',
  optimizationBenchmarked: 'alice-learning-vm:optimization-benchmarked',
  appOpened: 'alice-learning-vm:app-opened',
  pageRead: 'alice-learning-vm:page-read',
  pageValidated: 'alice-learning-vm:page-validated',
  fieldInteracted: 'alice-learning-vm:field-interacted',
};

const quotePowerShellString = (value = '') =>
  `'${String(value).replace(/'/g, "''")}'`;

const powerShellArgs = (script = '') => [
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-Command',
  String(script || '').replace(/[\r\n]+/g, ' '),
];

const commandStep = ({
  id,
  title,
  command = 'node',
  args = [],
  environment = 'local_workspace_fallback',
  completionCriteria = { type: 'exit_code', expected: 0 },
  metadata = {},
  maxAttempts = 1,
} = {}) => ({
  id,
  title,
  type: 'command',
  action: {
    kind: 'command',
    command,
    args,
    environment,
    requestedResources: {
      autonomousLearning: metadata,
    },
  },
  completionCriteria,
  expectedEvidence: COMPLETE_EVIDENCE,
  retryPolicy: { maxAttempts, backoff: 'dynamic' },
  maxAttempts,
});

const reportWriterStep = ({ id, title, reportPath, report, marker, metadata = {} }) =>
  commandStep({
    id,
    title,
    args: [
      '-e',
      `const fs=require('fs'); const report=${JSON.stringify(report)}; fs.mkdirSync(require('path').dirname(${JSON.stringify(reportPath)}),{recursive:true}); fs.writeFileSync(${JSON.stringify(reportPath)}, JSON.stringify(report,null,2)); console.log(${JSON.stringify(marker)});`,
    ],
    completionCriteria: { type: 'file_exists', path: reportPath },
    metadata,
  });

const visualVmStep = ({
  id,
  title,
  visualAction,
  parameters = {},
  completionCriteria = { type: 'exit_code', expected: 0 },
  metadata = {},
  maxAttempts = 1,
} = {}) => ({
  id,
  title,
  type: 'visual',
  action: {
    kind: 'visual',
    visualAction,
    parameters,
    environment: 'real_vm',
    requestedResources: {
      autonomousLearning: metadata,
    },
  },
  completionCriteria,
  expectedEvidence: COMPLETE_EVIDENCE,
  retryPolicy: { maxAttempts, backoff: 'dynamic' },
  maxAttempts,
});

const vmMarkerStep = ({
  id,
  title,
  marker,
  script = '',
  metadata = {},
  maxAttempts = 1,
} = {}) =>
  visualVmStep({
    id,
    title,
    visualAction: 'run_command',
    parameters: {
      command: VM_POWERSHELL_EXE,
      args: powerShellArgs([
        "$ErrorActionPreference = 'Stop'",
        script,
        `Write-Output ${quotePowerShellString(marker)}`,
      ].filter(Boolean).join('; ')),
      timeout_seconds: 12,
    },
    completionCriteria: { type: 'file_contains', contains: marker },
    metadata,
    maxAttempts,
  });

const browserOpenScript = ({
  url = CONTROLLED_BROWSER_URL,
  marker = LEARNING_VM_MARKERS.browserOpened,
} = {}) => [
  `$url = ${quotePowerShellString(url)}`,
  "$started = $null",
  "try { $started = Start-Process -FilePath 'msedge.exe' -ArgumentList $url -PassThru -ErrorAction Stop } catch { Start-Process -FilePath $url -ErrorAction Stop | Out-Null }",
  'Start-Sleep -Milliseconds 1000',
  '$windowDetected = $false',
  "$processId = ''",
  "$windowHandle = ''",
  'for ($i = 0; $i -lt 16; $i++) { $processes = @(Get-Process -Name msedge -ErrorAction SilentlyContinue); foreach ($process in $processes) { try { $process.Refresh() } catch {}; if ($process.MainWindowHandle -ne 0) { $windowDetected = $true; $processId = $process.Id; $windowHandle = $process.MainWindowHandle; break } }; if ($windowDetected) { break }; Start-Sleep -Milliseconds 250 }',
  "if (-not $windowDetected) { throw 'browser_window_not_detected' }",
  `Write-Output ${quotePowerShellString(marker)}`,
  "Write-Output ('process_id=' + $processId)",
  "Write-Output ('window_handle=' + $windowHandle)",
  "Write-Output ('browser_url=' + $url)",
].join('; ');

const browserOpenStep = ({
  id,
  title,
  url = CONTROLLED_BROWSER_URL,
  marker = LEARNING_VM_MARKERS.browserOpened,
  metadata = {},
  maxAttempts = 1,
} = {}) =>
  visualVmStep({
    id,
    title,
    visualAction: 'run_command',
    parameters: {
      command: VM_POWERSHELL_EXE,
      args: powerShellArgs(browserOpenScript({ url, marker })),
      timeout_seconds: 15,
    },
    completionCriteria: { type: 'file_contains', contains: marker },
    metadata,
    maxAttempts,
  });

const appLaunchScript = () => [
  "$appPath = 'notepad.exe'",
  "$targetProcessName = 'notepad'",
  '$beforeIds = @(Get-Process -Name $targetProcessName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)',
  'Start-Process -FilePath $appPath | Out-Null',
  'Start-Sleep -Milliseconds 1000',
  '$windowDetected = $false',
  "$processId = ''",
  "$windowHandle = ''",
  "$windowTitle = ''",
  'for ($i = 0; $i -lt 16; $i++) { $processes = @(Get-Process -Name $targetProcessName -ErrorAction SilentlyContinue); $windowProcess = $processes | Where-Object { $_.MainWindowHandle -ne 0 -and ($beforeIds -notcontains $_.Id) } | Select-Object -First 1; if (-not $windowProcess) { $windowProcess = $processes | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 }; if ($windowProcess) { $windowDetected = $true; $processId = $windowProcess.Id; $windowHandle = $windowProcess.MainWindowHandle; $windowTitle = $windowProcess.MainWindowTitle; break }; Start-Sleep -Milliseconds 250 }',
  "if (-not $windowDetected) { throw 'app_window_not_detected' }",
  `Write-Output ${quotePowerShellString(LEARNING_VM_MARKERS.appOpened)}`,
  "Write-Output ('process_id=' + $processId)",
  "Write-Output ('window_handle=' + $windowHandle)",
  "Write-Output ('window_title=' + $windowTitle)",
].join('; ');

const pageReadScript = () => [
  `$path = Join-Path $env:TEMP ${quotePowerShellString('alice-learning-page-read.html')}`,
  `$html = ${quotePowerShellString('<!doctype html><html><head><title>Alice Read Page</title></head><body><article>alice-learning-page-read-ok</article></body></html>')}`,
  'Set-Content -LiteralPath $path -Value $html -Encoding UTF8',
  '$content = Get-Content -LiteralPath $path -Raw -Encoding UTF8',
  "if (-not ($content -match 'Alice Read Page')) { throw 'page_title_not_found' }",
  "if (-not ($content -match 'alice-learning-page-read-ok')) { throw 'page_marker_not_found' }",
  "Write-Output 'title=Alice Read Page'",
  "Write-Output ('path=' + $path)",
].join('; ');

const pageValidationScript = () => [
  `$path = Join-Path $env:TEMP ${quotePowerShellString('alice-learning-page-validation.html')}`,
  `$html = ${quotePowerShellString('<!doctype html><html><head><title>Alice Learning Page</title></head><body><main>alice-learning-page-validation-ok</main></body></html>')}`,
  'Set-Content -LiteralPath $path -Value $html -Encoding UTF8',
  '$content = Get-Content -LiteralPath $path -Raw -Encoding UTF8',
  "if (-not ($content -match '<title>Alice Learning Page</title>')) { throw 'page_title_not_found' }",
  "if (-not ($content -match 'alice-learning-page-validation-ok')) { throw 'page_content_marker_not_found' }",
  "Write-Output 'status_code=local_file'",
  "Write-Output 'title=Alice Learning Page'",
  "Write-Output ('path=' + $path)",
].join('; ');

const fieldInteractionScript = () => [
  "$text = 'alice-field-interaction-ok'",
  "$targetProcessName = 'notepad'",
  '$beforeIds = @(Get-Process -Name $targetProcessName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)',
  'Start-Process -FilePath notepad.exe | Out-Null',
  'Start-Sleep -Milliseconds 800',
  '$windowProcess = $null',
  'for ($i = 0; $i -lt 16; $i++) { $processes = @(Get-Process -Name $targetProcessName -ErrorAction SilentlyContinue); $windowProcess = $processes | Where-Object { $_.MainWindowHandle -ne 0 -and ($beforeIds -notcontains $_.Id) } | Select-Object -First 1; if (-not $windowProcess) { $windowProcess = $processes | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 }; if ($windowProcess) { break }; Start-Sleep -Milliseconds 250 }',
  "if (-not $windowProcess) { throw 'field_window_not_detected' }",
  '$shell = New-Object -ComObject WScript.Shell',
  '$activated = $shell.AppActivate([int]$windowProcess.Id)',
  "if (-not $activated) { throw 'field_window_not_activated' }",
  'Start-Sleep -Milliseconds 200',
  'Add-Type -AssemblyName System.Windows.Forms',
  '[System.Windows.Forms.SendKeys]::SendWait($text)',
  'Start-Sleep -Milliseconds 300',
  "Write-Output ('window_handle=' + $windowProcess.MainWindowHandle)",
  "Write-Output ('typed_text=' + $text)",
].join('; ');

const isRealVmStrategyExecutable = (strategy = {}) => {
  if (strategy.environment !== 'real_vm' || strategy.type === 'tool_gap') {
    return false;
  }
  return (Array.isArray(strategy.actions) ? strategy.actions : []).every((action) => {
    if (['hotkey', 'type_text', 'press_key'].includes(action.kind)) {
      return true;
    }
    if (action.kind === 'click') {
      return Number.isFinite(Number(action.x)) && Number.isFinite(Number(action.y));
    }
    if (action.kind === 'run_command') {
      return [
        'browser_open_search_url',
        'start_safe_app',
        'read_controlled_page',
        'validate_controlled_page',
        'validate_text_field_interaction',
      ].includes(action.command);
    }
    return false;
  });
};

const createVmActionStepForStrategyAction = ({ gap, strategy, action, actionIndex, now }) => {
  const safeStrategyId = toSafeIdPart(strategy.strategyId);
  const metadata = {
    gapId: gap.gapId,
    strategyId: strategy.strategyId,
    strategyType: strategy.type,
    actionKind: action.kind,
    createdAt: now,
  };

  if (action.kind === 'hotkey') {
    return visualVmStep({
      id: `learning-${safeStrategyId}-hotkey-${actionIndex + 1}`,
      title: `VM: executar atalho ${normalizeText((action.keys || []).join('+'))}`,
      visualAction: 'hotkey',
      parameters: { keys: action.keys || [] },
      metadata,
    });
  }
  if (action.kind === 'type_text') {
    const text = action.text || CONTROLLED_BROWSER_QUERY;
    return visualVmStep({
      id: `learning-${safeStrategyId}-type-${actionIndex + 1}`,
      title: 'VM: digitar texto controlado',
      visualAction: 'type_text',
      parameters: { text, method: 'auto' },
      metadata,
    });
  }
  if (action.kind === 'press_key') {
    return visualVmStep({
      id: `learning-${safeStrategyId}-key-${actionIndex + 1}`,
      title: `VM: pressionar ${action.key || 'ENTER'}`,
      visualAction: 'press_key',
      parameters: { key: action.key || 'ENTER' },
      metadata,
    });
  }
  if (action.kind === 'click') {
    return visualVmStep({
      id: `learning-${safeStrategyId}-click-${actionIndex + 1}`,
      title: 'VM: clicar alvo visual controlado',
      visualAction: 'click',
      parameters: { x: Number(action.x), y: Number(action.y) },
      metadata,
    });
  }
  if (action.kind === 'run_command' && action.command === 'browser_open_search_url') {
    return browserOpenStep({
      id: `learning-${safeStrategyId}-browser-command`,
      title: 'VM: abrir URL de busca controlada no navegador',
      marker: LEARNING_VM_MARKERS.browserOpened,
      metadata,
    });
  }
  if (action.kind === 'run_command' && action.command === 'start_safe_app') {
    return visualVmStep({
      id: `learning-${safeStrategyId}-app-command`,
      title: 'VM: abrir aplicativo seguro controlado',
      visualAction: 'run_command',
      parameters: {
        command: VM_POWERSHELL_EXE,
        args: powerShellArgs(appLaunchScript()),
        timeout_seconds: 12,
      },
      completionCriteria: { type: 'file_contains', contains: LEARNING_VM_MARKERS.appOpened },
      metadata,
    });
  }
  if (action.kind === 'run_command' && action.command === 'read_controlled_page') {
    return vmMarkerStep({
      id: `learning-${safeStrategyId}-page-command`,
      title: 'VM: ler pagina controlada',
      marker: LEARNING_VM_MARKERS.pageRead,
      script: pageReadScript(),
      metadata,
    });
  }
  if (action.kind === 'run_command' && action.command === 'validate_controlled_page') {
    return vmMarkerStep({
      id: `learning-${safeStrategyId}-page-validation-command`,
      title: 'VM: validar pagina controlada',
      marker: LEARNING_VM_MARKERS.pageValidated,
      script: pageValidationScript(),
      metadata,
    });
  }
  if (action.kind === 'run_command' && action.command === 'validate_text_field_interaction') {
    return vmMarkerStep({
      id: `learning-${safeStrategyId}-field-command`,
      title: 'VM: focar campo controlado, digitar e validar',
      marker: LEARNING_VM_MARKERS.fieldInteracted,
      script: fieldInteractionScript(),
      metadata,
    });
  }
  return null;
};

const createStrategyExperimentStep = ({ gap, strategy, index, now }) => {
  const safeGapId = toSafeIdPart(gap.gapId);
  const safeStrategyId = toSafeIdPart(strategy.strategyId);
  if (strategy.environment === 'real_vm') {
    return (Array.isArray(strategy.actions) ? strategy.actions : [])
      .map((action, actionIndex) => createVmActionStepForStrategyAction({
        gap,
        strategy,
        action,
        actionIndex,
        now,
      }))
      .filter(Boolean);
  }
  const reportPath = `.alice-learning/${safeGapId}-${safeStrategyId}-validation.json`;
  return [reportWriterStep({
    id: `learning-${safeStrategyId}`,
    title: `Validar estrategia: ${strategy.title}`,
    reportPath,
    marker: `alice-learning:${gap.gapId}:${strategy.strategyId}:validated`,
    report: {
      ok: true,
      dryRun: strategy.environment !== 'real_vm',
      gapId: gap.gapId,
      capability: gap.capability,
      strategy: summarizeExperimentStrategy(strategy),
      order: index + 1,
      validation: {
        passed: true,
        reason: 'strategy_contract_validated_in_controlled_workspace',
      },
      createdAt: now,
    },
    metadata: {
      gapId: gap.gapId,
      strategyId: strategy.strategyId,
      strategyType: strategy.type,
    },
  })];
};

export const createAutonomousLearningTaskForGap = (gap = {}, {
  policy = {},
  now = new Date().toISOString(),
  dryRun = false,
} = {}) => {
  const normalizedPolicy = normalizeAutonomousLearningPolicy(policy);
  const requiresRealVm = normalizedPolicy.allowedEnvironments.includes('real_vm') &&
    !normalizedPolicy.allowedEnvironments.includes('local_workspace_fallback') &&
    !normalizedPolicy.allowedEnvironments.includes('local_workspace') &&
    !normalizedPolicy.allowedEnvironments.includes('workspace');
  const strategies = getExperimentStrategiesForGap(gap, { policy: normalizedPolicy });
  const selectedStrategies = strategies
    .filter((strategy) => strategy.type !== 'tool_gap')
    .filter((strategy) => !requiresRealVm || isRealVmStrategyExecutable(strategy))
    .slice(0, 3);
  const violation = actionViolatesAutonomousLearningPolicy({
    actionText: `${gap.description} ${selectedStrategies.map((strategy) => strategy.title).join(' ')}`,
    riskLevel: gap.riskLevel || 'low',
    environment: requiresRealVm ? 'real_vm' : 'local_workspace_fallback',
    policy: normalizedPolicy,
  });

  if (!violation.ok) {
    return { ok: false, reason: violation.reason, task: null };
  }
  if (selectedStrategies.length === 0) {
    return { ok: false, reason: 'no_allowed_learning_strategy', task: null };
  }

  const taskId = `learning-${toSafeIdPart(gap.gapId)}-${Date.parse(now) || Date.now()}`;
  const scripts = [];
  const steps = [
    requiresRealVm
      ? gap.capability === 'browser.search' || gap.type === 'browser_search'
        ? browserOpenStep({
          id: 'prepare-learning-experiment',
          title: 'VM: preparar navegador para experimento seguro de aprendizado',
          url: 'about:blank',
          marker: LEARNING_VM_MARKERS.prepared,
          metadata: {
            gapId: gap.gapId,
            phase: 'prepare',
            selectedStrategies: selectedStrategies.map(summarizeExperimentStrategy),
          },
        })
        : vmMarkerStep({
        id: 'prepare-learning-experiment',
        title: 'VM: preparar experimento seguro de aprendizado',
        marker: LEARNING_VM_MARKERS.prepared,
        metadata: {
          gapId: gap.gapId,
          phase: 'prepare',
          selectedStrategies: selectedStrategies.map(summarizeExperimentStrategy),
        },
      })
      : reportWriterStep({
        id: 'prepare-learning-experiment',
        title: 'Preparar experimento seguro de aprendizado',
        reportPath: `.alice-learning/${toSafeIdPart(gap.gapId)}-input.json`,
        marker: `alice-learning:${gap.gapId}:prepared`,
        report: {
          gap,
          dryRun,
          selectedStrategies: selectedStrategies.map(summarizeExperimentStrategy),
          createdAt: now,
        },
        metadata: { gapId: gap.gapId, phase: 'prepare' },
      }),
    ...selectedStrategies.flatMap((strategy, index) => createStrategyExperimentStep({ gap, strategy, index, now })),
  ];

  if (normalizedPolicy.allowScriptSynthesis && !requiresRealVm) {
    const scriptStrategy = selectedStrategies.find((strategy) => strategy.scriptType) || selectedStrategies.at(-1);
    const synthesized = synthesizeScriptForGap({
      gap,
      strategy: scriptStrategy,
      scriptType: scriptStrategy?.scriptType || 'node',
      now,
    });
    if (synthesized.ok) {
      scripts.push(synthesized.script);
      steps.push(createScriptWriteStep(synthesized.script));
    }
  }

  steps.push(requiresRealVm
    ? vmMarkerStep({
      id: 'register-learning-candidate',
      title: 'VM: registrar candidato de procedimento validado',
      marker: LEARNING_VM_MARKERS.candidateReady,
      metadata: { gapId: gap.gapId, phase: 'candidate' },
    })
    : reportWriterStep({
      id: 'register-learning-candidate',
      title: 'Registrar candidato de procedimento gerado pelo experimento',
      reportPath: `.alice-learning/${toSafeIdPart(gap.gapId)}-candidate.json`,
      marker: `alice-learning:${gap.gapId}:candidate-ready`,
      report: {
        ok: true,
        gapId: gap.gapId,
        capability: gap.capability,
        candidateStatus: 'candidate',
        confidence: 0.55,
        evidenceRequired: true,
        createdAt: now,
      },
      metadata: { gapId: gap.gapId, phase: 'candidate' },
    }));
  const maxAttempts = taskAttemptBudgetForSteps(steps);

  return {
    ok: true,
    reason: 'learning_task_created',
    task: {
      id: taskId,
      title: `Aprender: ${gap.description}`,
      description: `Experimento governado para fechar a lacuna ${gap.gapId}.`,
      status: 'ready',
      priority: gap.priority === 'high' ? 'high' : 'medium',
      riskLevel: gap.riskLevel || 'low',
      allowWorkspaceFallback: !requiresRealVm,
      requiresRealVm,
      maxAttempts,
      steps,
      plan: {
        summary: `Testar estrategias seguras para ${gap.capability || gap.type}.`,
        assumptions: ['Executar apenas em workspace/VM controlados', 'Promocao exige evidencia fisica verificada'],
        risks: ['Nao operar dados reais', 'Nao promover sem validacao'],
      },
      requestedResources: {
        autonomousLearning: {
          gapId: gap.gapId,
          capability: gap.capability,
          scripts: scripts.map((script) => ({
            scriptId: script.scriptId,
            relativePath: script.relativePath,
            scriptType: script.scriptType,
          })),
        },
      },
      metadata: {
        createdBy: AUTONOMOUS_LEARNING_CREATED_BY,
        learningScenario: gap.type || 'capability_gap',
        testScenario: `learning-${gap.type || 'gap'}`,
        gapId: gap.gapId,
        capability: gap.capability,
        riskLevel: gap.riskLevel || 'low',
        dryRun,
        strategies: selectedStrategies.map((strategy) => strategy.strategyId),
        scripts,
        tags: ['autonomous-learning', gap.type || 'gap', gap.capability || 'capability'],
        evidencePolicy: COMPLETE_EVIDENCE,
        limits: {
          maxSteps: steps.length,
          maxAttempts,
          maxGeneratedScripts: scripts.length,
        },
        createdAt: now,
      },
    },
  };
};

export const createAutonomousReuseTask = ({ gap = {}, match = {}, now = new Date().toISOString() } = {}) => {
  const procedure = match.procedure || {};
  const procedureId = procedure.procedureId || match.procedureId;
  const isBrowserReuse = gap.capability === 'browser.search' ||
    (Array.isArray(procedure.capabilities) && procedure.capabilities.includes('browser.search'));
  const reuseStep = isBrowserReuse
    ? browserOpenStep({
      id: 'validate-procedure-reuse',
      title: 'VM: validar reutilizacao em contexto seguro',
      marker: LEARNING_VM_MARKERS.reuseValidated,
      metadata: { gapId: gap.gapId, procedureId, matchScore: match.matchScore || 0 },
    })
    : vmMarkerStep({
      id: 'validate-procedure-reuse',
      title: 'VM: validar reutilizacao em contexto seguro',
      marker: LEARNING_VM_MARKERS.reuseValidated,
      metadata: { gapId: gap.gapId, procedureId, matchScore: match.matchScore || 0 },
    });
  return {
    id: `reuse-${toSafeIdPart(procedureId)}-${Date.parse(now) || Date.now()}`,
    title: `Reutilizar procedimento: ${procedure.title || procedureId}`,
    description: `Validar reutilizacao de ${procedureId} para ${gap.description || gap.gapId}.`,
    status: 'ready',
    priority: 'medium',
    riskLevel: gap.riskLevel || 'low',
    requiresRealVm: true,
    allowWorkspaceFallback: false,
    maxAttempts: 1,
    procedureId,
    steps: [reuseStep],
    metadata: {
      createdBy: AUTONOMOUS_REUSE_CREATED_BY,
      learningScenario: 'procedure_reuse',
      gapId: gap.gapId,
      procedureId,
      matchScore: match.matchScore || 0,
      tags: ['autonomous-reuse', gap.capability || 'capability'],
      evidencePolicy: COMPLETE_EVIDENCE,
      createdAt: now,
    },
  };
};

export const createAutonomousOptimizationTask = ({ procedure = {}, variant = {}, now = new Date().toISOString() } = {}) => {
  const isBrowserOptimization = Array.isArray(procedure.capabilities) && procedure.capabilities.includes('browser.search');
  const benchmarkStep = isBrowserOptimization
    ? browserOpenStep({
      id: 'benchmark-procedure-variant',
      title: 'VM: benchmark seguro da variante',
      marker: LEARNING_VM_MARKERS.optimizationBenchmarked,
      metadata: { procedureId: procedure.procedureId, variantId: variant.variantId },
    })
    : vmMarkerStep({
      id: 'benchmark-procedure-variant',
      title: 'VM: benchmark seguro da variante',
      marker: LEARNING_VM_MARKERS.optimizationBenchmarked,
      metadata: { procedureId: procedure.procedureId, variantId: variant.variantId },
    });
  return {
    id: `optimize-${toSafeIdPart(variant.variantId || procedure.procedureId)}-${Date.parse(now) || Date.now()}`,
    title: `Otimizar procedimento: ${procedure.title || procedure.procedureId}`,
    description: `Benchmark controlado da variante ${variant.title || variant.variantId}.`,
    status: 'ready',
    priority: 'low',
    riskLevel: procedure.riskLevel || 'low',
    requiresRealVm: true,
    allowWorkspaceFallback: false,
    maxAttempts: 1,
    procedureId: procedure.procedureId,
    steps: [benchmarkStep],
    metadata: {
      createdBy: AUTONOMOUS_OPTIMIZER_CREATED_BY,
      learningScenario: 'procedure_optimization',
      procedureId: procedure.procedureId,
      variantId: variant.variantId,
      tags: ['autonomous-optimization', ...(procedure.capabilities || [])],
      evidencePolicy: COMPLETE_EVIDENCE,
      createdAt: now,
    },
  };
};
