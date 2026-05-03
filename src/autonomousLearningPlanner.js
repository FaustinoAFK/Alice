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
  browserSearchValidated: 'alice-learning-vm:browser-search-validated',
  outcomeValidated: 'alice-learning-vm:learning-outcome-validated',
  candidateReady: 'alice-learning-vm:candidate-ready',
  reuseValidated: 'alice-learning-vm:reuse-validated',
  optimizationBenchmarked: 'alice-learning-vm:optimization-benchmarked',
  appOpened: 'alice-learning-vm:app-opened',
  fileExplorerOpened: 'alice-learning-vm:file-explorer-opened',
  fileManaged: 'alice-learning-vm:file-managed',
  installerChecked: 'alice-learning-vm:installer-checked',
  pageRead: 'alice-learning-vm:page-read',
  pageValidated: 'alice-learning-vm:page-validated',
  fieldInteracted: 'alice-learning-vm:field-interacted',
};

const CONTROLLED_UI_TARGETS = {
  notepad: {
    profileId: 'notepad',
    label: 'Notepad controlled text editor',
    appPath: 'notepad.exe',
    processName: 'notepad',
    kind: 'text_editor',
    fallback: true,
  },
  browser: {
    profileId: 'browser',
    label: 'Browser address/search bar',
    appPath: 'msedge.exe',
    processName: 'msedge',
    kind: 'browser',
  },
  vscode: {
    profileId: 'vscode',
    label: 'Visual Studio Code controlled scratch file',
    commandCandidates: ['code.cmd', 'code.exe', 'code', 'Code.exe'],
    processName: 'Code',
    kind: 'code_editor',
  },
  explorer: {
    profileId: 'explorer',
    label: 'File Explorer controlled folder',
    appPath: 'explorer.exe',
    processName: 'explorer',
    kind: 'file_manager',
  },
};

const quotePowerShellString = (value = '') =>
  `'${String(value).replace(/'/g, "''")}'`;

const collectGapTargetText = (gap = {}) => {
  const context = gap.metadata?.context || {};
  const observedTargets = Array.isArray(context.observedTargets) ? context.observedTargets : [];
  return normalizeText([
    gap.gapId,
    gap.type,
    gap.capability,
    gap.description,
    gap.metadata?.target,
    gap.metadata?.targetApp,
    gap.metadata?.appName,
    context.target,
    context.title,
    context.capability,
    ...observedTargets.map((target) => `${target.kind || ''} ${target.label || ''}`),
  ].filter(Boolean).join(' ')).toLowerCase();
};

const resolveControlledUiTarget = (gap = {}) => {
  const text = collectGapTargetText(gap);
  if (/\b(vs\s*code|vscode|visual studio code|code\.exe|editor de codigo|editor de c[oó]digo)\b/i.test(text)) {
    return CONTROLLED_UI_TARGETS.vscode;
  }
  if (/\b(edge|chrome|firefox|browser|navegador|barra de endereco|barra de endereço|url|web)\b/i.test(text) ||
      gap.capability === 'browser.search' || gap.type === 'browser_search') {
    return CONTROLLED_UI_TARGETS.browser;
  }
  if (/\b(explorer|explorador|arquivo|arquivos|pasta|folder|file manager)\b/i.test(text)) {
    return CONTROLLED_UI_TARGETS.explorer;
  }
  return CONTROLLED_UI_TARGETS.notepad;
};

const summarizeControlledUiTarget = (target = CONTROLLED_UI_TARGETS.notepad) => ({
  profileId: target.profileId,
  label: target.label,
  kind: target.kind,
  processName: target.processName,
  fallback: Boolean(target.fallback),
});

const stableHash = (value = '') => {
  let hash = 2166136261;
  String(value || '').split('').forEach((character) => {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return (hash >>> 0).toString(36).padStart(7, '0').slice(0, 7);
};

export const createControlledLearningText = ({
  gap = {},
  strategy = {},
  actionIndex = 0,
  now = new Date().toISOString(),
  purpose = 'text',
} = {}) => {
  const token = stableHash([
    gap.gapId,
    gap.capability,
    gap.type,
    strategy.strategyId,
    actionIndex,
    purpose,
    now,
  ].join('|'));
  return `alice ${purpose} ${token}`;
};

const fillControlledTextTemplate = (template = '', text = '') => {
  const normalizedTemplate = normalizeText(template);
  if (!normalizedTemplate) {
    return text;
  }
  return normalizedTemplate
    .replaceAll('{{query}}', text)
    .replaceAll('{{text}}', text);
};

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

const browserSearchValidationScript = ({
  expectedTexts = [],
  marker = LEARNING_VM_MARKERS.browserSearchValidated,
} = {}) => {
  const expected = expectedTexts
    .map(normalizeText)
    .filter(Boolean)
    .slice(0, 8);
  return [
    `$expected = @(${expected.map(quotePowerShellString).join(',')})`,
    '$windowDetected = $false',
    '$matched = $false',
    "$matchedText = ''",
    "$windowTitle = ''",
    "$commandLine = ''",
    'for ($i = 0; $i -lt 24; $i++) {',
    '  $processes = @(Get-Process -Name msedge -ErrorAction SilentlyContinue)',
    '  foreach ($process in $processes) {',
    '    try { $process.Refresh() } catch {}',
    '    if ($process.MainWindowHandle -ne 0) { $windowDetected = $true; $windowTitle = $process.MainWindowTitle }',
    '  }',
    "  $cim = @(Get-CimInstance Win32_Process -Filter \"Name = 'msedge.exe'\" -ErrorAction SilentlyContinue)",
    '  foreach ($text in $expected) {',
    '    $needle = [regex]::Escape($text)',
    "    if (($windowTitle -match $needle) -or (($cim | Where-Object { $_.CommandLine -match $needle } | Select-Object -First 1))) {",
    '      $matched = $true',
    '      $matchedText = $text',
    '      break',
    '    }',
    '  }',
    '  if ($windowDetected -and ($matched -or $expected.Count -eq 0)) { break }',
    '  Start-Sleep -Milliseconds 500',
    '}',
    "if (-not $windowDetected) { throw 'browser_window_not_detected_for_validation' }",
    "if ($expected.Count -gt 0 -and -not $matched) { throw 'browser_search_text_not_observed' }",
    `Write-Output ${quotePowerShellString(marker)}`,
    "Write-Output ('matched_text=' + $matchedText)",
    "Write-Output ('window_title=' + $windowTitle)",
  ].join('; ');
};

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

const appLaunchScript = ({ target = CONTROLLED_UI_TARGETS.notepad } = {}) => [
  `$appPath = ${quotePowerShellString(target.appPath || 'notepad.exe')}`,
  `$targetProcessName = ${quotePowerShellString(target.processName || 'notepad')}`,
  `$targetProfile = ${quotePowerShellString(target.profileId || 'notepad')}`,
  ...(target.commandCandidates
    ? [
        `$commandCandidates = @(${target.commandCandidates.map(quotePowerShellString).join(',')})`,
        '$resolvedCommand = $null',
        'foreach ($candidate in $commandCandidates) { $resolvedCommand = Get-Command $candidate -ErrorAction SilentlyContinue | Select-Object -First 1; if ($resolvedCommand) { break } }',
        "if (-not $resolvedCommand) { throw ('target_app_not_available:' + $targetProfile) }",
        '$appPath = $resolvedCommand.Source',
      ]
    : []),
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
  "Write-Output ('target_profile=' + $targetProfile)",
  "Write-Output ('app_path=' + $appPath)",
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

const fileExplorerScript = () => [
  `$root = Join-Path $env:TEMP ${quotePowerShellString('AliceLearningFiles')}`,
  'New-Item -ItemType Directory -Force -Path $root | Out-Null',
  '$beforeIds = @(Get-Process -Name explorer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)',
  'Start-Process -FilePath explorer.exe -ArgumentList $root | Out-Null',
  'Start-Sleep -Milliseconds 1000',
  '$windowDetected = $false',
  "$windowHandle = ''",
  'for ($i = 0; $i -lt 16; $i++) { $processes = @(Get-Process -Name explorer -ErrorAction SilentlyContinue); foreach ($process in $processes) { try { $process.Refresh() } catch {}; if ($process.MainWindowHandle -ne 0) { $windowDetected = $true; $windowHandle = $process.MainWindowHandle; break } }; if ($windowDetected) { break }; Start-Sleep -Milliseconds 250 }',
  "if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw 'safe_folder_not_created' }",
  "if (-not $windowDetected) { throw 'explorer_window_not_detected' }",
  "Write-Output ('folder_path=' + $root)",
  "Write-Output ('window_handle=' + $windowHandle)",
].join('; ');

const fileManagementScript = ({ text = 'alice file managed' } = {}) => [
  `$root = Join-Path $env:TEMP ${quotePowerShellString('AliceLearningFiles')}`,
  `$folder = Join-Path $root ${quotePowerShellString(`folder-${stableHash(text)}`)}`,
  `$file = Join-Path $folder ${quotePowerShellString('note.txt')}`,
  'New-Item -ItemType Directory -Force -Path $folder | Out-Null',
  `Set-Content -LiteralPath $file -Value ${quotePowerShellString(text)} -Encoding UTF8`,
  "if (-not (Test-Path -LiteralPath $folder -PathType Container)) { throw 'controlled_folder_missing' }",
  "if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'controlled_file_missing' }",
  '$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8',
  `if ($content -notmatch ${quotePowerShellString(text)}) { throw 'controlled_file_content_mismatch' }`,
  'Start-Process -FilePath explorer.exe -ArgumentList $folder | Out-Null',
  'Start-Sleep -Milliseconds 800',
  "Write-Output ('folder_path=' + $folder)",
  "Write-Output ('file_path=' + $file)",
  "Write-Output ('file_text=' + $content.Trim())",
].join('; ');

const safeInstallerDiscoveryScript = () => [
  '$winget = Get-Command winget -ErrorAction SilentlyContinue',
  "if (-not $winget) { throw 'winget_not_available' }",
  "$output = & $winget.Source search --name '7zip' --source winget --accept-source-agreements 2>&1 | Out-String",
  "if ($LASTEXITCODE -ne 0) { throw ('winget_search_failed:' + $output) }",
  "if ($output -notmatch '7-Zip|7zip|7zip.7zip') { throw 'safe_package_not_found' }",
  "Write-Output 'installer_tool=winget'",
  "Write-Output 'package_query=7zip'",
  "Write-Output 'install_attempt=search_only_no_install'",
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

const browserFieldInteractionScript = ({ text = 'alice browser field ok' } = {}) => [
  `$text = ${quotePowerShellString(text)}`,
  browserOpenScript({ url: 'about:blank', marker: LEARNING_VM_MARKERS.browserOpened }),
  '$process = @(Get-Process -Name msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1)',
  "if (-not $process) { throw 'browser_field_window_not_detected' }",
  '$shell = New-Object -ComObject WScript.Shell',
  "if (-not $shell.AppActivate([int]$process.Id)) { throw 'browser_field_window_not_activated' }",
  'Start-Sleep -Milliseconds 200',
  'Add-Type -AssemblyName System.Windows.Forms',
  "[System.Windows.Forms.SendKeys]::SendWait('^l')",
  '[System.Windows.Forms.SendKeys]::SendWait($text)',
  "[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')",
  'Start-Sleep -Milliseconds 1200',
  browserSearchValidationScript({ expectedTexts: [text], marker: LEARNING_VM_MARKERS.fieldInteracted }),
  "Write-Output 'target_profile=browser'",
  "Write-Output ('typed_text=' + $text)",
].join('; ');

const notepadFieldInteractionScript = ({ text = 'alice field interaction ok' } = {}) => [
  `$text = ${quotePowerShellString(text)}`,
  "$targetProcessName = 'notepad'",
  `$file = Join-Path $env:TEMP ${quotePowerShellString(`alice-learning-notepad-${stableHash(text)}.txt`)}`,
  "Set-Content -LiteralPath $file -Value '' -Encoding UTF8",
  '$beforeIds = @(Get-Process -Name $targetProcessName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)',
  'Start-Process -FilePath notepad.exe -ArgumentList $file | Out-Null',
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
  "[System.Windows.Forms.SendKeys]::SendWait('^s')",
  'Start-Sleep -Milliseconds 500',
  '$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8',
  "if ($content -notmatch [regex]::Escape($text)) { throw 'controlled_text_file_mismatch' }",
  `Write-Output ${quotePowerShellString(LEARNING_VM_MARKERS.fieldInteracted)}`,
  "Write-Output 'target_profile=notepad'",
  "Write-Output ('file_path=' + $file)",
  "Write-Output ('window_handle=' + $windowProcess.MainWindowHandle)",
  "Write-Output ('typed_text=' + $text)",
].join('; ');

const vscodeFieldInteractionScript = ({ text = 'alice vscode field ok' } = {}) => [
  `$text = ${quotePowerShellString(text)}`,
  `$file = Join-Path $env:TEMP ${quotePowerShellString(`alice-learning-vscode-${stableHash(text)}.txt`)}`,
  "Set-Content -LiteralPath $file -Value '' -Encoding UTF8",
  "$targetProcessName = 'Code'",
  "$commandCandidates = @('code.cmd','code.exe','code','Code.exe')",
  '$resolvedCommand = $null',
  'foreach ($candidate in $commandCandidates) { $resolvedCommand = Get-Command $candidate -ErrorAction SilentlyContinue | Select-Object -First 1; if ($resolvedCommand) { break } }',
  "if (-not $resolvedCommand) { throw 'target_app_not_available:vscode' }",
  '$beforeIds = @(Get-Process -Name $targetProcessName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)',
  'Start-Process -FilePath $resolvedCommand.Source -ArgumentList @("-n", $file) | Out-Null',
  'Start-Sleep -Milliseconds 1500',
  '$windowProcess = $null',
  'for ($i = 0; $i -lt 24; $i++) { $processes = @(Get-Process -Name $targetProcessName -ErrorAction SilentlyContinue); $windowProcess = $processes | Where-Object { $_.MainWindowHandle -ne 0 -and ($beforeIds -notcontains $_.Id) } | Select-Object -First 1; if (-not $windowProcess) { $windowProcess = $processes | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 }; if ($windowProcess) { break }; Start-Sleep -Milliseconds 500 }',
  "if (-not $windowProcess) { throw 'vscode_window_not_detected' }",
  '$shell = New-Object -ComObject WScript.Shell',
  "if (-not $shell.AppActivate([int]$windowProcess.Id)) { throw 'vscode_window_not_activated' }",
  'Start-Sleep -Milliseconds 500',
  'Add-Type -AssemblyName System.Windows.Forms',
  "[System.Windows.Forms.SendKeys]::SendWait('^a')",
  '[System.Windows.Forms.SendKeys]::SendWait($text)',
  "[System.Windows.Forms.SendKeys]::SendWait('^s')",
  'Start-Sleep -Milliseconds 800',
  '$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8',
  "if ($content -notmatch [regex]::Escape($text)) { throw 'vscode_controlled_file_mismatch' }",
  `Write-Output ${quotePowerShellString(LEARNING_VM_MARKERS.fieldInteracted)}`,
  "Write-Output 'target_profile=vscode'",
  "Write-Output ('file_path=' + $file)",
  "Write-Output ('window_handle=' + $windowProcess.MainWindowHandle)",
  "Write-Output ('typed_text=' + $text)",
].join('; ');

const fieldInteractionScript = ({
  text = 'alice field interaction ok',
  target = CONTROLLED_UI_TARGETS.notepad,
} = {}) => {
  if (target.profileId === 'browser') {
    return browserFieldInteractionScript({ text });
  }
  if (target.profileId === 'vscode') {
    return vscodeFieldInteractionScript({ text });
  }
  return notepadFieldInteractionScript({ text });
};

const substantiveValidationScriptForGap = ({ gap = {}, steps = [] } = {}) => {
  const capability = normalizeText(gap.capability || gap.type);
  const target = resolveControlledUiTarget(gap);
  const controlledTexts = steps
    .map((step) => step.action?.requestedResources?.autonomousLearning?.controlledText)
    .filter(Boolean);

  if (capability === 'browser.search' || gap.type === 'browser_search') {
    return {
      marker: LEARNING_VM_MARKERS.browserSearchValidated,
      script: browserSearchValidationScript({ expectedTexts: controlledTexts }),
      title: 'VM: validar que a pesquisa controlada apareceu no navegador',
    };
  }

  return {
    marker: LEARNING_VM_MARKERS.outcomeValidated,
    title: 'VM: validar resultado substantivo do aprendizado',
    script: [
      `$capability = ${quotePowerShellString(capability || 'unknown')}`,
      `$targetProcessName = ${quotePowerShellString(target.processName || 'notepad')}`,
      "switch ($capability) {",
      "  'app.launch' { if (-not (@(Get-Process -Name $targetProcessName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }).Count)) { throw 'validated_app_window_missing' } }",
      "  'text.input' { if (-not (@(Get-Process -Name $targetProcessName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }).Count)) { throw 'validated_text_window_missing' } }",
      "  'field.interaction' { if (-not (@(Get-Process -Name $targetProcessName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }).Count)) { throw 'validated_field_window_missing' } }",
      "  'file.explorer.open' { $root = Join-Path $env:TEMP 'AliceLearningFiles'; if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw 'validated_explorer_folder_missing' } }",
      "  'file.folder.create' { $root = Join-Path $env:TEMP 'AliceLearningFiles'; if (-not (@(Get-ChildItem -LiteralPath $root -Filter note.txt -Recurse -ErrorAction SilentlyContinue).Count)) { throw 'validated_controlled_file_missing' } }",
      "  'app.install.safe_probe' { if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw 'validated_package_manager_missing' } }",
      "  'page.validate' { $path = Join-Path $env:TEMP 'alice-learning-page-validation.html'; if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'validated_page_file_missing' }; $content = Get-Content -LiteralPath $path -Raw -Encoding UTF8; if ($content -notmatch 'alice-learning-page-validation-ok') { throw 'validated_page_marker_missing' } }",
      "  'page.read' { $path = Join-Path $env:TEMP 'alice-learning-page-read.html'; if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'validated_read_file_missing' }; $content = Get-Content -LiteralPath $path -Raw -Encoding UTF8; if ($content -notmatch 'alice-learning-page-read-ok') { throw 'validated_read_marker_missing' } }",
      "  default { throw ('unsupported_substantive_validation:' + $capability) }",
      '}',
      `Write-Output ${quotePowerShellString(LEARNING_VM_MARKERS.outcomeValidated)}`,
      "Write-Output ('capability=' + $capability)",
      `Write-Output ${quotePowerShellString(`target_profile=${target.profileId || 'notepad'}`)}`,
    ].join('; '),
  };
};

const createSubstantiveValidationStep = ({ gap = {}, steps = [], now = new Date().toISOString() } = {}) => {
  const validation = substantiveValidationScriptForGap({ gap, steps });
  if (!validation?.script) {
    return null;
  }
  return vmMarkerStep({
    id: 'validate-learning-outcome',
    title: validation.title,
    marker: validation.marker,
    script: validation.script,
    metadata: {
      gapId: gap.gapId,
      phase: 'substantive_validation',
      validationKind: 'controlled_outcome',
      substantiveValidation: true,
      controlledTarget: summarizeControlledUiTarget(resolveControlledUiTarget(gap)),
      createdAt: now,
    },
  });
};

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
        'open_file_explorer_safe_folder',
        'create_controlled_folder_file',
        'validate_safe_installer_flow',
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
  const controlledTarget = resolveControlledUiTarget(gap);
  const controlledText = createControlledLearningText({
    gap,
    strategy,
    actionIndex,
    now,
    purpose: gap.capability === 'browser.search' || gap.type === 'browser_search' ? 'query' : 'text',
  });
  const metadata = {
    gapId: gap.gapId,
    strategyId: strategy.strategyId,
    strategyType: strategy.type,
    actionKind: action.kind,
    createdAt: now,
    controlledText,
    controlledTarget: summarizeControlledUiTarget(controlledTarget),
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
    const text = action.text || fillControlledTextTemplate(action.textTemplate, controlledText);
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
    const query = createControlledLearningText({ gap, strategy, actionIndex, now, purpose: 'query' });
    return browserOpenStep({
      id: `learning-${safeStrategyId}-browser-command`,
      title: 'VM: abrir URL de busca controlada no navegador',
      url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
      marker: LEARNING_VM_MARKERS.browserOpened,
      metadata: { ...metadata, controlledText: query },
    });
  }
  if (action.kind === 'run_command' && action.command === 'start_safe_app') {
    return visualVmStep({
      id: `learning-${safeStrategyId}-app-command`,
      title: `VM: abrir aplicativo seguro controlado (${controlledTarget.label})`,
      visualAction: 'run_command',
      parameters: {
        command: VM_POWERSHELL_EXE,
        args: powerShellArgs(appLaunchScript({ target: controlledTarget })),
        timeout_seconds: 12,
      },
      completionCriteria: { type: 'file_contains', contains: LEARNING_VM_MARKERS.appOpened },
      metadata,
    });
  }
  if (action.kind === 'run_command' && action.command === 'open_file_explorer_safe_folder') {
    return vmMarkerStep({
      id: `learning-${safeStrategyId}-explorer-command`,
      title: 'VM: abrir Explorador de Arquivos em pasta controlada',
      marker: LEARNING_VM_MARKERS.fileExplorerOpened,
      script: fileExplorerScript(),
      metadata,
    });
  }
  if (action.kind === 'run_command' && action.command === 'create_controlled_folder_file') {
    const text = createControlledLearningText({ gap, strategy, actionIndex, now, purpose: 'file' });
    return vmMarkerStep({
      id: `learning-${safeStrategyId}-file-command`,
      title: 'VM: criar pasta e arquivo temporarios controlados',
      marker: LEARNING_VM_MARKERS.fileManaged,
      script: fileManagementScript({ text }),
      metadata: { ...metadata, controlledText: text },
    });
  }
  if (action.kind === 'run_command' && action.command === 'validate_safe_installer_flow') {
    return vmMarkerStep({
      id: `learning-${safeStrategyId}-installer-command`,
      title: 'VM: validar descoberta segura de pacote instalavel',
      marker: LEARNING_VM_MARKERS.installerChecked,
      script: safeInstallerDiscoveryScript(),
      metadata,
      maxAttempts: 1,
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
    const text = createControlledLearningText({ gap, strategy, actionIndex, now, purpose: 'field' });
    return vmMarkerStep({
      id: `learning-${safeStrategyId}-field-command`,
      title: `VM: focar campo controlado, digitar e validar (${controlledTarget.label})`,
      marker: LEARNING_VM_MARKERS.fieldInteracted,
      script: fieldInteractionScript({ text, target: controlledTarget }),
      metadata: { ...metadata, controlledText: text },
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
  const controlledTarget = resolveControlledUiTarget(gap);
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

  if (requiresRealVm) {
    const validationStep = createSubstantiveValidationStep({ gap, steps, now });
    if (validationStep) {
      steps.push(validationStep);
    }
  }

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
          context: gap.metadata?.context || null,
          controlledTarget: summarizeControlledUiTarget(controlledTarget),
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
        validationKind: requiresRealVm ? 'controlled_outcome' : 'controlled_workspace_contract',
        substantiveValidation: requiresRealVm,
        requiresSubstantiveValidation: requiresRealVm,
        requiredValidationSignals: requiresRealVm
          ? ['physical_evidence', 'verify_runner_evidence', 'controlled_outcome_marker']
          : ['physical_evidence', 'verify_runner_evidence'],
        context: gap.metadata?.context || null,
        controlledTarget: summarizeControlledUiTarget(controlledTarget),
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
      validationKind: 'infrastructure_marker',
      substantiveValidation: false,
      requiresSubstantiveValidation: true,
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
      variantSteps: Array.isArray(variant.steps) ? variant.steps : [],
      benchmark: variant.benchmark || {},
      tags: ['autonomous-optimization', ...(procedure.capabilities || [])],
      evidencePolicy: COMPLETE_EVIDENCE,
      createdAt: now,
    },
  };
};
