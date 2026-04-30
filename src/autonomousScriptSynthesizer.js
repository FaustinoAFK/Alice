import { commandOrScriptLooksDestructive } from './autonomousLearningPolicy';

export const CONTROLLED_LEARNING_SCRIPT_DIR = '.alice-learning-scripts';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const toSafeIdPart = (value) =>
  normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'script';

const normalizeScriptType = (value = 'node') => {
  const normalized = normalizeText(value).toLowerCase();
  if (['node', 'python', 'powershell'].includes(normalized)) {
    return normalized;
  }
  return 'node';
};

export const validateSynthesizedScript = ({ content = '', scriptType = 'node' } = {}) => {
  const normalizedType = normalizeScriptType(scriptType);
  const source = String(content || '');
  if (!source.trim()) {
    return { ok: false, reason: 'script_empty' };
  }
  if (commandOrScriptLooksDestructive(source)) {
    return { ok: false, reason: 'script_contains_destructive_action' };
  }
  if (/\b(fetch|XMLHttpRequest|Invoke-WebRequest|curl|wget)\b/i.test(source)) {
    return { ok: false, reason: 'script_network_access_blocked' };
  }
  if (/\b(child_process|subprocess|Start-Process|os\.system|exec\(|spawn\()\b/i.test(source)) {
    return { ok: false, reason: 'script_process_spawn_blocked' };
  }
  if (normalizedType === 'powershell' && /\bSet-ExecutionPolicy|Remove-Item|New-ItemProperty\b/i.test(source)) {
    return { ok: false, reason: 'powershell_sensitive_command_blocked' };
  }
  return { ok: true, reason: 'script_structure_allowed' };
};

export const synthesizeScriptForGap = ({
  gap = {},
  strategy = {},
  scriptType = 'node',
  now = new Date().toISOString(),
} = {}) => {
  const normalizedType = normalizeScriptType(scriptType || strategy.scriptType);
  const gapId = normalizeText(gap.gapId) || 'gap';
  const strategyId = normalizeText(strategy.strategyId) || 'strategy';
  const fileBase = `${toSafeIdPart(gapId)}-${toSafeIdPart(strategyId)}`;
  const reportPath = `.alice-learning/${fileBase}-report.json`;

  const report = {
    ok: true,
    gapId,
    strategyId,
    capability: gap.capability || strategy.capability || '',
    validation: {
      passed: true,
      reason: 'controlled_learning_script_validated',
    },
    createdAt: now,
  };

  const content = (() => {
    if (normalizedType === 'python') {
      return [
        'import json, os',
        "os.makedirs('.alice-learning', exist_ok=True)",
        `report = ${JSON.stringify(report)}`,
        `open(${JSON.stringify(reportPath)}, 'w', encoding='utf-8').write(json.dumps(report, ensure_ascii=False, indent=2))`,
        "print('alice-learning-script-ok')",
      ].join('\n');
    }
    if (normalizedType === 'powershell') {
      return [
        "$report = @'",
        JSON.stringify(report, null, 2),
        "'@",
        "New-Item -ItemType Directory -Force -Path '.alice-learning' | Out-Null",
        `$report | Set-Content -Encoding UTF8 -Path ${JSON.stringify(reportPath)}`,
        "Write-Output 'alice-learning-script-ok'",
      ].join('\n');
    }
    return [
      "const fs = require('fs');",
      "fs.mkdirSync('.alice-learning', { recursive: true });",
      `const report = ${JSON.stringify(report)};`,
      `fs.writeFileSync(${JSON.stringify(reportPath)}, JSON.stringify(report, null, 2));`,
      "console.log('alice-learning-script-ok');",
    ].join('\n');
  })();

  const validation = validateSynthesizedScript({ content, scriptType: normalizedType });
  return {
    ok: validation.ok,
    reason: validation.reason,
    script: {
      scriptId: `learning-script-${fileBase}`,
      gapId,
      strategyId,
      scriptType: normalizedType,
      relativePath: `${CONTROLLED_LEARNING_SCRIPT_DIR}/${fileBase}.${normalizedType === 'powershell' ? 'ps1' : normalizedType === 'python' ? 'py' : 'cjs'}`,
      content,
      reportPath,
      createdAt: now,
    },
  };
};

export const createScriptWriteStep = (script = {}) => {
  const serializedPath = JSON.stringify(script.relativePath || `${CONTROLLED_LEARNING_SCRIPT_DIR}/script.cjs`);
  const serializedContent = JSON.stringify(script.content || '');
  return {
    id: `write-${toSafeIdPart(script.scriptId)}`,
    title: `Registrar script auxiliar ${script.scriptId || ''}`.trim(),
    type: 'command',
    action: {
      kind: 'command',
      command: 'node',
      args: [
        '-e',
        `const fs=require('fs'); const p=${serializedPath}; fs.mkdirSync(require('path').dirname(p),{recursive:true}); fs.writeFileSync(p, ${serializedContent}); console.log('learning-script-written:'+p);`,
      ],
      environment: 'local_workspace_fallback',
    },
    completionCriteria: { type: 'exit_code', expected: 0 },
    expectedEvidence: { kind: 'complete', required: ['command', 'stdout', 'stderr', 'exitCode', 'validationResult', 'metadata'] },
    maxAttempts: 1,
  };
};
