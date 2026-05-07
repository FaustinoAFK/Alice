export const VM_LIVE_TOOL_DECLARATIONS = [
  {
    name: 'diagnose_local_vm_setup',
    description: 'Diagnostica Hyper-V/VirtualBox e explica exatamente o que falta para executar tarefas dentro da VM local real.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'run_local_vm_smoke_test',
    description: 'Executa um smoke test seguro dentro da VM real quando configurada; se nao estiver pronta, retorna skipped sem usar fallback.',
    parameters: {
      type: 'OBJECT',
      properties: {
        timeoutMs: {
          type: 'NUMBER',
          minimum: 1,
          maximum: 60000,
        },
      },
    },
  },
  {
    name: 'install_vm_guest_agent',
    description: 'Instala ou atualiza o Guest Interaction Agent dentro da VM real. Nunca usa workspace fallback.',
    parameters: {
      type: 'OBJECT',
      properties: {
        timeoutMs: { type: 'NUMBER', minimum: 1, maximum: 60000 },
      },
    },
  },
  {
    name: 'diagnose_vm_guest_agent',
    description: 'Verifica se o agente visual dentro da VM esta online e quais capacidades visuais estao disponiveis.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'start_vm_guest_agent_resident',
    description: 'Inicia o Guest Interaction Agent visual em modo residente na VM para reduzir latencia de acoes repetidas. Mantem fallback por guestcontrol quando indisponivel.',
    parameters: {
      type: 'OBJECT',
      properties: {
        timeoutMs: { type: 'NUMBER', minimum: 1, maximum: 60000 },
        hostPort: { type: 'NUMBER', minimum: 1, maximum: 65535 },
        guestPort: { type: 'NUMBER', minimum: 1, maximum: 65535 },
      },
    },
  },
  {
    name: 'capture_vm_guest_screen',
    description: 'Captura uma screenshot real dentro da VM via Guest Interaction Agent e coleta a imagem para o host.',
    parameters: {
      type: 'OBJECT',
      properties: {
        timeoutMs: { type: 'NUMBER', minimum: 1, maximum: 60000 },
      },
    },
  },
  {
    name: 'run_vm_guest_agent_action',
    description: 'Executa uma acao visual governada dentro da VM real: mouse, teclado, texto, hotkey, captura, status ou tarefa longa em background. Requer guest agent online.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING' },
        parameters: { type: 'OBJECT' },
        timeoutMs: { type: 'NUMBER', minimum: 1, maximum: 60000 },
        taskId: { type: 'STRING' },
        correlationId: { type: 'STRING' },
      },
      required: ['action'],
    },
  },
  {
    name: 'run_vm_visual_smoke_test',
    description: 'Executa smoke test visual real na VM: abre Notepad, digita texto, captura screenshot e salva evidencia/replay.',
    parameters: {
      type: 'OBJECT',
      properties: {
        timeoutMs: { type: 'NUMBER', minimum: 1, maximum: 60000 },
      },
    },
  },
  {
    name: 'run_vm_operational_task',
    description: 'Executa uma tarefa operacional de alto nivel dentro da VM real: abrir aplicativo, instalar/baixar app via winget em background quando seguro, abrir URL, capturar tela, consultar ou cancelar progresso. Instaladores que exigem elevacao/UAC podem ser bloqueados para supervisao em vez de rodar em background.',
    parameters: {
      type: 'OBJECT',
      properties: {
        objective: {
          type: 'STRING',
          minLength: 1,
          maxLength: 600,
        },
        taskKind: {
          type: 'STRING',
          description: 'open_app | install_app | open_url | capture_screen | check_background_task | cancel_background_task. Se omitido, a Alice infere pelo objetivo.',
        },
        appName: {
          type: 'STRING',
          description: 'Nome do aplicativo quando houver, por exemplo Visual Studio Code, Visual Studio Community, VirtualBox, Explorador de Arquivos, Notepad, Edge.',
        },
        command: {
          type: 'STRING',
          description: 'Opcional. Para install_app pode ser um winget id; para open_app pode ser um executavel.',
        },
        args: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
        textToType: {
          type: 'STRING',
          description: 'Texto a digitar depois de abrir o aplicativo, quando o pedido combinar abrir app e escrever/digitar algo.',
        },
        url: {
          type: 'STRING',
          maxLength: 2048,
        },
        backgroundTaskId: {
          type: 'STRING',
          description: 'ID retornado por instalacoes/downloads em background, usado para consultar ou cancelar.',
        },
        timeoutMs: {
          type: 'NUMBER',
          minimum: 1,
          maximum: 60000,
        },
      },
      required: ['objective'],
    },
  },
];
