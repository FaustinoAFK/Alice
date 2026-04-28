import {
  VM_VISUAL_ACTIONS,
  normalizeText,
} from './contracts';

const APP_CATALOG = [
  {
    aliases: ['visual studio community', 'visual studio 2022 community', 'visual studio'],
    displayName: 'Visual Studio Community 2022',
    wingetId: 'Microsoft.VisualStudio.2022.Community',
    openCommand: 'devenv.exe',
    installNotes:
      'Visual Studio Community e grande; a instalacao pode demorar bastante e exigir escolhas/workloads depois.',
  },
  {
    aliases: ['visual studio code', 'vs code', 'vscode', 'code'],
    displayName: 'Visual Studio Code',
    wingetId: 'Microsoft.VisualStudioCode',
    openCommand: 'code',
  },
  {
    aliases: ['explorador de arquivos', 'explorer', 'file explorer', 'arquivos'],
    displayName: 'Explorador de Arquivos',
    openCommand: 'explorer.exe',
  },
  {
    aliases: ['bloco de notas', 'notepad'],
    displayName: 'Bloco de Notas',
    openCommand: 'notepad.exe',
  },
  {
    aliases: ['edge', 'microsoft edge', 'navegador'],
    displayName: 'Microsoft Edge',
    wingetId: 'Microsoft.Edge',
    openCommand: 'msedge.exe',
  },
  {
    aliases: ['google chrome', 'chrome'],
    displayName: 'Google Chrome',
    wingetId: 'Google.Chrome',
    openCommand: 'chrome.exe',
  },
  {
    aliases: ['firefox', 'mozilla firefox'],
    displayName: 'Mozilla Firefox',
    wingetId: 'Mozilla.Firefox',
    openCommand: 'firefox.exe',
  },
  {
    aliases: ['spotify'],
    displayName: 'Spotify',
    wingetId: 'Spotify.Spotify',
    openCommand: 'spotify.exe',
  },
];

const INSTALL_WORDS = [
  'instala',
  'instale',
  'instalar',
  'baixar',
  'baixa',
  'baixe',
  'download',
  'setup',
];

const OPEN_WORDS = ['abre', 'abrir', 'abra', 'inicia', 'iniciar', 'rode', 'roda', 'executa'];

const slug = (value) =>
  normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const includesAny = (text, words) => words.some((word) => text.includes(word));

const cleanTextToType = (value = '') =>
  normalizeText(value)
    .replace(/^["'“”]+|["'“”.,;:!?]+$/g, '')
    .replace(/\s+(?:na|no|dentro da|dentro do)\s+(?:vm|maquina virtual|máquina virtual|bloco de notas|notepad)$/i, '')
    .trim();

export const extractVmTextToType = (objective = '', explicitText = '') => {
  const providedText = cleanTextToType(explicitText);
  if (providedText) {
    return providedText;
  }

  const text = normalizeText(objective);
  const match = /\b(?:escreva|escrever|escreve|digite|digitar|digita|insira|inserir)\s+(.+)$/i.exec(text);
  if (!match?.[1]) {
    return '';
  }

  return cleanTextToType(match[1]);
};

export const resolveVmApp = (input = '') => {
  const text = normalizeText(input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return APP_CATALOG.find((app) =>
    app.aliases.some((alias) =>
      text.includes(alias.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()),
    ),
  ) || null;
};

export const inferVmOperationalTaskKind = ({ objective = '', taskKind = '' } = {}) => {
  const normalizedKind = normalizeText(taskKind).toLowerCase();
  if (normalizedKind) {
    return normalizedKind;
  }

  const text = normalizeText(objective).toLowerCase();
  if (includesAny(text, INSTALL_WORDS)) {
    return 'install_app';
  }
  if (includesAny(text, OPEN_WORDS)) {
    return 'open_app';
  }
  if (text.includes('status') || text.includes('progresso') || text.includes('acompanha')) {
    return 'check_background_task';
  }
  if (text.includes('screenshot') || text.includes('captura') || text.includes('tela')) {
    return 'capture_screen';
  }
  return 'open_app';
};

export const createVmOperationalTaskPlan = ({
  objective = '',
  taskKind = '',
  appName = '',
  command = '',
  args = [],
  textToType = '',
  url = '',
  backgroundTaskId = '',
  timeoutMs,
} = {}) => {
  const normalizedObjective = normalizeText(objective);
  const kind = inferVmOperationalTaskKind({ objective: normalizedObjective, taskKind });
  const app = resolveVmApp(`${appName} ${normalizedObjective}`);
  const resolvedBackgroundTaskId =
    normalizeText(backgroundTaskId) ||
    `vm-bg-${slug(app?.displayName || appName || normalizedObjective || kind)}-${Date.now()}`;

  if (kind === 'capture_screen') {
    return {
      ok: true,
      kind,
      message: 'Capturar tela atual da VM.',
      nativeTool: 'capture_vm_guest_screen',
      nativeArgs: { request: { timeoutMs } },
      app,
      backgroundTaskId: '',
    };
  }

  if (kind === 'check_background_task') {
    if (!backgroundTaskId) {
      return {
        ok: false,
        kind,
        reason: 'background_task_id_required',
        message: 'Para acompanhar progresso preciso do backgroundTaskId retornado quando a tarefa foi iniciada.',
      };
    }
    return {
      ok: true,
      kind,
      message: 'Consultar status de tarefa em background dentro da VM.',
      nativeTool: 'run_vm_guest_agent_action',
      nativeArgs: {
        request: {
          action: VM_VISUAL_ACTIONS.GET_BACKGROUND_COMMAND_STATUS,
          parameters: { background_task_id: backgroundTaskId },
          timeoutMs: timeoutMs || 15000,
          taskId: backgroundTaskId,
          correlationId: backgroundTaskId,
        },
      },
      app,
      backgroundTaskId,
    };
  }

  if (kind === 'cancel_background_task') {
    if (!backgroundTaskId) {
      return {
        ok: false,
        kind,
        reason: 'background_task_id_required',
        message: 'Para cancelar preciso do backgroundTaskId retornado quando a tarefa foi iniciada.',
      };
    }
    return {
      ok: true,
      kind,
      message: 'Cancelar tarefa em background dentro da VM.',
      nativeTool: 'run_vm_guest_agent_action',
      nativeArgs: {
        request: {
          action: VM_VISUAL_ACTIONS.CANCEL_BACKGROUND_COMMAND,
          parameters: { background_task_id: backgroundTaskId },
          timeoutMs: timeoutMs || 15000,
          taskId: backgroundTaskId,
          correlationId: backgroundTaskId,
        },
      },
      app,
      backgroundTaskId,
    };
  }

  if (kind === 'install_app') {
    const wingetId = normalizeText(command) || app?.wingetId;
    if (!wingetId) {
      return {
        ok: false,
        kind,
        reason: 'unknown_app_install_command',
        message:
          'Nao reconheci o aplicativo para instalar. Informe appName conhecido ou command com o id do winget.',
      };
    }

    const installArgs = args.length > 0
      ? args
      : [
          'install',
          '--id',
          wingetId,
          '-e',
          '--accept-source-agreements',
          '--accept-package-agreements',
        ];

    return {
      ok: true,
      kind,
      message: `Instalacao iniciada em background na VM: ${app?.displayName || wingetId}.`,
      nativeTool: 'run_vm_guest_agent_action',
      nativeArgs: {
        request: {
          action: VM_VISUAL_ACTIONS.START_BACKGROUND_COMMAND,
          parameters: {
            command: 'winget.exe',
            args: installArgs,
            timeout_seconds: 7200,
            background_task_id: resolvedBackgroundTaskId,
          },
          timeoutMs: timeoutMs || 15000,
          taskId: resolvedBackgroundTaskId,
          correlationId: resolvedBackgroundTaskId,
        },
      },
      app,
      backgroundTaskId: resolvedBackgroundTaskId,
      notes: app?.installNotes || '',
    };
  }

  if (kind === 'open_url') {
    if (!url) {
      return {
        ok: false,
        kind,
        reason: 'url_required',
        message: 'Para abrir uma pagina na VM preciso da URL.',
      };
    }
    return {
      ok: true,
      kind,
      message: `Abrir URL na VM: ${url}.`,
      nativeTool: 'run_vm_guest_agent_action',
      nativeArgs: {
        request: {
          action: VM_VISUAL_ACTIONS.RUN_COMMAND,
          parameters: {
            command: 'cmd.exe',
            args: ['/c', 'start', '', url],
            timeout_seconds: 10,
          },
          timeoutMs: timeoutMs || 15000,
        },
      },
      app,
      backgroundTaskId: '',
    };
  }

  const openCommand = normalizeText(command) || app?.openCommand;
  const resolvedTextToType = extractVmTextToType(normalizedObjective, textToType);
  if (!openCommand) {
    return {
      ok: false,
      kind,
      reason: 'unknown_app_open_command',
      message:
        'Nao reconheci o aplicativo para abrir. Informe appName conhecido ou command com o executavel.',
    };
  }

  return {
    ok: true,
    kind: 'open_app',
    message: `Abrir aplicativo na VM: ${app?.displayName || openCommand}.`,
    nativeTool: 'run_vm_guest_agent_action',
    nativeArgs: {
      request: {
        action: VM_VISUAL_ACTIONS.RUN_COMMAND,
        parameters: {
          command: 'cmd.exe',
          args: ['/c', 'start', '', openCommand, ...args],
          timeout_seconds: 10,
        },
        timeoutMs: timeoutMs || 15000,
      },
    },
    followUpActions: resolvedTextToType
      ? [
          {
            action: VM_VISUAL_ACTIONS.WAIT,
            parameters: { duration_ms: 1200 },
            timeoutMs: Math.max(2000, Math.min(Number(timeoutMs || 15000), 15000)),
          },
          {
            action: VM_VISUAL_ACTIONS.TYPE_TEXT,
            parameters: { text: resolvedTextToType, method: 'auto' },
            timeoutMs: timeoutMs || 15000,
          },
        ]
      : [],
    textToType: resolvedTextToType,
    app,
    backgroundTaskId: '',
  };
};
