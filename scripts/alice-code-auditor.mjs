#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_REPORT_PATH = 'erros.md';
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

const normalizeText = (value = '') => String(value || '').trim().replace(/\s+/g, ' ');
const toPosixPath = (value = '') => value.replace(/\\/g, '/');

const nowForReport = () => {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${sign}${pad(Math.trunc(absOffset / 60))}:${pad(absOffset % 60)}`;
};

const readProjectFile = async (rootDir, relativePath) => {
  try {
    return await readFile(path.join(rootDir, relativePath), 'utf8');
  } catch {
    return '';
  }
};

const includesAll = (text, fragments) => fragments.every((fragment) => text.includes(fragment));

const extractSections = (report = '', prefix) => {
  const regex = /^## ((?:ERRO|MELHORIA)-\d{4}) — ([^\n]+)\n?/gm;
  const sections = [];
  const matches = [...report.matchAll(regex)];

  matches.forEach((match, index) => {
    if (!match[1].startsWith(`${prefix}-`)) {
      return;
    }
    const nextMatch = matches[index + 1];
    const start = match.index || 0;
    const end = nextMatch?.index ?? report.length;
    const raw = report.slice(start, end).trim();
    sections.push({
      id: match[1],
      title: normalizeText(match[2]),
      body: raw.replace(match[0], '').trim(),
      raw,
    });
  });
  return sections;
};

const nextId = (prefix, existing = [], offset = 0) => {
  const max = existing.reduce((current, section) => {
    const number = Number(section.id.replace(`${prefix}-`, ''));
    return Number.isFinite(number) ? Math.max(current, number) : current;
  }, 0);
  return `${prefix}-${String(max + offset + 1).padStart(4, '0')}`;
};

const anchorForTitle = (id, title) =>
  `${id.toLowerCase()}--${normalizeText(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;

const renderProblem = ({ id, title, severity, module, files, summary, evidence, impact, scenario, confirmation, suggestion, priority }) => [
  `## ${id} — ${title}`,
  '',
  `**Severidade:** ${severity}  `,
  '**Status:** Aberto  ',
  `**Módulo:** ${module}  `,
  '**Arquivos envolvidos:**',
  ...files.map((file) => `- \`${toPosixPath(file)}\``),
  '',
  '**Resumo:**  ',
  summary,
  '',
  '**Evidência no código:**  ',
  evidence,
  '',
  '**Por que isso é um problema:**  ',
  impact,
  '',
  '**Cenário provável de falha:**  ',
  scenario,
  '',
  '**Como confirmar:**  ',
  confirmation,
  '',
  '**Sugestão de correção futura:**  ',
  suggestion,
  '',
  '**Prioridade recomendada:**  ',
  priority,
].join('\n');

const renderImprovement = ({ id, title, priority, module, files, evidence, value, risk, confirmation, suggestion }) => [
  `## ${id} — ${title}`,
  '',
  `**Severidade:** ${priority === 'P1' ? 'Média' : 'Baixa'}  `,
  '**Status:** Aberto  ',
  `**Módulo:** ${module}  `,
  '**Arquivos envolvidos:**',
  ...files.map((file) => `- \`${toPosixPath(file)}\``),
  '',
  '**Resumo:**  ',
  value,
  '',
  '**Evidência no código:**  ',
  evidence,
  '',
  '**Por que vale fazer:**  ',
  value,
  '',
  '**Risco de não fazer:**  ',
  risk,
  '',
  '**Como confirmar:**  ',
  confirmation,
  '',
  '**Sugestão de implementação futura:**  ',
  suggestion,
  '',
  '**Prioridade recomendada:**  ',
  priority,
].join('\n');

const buildDetectedIssues = async (rootDir) => {
  const webKnowledge = await readProjectFile(rootDir, 'src-tauri/src/web_knowledge.rs');
  const vmVisual = await readProjectFile(rootDir, 'src-tauri/src/vm_visual.rs');
  const guestServer = await readProjectFile(rootDir, 'src-tauri/vm/guest_agent/server.py');
  const guestExecutor = await readProjectFile(rootDir, 'src-tauri/vm/guest_agent/action_executor.py');
  const tauriLib = await readProjectFile(rootDir, 'src-tauri/src/lib.rs');
  const runnerState = await readProjectFile(rootDir, 'src/autonomousRunnerState.js');
  const app = await readProjectFile(rootDir, 'src/App.jsx');
  const toolExecutor = await readProjectFile(rootDir, 'src/autonomousLearningToolExecutor.js');
  const packageJson = await readProjectFile(rootDir, 'package.json');
  const scriptsDirHasValidateAll = existsSync(path.join(rootDir, 'scripts', 'validate-all.mjs'));

  const errors = [];
  const improvements = [];

  if (
    includesAll(webKnowledge, [
      'Access-Control-Allow-Origin',
      '"*"',
      '/v1/page-state',
      'read_to_string(&mut body)',
    ])
  ) {
    errors.push({
      title: 'Bridge local de conhecimento aceita escrita cross-origin sem autenticação nem limite de corpo',
      severity: 'Alta',
      module: 'Ponte local de conhecimento web / extensão Edge',
      files: ['src-tauri/src/web_knowledge.rs', 'edge-extension/background.js', 'edge-extension/manifest.json'],
      summary: 'A ponte HTTP local de conhecimento aceita snapshots de página em endpoint loopback com CORS amplo, sem segredo compartilhado e lendo o corpo completo em memória.',
      evidence: '`web_knowledge.rs` define `Access-Control-Allow-Origin: *`, expõe `POST /v1/page-state` e usa `read_to_string(&mut body)` para carregar o payload completo antes de qualquer limite explícito.',
      impact: 'Uma página ou processo local pode tentar injetar contexto falso na Alice ou enviar payload grande para DoS local, contaminando respostas e decisões baseadas em contexto web.',
      scenario: 'Com a Alice aberta, uma página maliciosa chama `http://127.0.0.1:38947/v1/page-state` com JSON fabricado ou grande; a Alice passa a usar snapshot falso ou consome memória desnecessariamente.',
      confirmation: 'Inspecionar `src-tauri/src/web_knowledge.rs` e a chamada oficial em `edge-extension/background.js`; testar manualmente um `POST` local para o endpoint enquanto o app está ativo.',
      suggestion: 'Adicionar token local por sessão, validar origem/cabeçalhos, limitar `Content-Length` antes da leitura e rejeitar payloads acima do teto.',
      priority: 'P1',
    });
  }

  if (
    includesAll(vmVisual, ['ALICE_VM_GUEST_AGENT_TOKEN', '--host', '0.0.0.0']) &&
    includesAll(guestServer, ['def _authorized', 'if not token']) &&
    includesAll(guestExecutor, ['run_command', 'start_background_command'])
  ) {
    errors.push({
      title: 'Guest Agent residente pode iniciar sem autenticação enquanto expõe execução de comandos',
      severity: 'Alta',
      module: 'VM / Guest Interaction Agent residente',
      files: ['src-tauri/src/vm_visual.rs', 'src-tauri/vm/guest_agent/server.py', 'src-tauri/vm/guest_agent/action_executor.py'],
      summary: 'O servidor residente do Guest Agent permite modo sem token e expõe ações capazes de executar comandos dentro da VM.',
      evidence: '`vm_visual.rs` lê `ALICE_VM_GUEST_AGENT_TOKEN` e pode iniciar o servidor em `0.0.0.0`; `server.py` autoriza quando não há token; `action_executor.py` implementa `run_command` e `start_background_command`.',
      impact: 'Qualquer processo que alcance a porta encaminhada pode acionar comandos na VM fora do fluxo governado da Alice.',
      scenario: 'O usuário inicia o residente sem token; um processo local chama a porta do agente e dispara `run_command` sem passar por HUD, policy, auditoria ou validação.',
      confirmation: 'Inspecionar os três arquivos citados e iniciar o agente residente sem `ALICE_VM_GUEST_AGENT_TOKEN` em ambiente controlado para verificar se requisições sem token são aceitas.',
      suggestion: 'Tornar token obrigatório, gerar segredo efêmero por sessão ou bloquear ações de comando quando o residente estiver sem autenticação.',
      priority: 'P1',
    });
  }

  if (includesAll(tauriLib, ['fn write_memory_json_atomic', 'remove_file(path)', 'rename(&temp_path, path)'])) {
    errors.push({
      title: 'Gravação atômica da memória remove o arquivo antigo antes de concluir o rename',
      severity: 'Alta',
      module: 'Persistência de memória local',
      files: ['src-tauri/src/lib.rs', 'src/aliceMemory.js'],
      summary: 'A escrita da memória usa arquivo temporário, mas remove o arquivo antigo antes do rename, criando uma janela de perda de dados.',
      evidence: '`write_memory_json_atomic` valida e escreve o `.tmp`, remove `path` quando existe e só depois faz `rename(&tmp_path, path)`.',
      impact: 'Falha entre remoção e rename pode deixar a Alice sem memória persistida, forçando recuperação vazia ou perda de estado operacional.',
      scenario: 'Durante o fechamento do app ou flush de memória, antivírus, permissão ou queda de energia interrompe o rename depois do `remove_file`; o próximo boot não encontra memória válida.',
      confirmation: 'Inspecionar `write_memory_json_atomic` em `src-tauri/src/lib.rs` e simular falha de rename em teste unitário com arquivo existente.',
      suggestion: 'Usar rename/substituição atômica apropriada por plataforma sem remover antes, mantendo backup temporário e recovery de último arquivo válido.',
      priority: 'P1',
    });
  }

  if (
    includesAll(runnerState, ['reorderAutonomousRunnerTask', 'queueRank', 'updateAutonomousRunnerTask']) &&
    !runnerState.includes('queue: normalizedRunner.queue')
  ) {
    errors.push({
      title: 'Reordenação manual do Runner pode não alterar a ordem efetiva da fila',
      severity: 'Média',
      module: 'Autonomous Task Runner / fila',
      files: ['src/autonomousRunnerState.js', 'src/autonomousRunnerScheduler.js', 'src/hud/pages/AutonomousRunnerHudPage.jsx'],
      summary: 'A reordenação atual altera `queueRank` da task, mas não reescreve a lista `queue`, que é a origem usada para montar candidatos antes da ordenação.',
      evidence: '`reorderAutonomousRunnerTask` chama `updateAutonomousRunnerTask` com novo `queueRank`, mas não atualiza `runner.queue`; o scheduler parte da ordem de `queue` para resolver tasks antes de ordenar por prioridade/rank.',
      impact: 'O HUD pode sugerir que uma task foi reordenada, mas o comportamento real pode continuar dependente da fila antiga em cenários de empate ou normalização.',
      scenario: 'Usuário move task para o topo pelo HUD, mas outra task com prioridade equivalente continua sendo selecionada primeiro porque a fila persistida não foi regravada de forma explícita.',
      confirmation: 'Criar teste com duas tasks de mesma prioridade, chamar `reorderAutonomousRunnerTask` e verificar `runner.queue` e ordem selecionada por `getEligibleRunnerTasks`.',
      suggestion: 'Atualizar `queue` junto com `queueRank` ou definir um único contrato de ordenação persistida e cobri-lo por teste.',
      priority: 'P2',
    });
  }

  if (!tauriLib.includes('manifest.json') && includesAll(tauriLib, ['save_runner_evidence', 'metadata.json', 'stdout.txt', 'stderr.txt', 'validation.json'])) {
    improvements.push({
      title: 'Criar manifesto transacional para evidências físicas do Runner',
      priority: 'P1',
      module: 'Runner / evidências',
      files: ['src-tauri/src/lib.rs', 'src/autonomousRunnerEvidence.js', 'src/autonomousTaskRunner.js'],
      evidence: '`save_runner_evidence` grava arquivos separados, mas não há manifesto final com hashes/tamanhos nem marcador de commit atômico do conjunto.',
      value: 'Um manifesto verificável reduz risco de evidência parcial ser interpretada como completa e melhora auditoria de execuções críticas.',
      risk: 'Sem manifesto, falhas intermediárias podem deixar diretórios parcialmente escritos e dificultar distinguir execução incompleta de evidência íntegra.',
      confirmation: 'Inspecionar `save_runner_evidence` e `verify_runner_evidence`; verificar ausência de arquivo de manifesto ou hash por arquivo.',
      suggestion: 'Gravar arquivos em diretório temporário, calcular hash/tamanho, criar `manifest.json` e só então promover o diretório para execução confirmada.',
    });
  }

  if (app.split('\n').length > 1200) {
    improvements.push({
      title: 'Separar App.jsx em hooks e serviços testáveis',
      priority: 'P2',
      module: 'React / orquestração principal',
      files: ['src/App.jsx'],
      evidence: `App.jsx possui aproximadamente ${app.split('\n').length} linhas e concentra Live API, memória, Runner, HUD, tool calls, persistência e observações.`,
      value: 'Separar responsabilidades reduz acoplamento, facilita testes unitários e diminui risco de regressão em efeitos React longos.',
      risk: 'Manter tudo no componente principal aumenta custo de revisão e torna mais fácil introduzir bugs em timers, refs e persistência.',
      confirmation: 'Contar linhas e mapear responsabilidades de `App.jsx`; observar múltiplos `useEffect`, refs globais e handlers de domínios distintos.',
      suggestion: 'Extrair hooks/serviços para sessão Live, persistência de memória, Runner loop, debug interactions e aprendizado observado, preservando contratos atuais.',
    });
  }

  if (toolExecutor.split('case ').length > 12) {
    improvements.push({
      title: 'Dividir executor de ferramentas autônomas por domínio',
      priority: 'P2',
      module: 'Tools autônomas / integração',
      files: ['src/autonomousLearningToolExecutor.js'],
      evidence: '`autonomousLearningToolExecutor.js` concentra diversas operações em um único executor/switch, misturando VM, propostas, auditoria, snapshots, rollback e aprendizado.',
      value: 'Adapters por domínio tornam o fluxo mais testável, reduzem efeitos colaterais cruzados e deixam claro qual ferramenta altera qual parte da memória.',
      risk: 'Um executor grande tende a acumular contratos implícitos e dificulta validar permissões, rollback e persistência por operação.',
      confirmation: 'Inspecionar o executor e contar operações/cases; comparar com testes existentes por domínio.',
      suggestion: 'Criar módulos pequenos para VM, runner, host snapshots, propostas e aprendizado, mantendo um roteador fino compatível com a API atual.',
    });
  }

  if (!scriptsDirHasValidateAll && !packageJson.includes('validate:all')) {
    improvements.push({
      title: 'Criar comando único de validação completa do projeto',
      priority: 'P2',
      module: 'Scripts / validação',
      files: ['package.json', 'scripts/'],
      evidence: '`package.json` tem comandos separados para JS, build e harness; validações Rust e Python estão documentadas no README, mas não há comando único versionado.',
      value: 'Um comando único reduz falhas por validação parcial e facilita handoff entre contas/sessões.',
      risk: 'Mudanças podem passar com `npm test` mas quebrar Rust, Python ou harness, especialmente em áreas Tauri/VM/Runner.',
      confirmation: 'Inspecionar `package.json` e `README.md`; verificar ausência de `validate:all` ou script equivalente.',
      suggestion: 'Adicionar script orquestrador que rode `npm test`, `npm run lint`, `npm run build`, `cargo test`, testes Python e `runner:harness -- verify-safe-state` com relatório consolidado.',
    });
  }

  return { errors, improvements };
};

const countBySeverity = (sections) => ({
  critical: sections.filter((section) => /\*\*Severidade:\*\* Crítica/.test(section.raw)).length,
  high: sections.filter((section) => /\*\*Severidade:\*\* Alta/.test(section.raw)).length,
  medium: sections.filter((section) => /\*\*Severidade:\*\* Média/.test(section.raw)).length,
  low: sections.filter((section) => /\*\*Severidade:\*\* Baixa/.test(section.raw)).length,
});

const isSectionSubstantive = (section = {}) =>
  section.body.includes('**Resumo:**') &&
  (
    section.body.includes('**Por que isso é um problema:**') ||
    section.body.includes('**Por que vale fazer:**')
  );

const normalizeComparableTitle = (value = '') =>
  normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const areRelatedTitles = (left = '', right = '') => {
  const leftTitle = normalizeComparableTitle(left);
  const rightTitle = normalizeComparableTitle(right);
  if (!leftTitle || !rightTitle) {
    return false;
  }
  if (leftTitle === rightTitle || leftTitle.includes(rightTitle) || rightTitle.includes(leftTitle)) {
    return true;
  }
  const leftTokens = new Set(leftTitle.split(' ').filter((token) => token.length >= 5));
  const rightTokens = rightTitle.split(' ').filter((token) => token.length >= 5);
  if (leftTokens.size === 0 || rightTokens.length === 0) {
    return false;
  }
  const overlap = rightTokens.filter((token) => leftTokens.has(token)).length;
  return overlap >= Math.min(4, Math.max(2, Math.ceil(Math.min(leftTokens.size, rightTokens.length) * 0.6)));
};

const mergeSectionsWithDetected = ({ prefix, existingSections, detectedItems, renderer }) => {
  const result = [];
  const usedExistingIndexes = new Set();

  detectedItems.forEach((item) => {
    const existingIndex = existingSections.findIndex((section, index) =>
      !usedExistingIndexes.has(index) && areRelatedTitles(section.title, item.title));
    if (existingIndex >= 0) {
      usedExistingIndexes.add(existingIndex);
      const existing = existingSections[existingIndex];
      result.push({
        id: existing.id,
        title: item.title,
        raw: renderer({ id: existing.id, ...item }),
      });
      return;
    }

    const id = nextId(prefix, result, 0);
    result.push({
      id,
      title: item.title,
      raw: renderer({ id, ...item }),
    });
  });

  existingSections.forEach((section, index) => {
    if (usedExistingIndexes.has(index)) {
      return;
    }
    const isDuplicateOfResult = result.some((item) => areRelatedTitles(item.title, section.title));
    if (!isDuplicateOfResult && isSectionSubstantive(section)) {
      result.push(section);
    }
  });

  return result;
};

export const updateReportContent = ({ existingReport = '', detectedErrors = [], detectedImprovements = [], timestamp = nowForReport() } = {}) => {
  const existingErrors = extractSections(existingReport, 'ERRO');
  const existingImprovements = extractSections(existingReport, 'MELHORIA');
  const allErrors = mergeSectionsWithDetected({
    prefix: 'ERRO',
    existingSections: existingErrors,
    detectedItems: detectedErrors,
    renderer: renderProblem,
  });
  const allImprovements = mergeSectionsWithDetected({
    prefix: 'MELHORIA',
    existingSections: existingImprovements,
    detectedItems: detectedImprovements,
    renderer: renderImprovement,
  });
  const addedErrors = Math.max(0, allErrors.length - existingErrors.length);
  const addedImprovements = Math.max(0, allImprovements.length - existingImprovements.length);
  const counts = countBySeverity(allErrors);

  const lines = [
    '# Relatório de Erros e Riscos — Projeto Alice',
    '',
    'Este arquivo é mantido pelo agente auditor de código.',
    'Ele lista problemas encontrados no projeto `alice-virtual`, com evidências, impacto, forma de confirmação e sugestão de correção futura.',
    '',
    '## Resumo atual',
    '',
    `- Total de problemas encontrados: ${allErrors.length}`,
    `- Críticos: ${counts.critical}`,
    `- Altos: ${counts.high}`,
    `- Médios: ${counts.medium}`,
    `- Baixos: ${counts.low}`,
    `- Melhorias recomendadas: ${allImprovements.length}`,
    `- Última análise: ${timestamp}`,
    '',
    '## Índice de problemas',
    '',
    ...(allErrors.length
      ? allErrors.map((item) => `- [${item.id} — ${item.title}](#${anchorForTitle(item.id, item.title)})`)
      : ['- Nenhum problema registrado.']),
    '',
  ];

  if (allImprovements.length > 0) {
    lines.push('## Índice de melhorias', '');
    lines.push(...allImprovements.map((item) => `- [${item.id} — ${item.title}](#${anchorForTitle(item.id, item.title)})`));
    lines.push('');
  }

  lines.push(...allErrors.map((item) => item.raw));

  if (allImprovements.length > 0) {
    lines.push('', '# Melhorias Recomendadas', '');
    lines.push(...allImprovements.map((item) => item.raw));
  }

  return {
    content: `${lines.join('\n').trim()}\n`,
    addedErrors,
    addedImprovements,
    totalErrors: allErrors.length,
    totalImprovements: allImprovements.length,
  };
};

export const runAuditOnce = async ({ rootDir = process.cwd(), reportPath = DEFAULT_REPORT_PATH, timestamp = nowForReport() } = {}) => {
  const absoluteReportPath = path.resolve(rootDir, reportPath);
  const existingReport = existsSync(absoluteReportPath)
    ? await readFile(absoluteReportPath, 'utf8')
    : '';
  const detected = await buildDetectedIssues(rootDir);
  const updated = updateReportContent({
    existingReport,
    detectedErrors: detected.errors,
    detectedImprovements: detected.improvements,
    timestamp,
  });
  await mkdir(path.dirname(absoluteReportPath), { recursive: true });
  await writeFile(absoluteReportPath, updated.content, 'utf8');
  return {
    ...updated,
    reportPath: absoluteReportPath,
  };
};

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const parseArgs = (argv = []) => {
  const options = {
    once: false,
    watch: false,
    intervalMs: DEFAULT_INTERVAL_MS,
    reportPath: DEFAULT_REPORT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--once') {
      options.once = true;
    } else if (arg === '--watch') {
      options.watch = true;
    } else if (arg === '--interval-ms') {
      const parsed = Number(argv[index + 1]);
      options.intervalMs = Number.isFinite(parsed) && parsed >= 10000 ? parsed : options.intervalMs;
      index += 1;
    } else if (arg === '--report') {
      options.reportPath = argv[index + 1] || options.reportPath;
      index += 1;
    }
  }

  if (!options.once && !options.watch) {
    options.once = true;
  }

  return options;
};

export const runAuditWatch = async (options = {}) => {
  while (true) {
    const result = await runAuditOnce(options);
    process.stdout.write(`[alice-auditor] ${new Date().toISOString()} ${result.reportPath} errors=${result.totalErrors} improvements=${result.totalImprovements}\n`);
    await sleep(options.intervalMs || DEFAULT_INTERVAL_MS);
  }
};

const isMainModule = () => process.argv[1] &&
  import.meta.url === new URL(`file://${path.resolve(process.argv[1]).replace(/\\/g, '/')}`).href;

if (isMainModule()) {
  const options = parseArgs(process.argv.slice(2));
  const runner = options.watch ? runAuditWatch : runAuditOnce;
  runner({
    rootDir: process.cwd(),
    reportPath: options.reportPath,
    intervalMs: options.intervalMs,
  }).then((result) => {
    if (result?.reportPath) {
      process.stdout.write(`[alice-auditor] wrote ${result.reportPath}; added errors=${result.addedErrors}; added improvements=${result.addedImprovements}\n`);
    }
  }).catch((error) => {
    process.stderr.write(`[alice-auditor] ${error?.message || String(error)}\n`);
    process.exitCode = 1;
  });
}
