export const ALICE_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
export const ALICE_SYSTEM_INSTRUCTION = [
  'Voce e Alice, uma assistente com personalidade propria, memoria de longo prazo e presenca forte.',
  'Seu arquetipo base e playful_confident: espirituosa, confiante, calorosa e provocadora de leve.',
  'Em conversa, soe natural, afiada e humana sem virar personagem exagerada.',
  'Use portugues do Brasil. Pode usar girias e criar girias, mas evite muitos palavroes.',
  'Voce tem iniciativa conversacional: percebe contexto, comenta quando for util e faz perguntas boas.',
  'Voce nao e submissa nem generica. Voce tem ponto de vista.',
  'Voce pode usar ferramentas locais de conhecimento web para entender a pagina atual e pesquisar melhor quando isso ajudar.',
  'Se a pergunta parecer ser sobre a pagina atual, use inspect_current_page antes de sair pesquisando na web.',
  'inspect_current_page ja pode atualizar a pagina, seguir links internos, buscar no mesmo dominio e cair para a web geral; leia finalOrigin, finalSufficiency, consultedSources e responseGuidance antes de chamar outra ferramenta.',
  'Chame search_same_domain ou search_web separadamente apenas quando a pessoa pedir uma nova busca ou quando a resposta anterior da ferramenta continuar claramente insuficiente.',
  'Use get_navigation_context quando precisar confirmar em que pagina ou dominio voce esta.',
  'Quando uma ferramenta devolver responseGuidance, siga essa orientacao para explicar de onde veio a resposta e se deve citar fontes.',
  'Quando receber "Contexto operacional atual da Alice", use como mapa de contexto, nao como pedido do usuario. Ele serve para escolher a fonte certa antes de responder.',
  'Ordem de contexto: fala atual do usuario vence; texto selecionado/pagina ativa vence para perguntas como "isso", "aqui", "nessa pagina"; tela compartilhada vence para estado visual; VM vence para pedidos dentro da VM; memoria so complementa.',
  'Quando usar fontes externas, responda com um resumo curto e inclua links uteis.',
  'Nao faca resumo por iniciativa propria. Resuma paginas, textos ou fontes somente quando a pessoa pedir explicitamente resumo, resumir, sintetizar ou algo equivalente.',
  'Quando a pessoa fizer uma pergunta especifica, responda diretamente a pergunta em vez de resumir o conteudo inteiro.',
  'Quando a pessoa perguntar o que voce esta vendo, onde algo esta na tela, ou pedir ajuda visual, responda primeiro pelo frame visual da tela compartilhada, nao pela memoria nem por suposicao.',
  'Se o conteudo visual estiver pequeno, cortado, borrado ou incerto, diga exatamente essa limitacao e peca zoom, tela inteira ou selecao da janela correta.',
  'Para texto de paginas web, artigos, documentacoes e resultados abertos no navegador, prefira as ferramentas web e o DOM real da extensao antes de tentar ler pelo frame visual.',
  'Use a tela compartilhada para estado visual, layout, janelas, botoes, imagens e o que esta aberto agora; use o DOM da pagina para leitura textual precisa.',
  'Voce tambem tem ferramentas de aprendizado operacional autonomo integradas ao fluxo oficial da Alice em JS/Tauri.',
  'Voce pode manter mapas mentais persistentes no HUD usando update_mind_map para criar, editar, conectar, organizar e exportar topicos quando isso ajudar o usuario a visualizar raciocinio, plano, goal ou arquitetura.',
  'Ao atualizar mapas mentais, prefira operacoes pequenas e estruturadas. Se uma operacao falhar, preserve o mapa atual e explique o motivo.',
  'Pedido explicito do usuario tem prioridade maxima: se houver tarefa em background, planeje pausar ou rebaixar antes de atender o pedido atual.',
  'A VM playground real depende de provedor local configurado. Quando nao houver provedor, o sistema pode usar workspace local fallback somente para tarefas permitidas.',
  'Workspace local fallback usa copias e nao e VM real; deixe essa diferenca clara.',
  'Para controle visual dentro da VM real, use Guest Interaction Layer: diagnostique/instale o agente, capture screenshot, execute acao visual e valide com replay. Nunca use fallback local fingindo controle visual de VM.',
  'Quando o usuario pedir algo operacional dentro da VM como abrir aplicativo, digitar texto em aplicativo aberto, instalar, baixar, testar um programa ou acompanhar progresso, use run_vm_operational_task antes de pesquisar. Pesquisa so entra para descobrir um comando/id ausente ou explicar erro real.',
  'Para downloads/instalacoes longas dentro da VM, prefira run_vm_operational_task com taskKind=install_app; ele inicia em background e devolve backgroundTaskId. Depois acompanhe com taskKind=check_background_task. Nao espere instaladores grandes em chamadas sincronas curtas.',
  'Para tarefas grandes com varios passos, fila, retry, evidencias e validacao continua, use manage_autonomous_runner para enfileirar e controlar o Autonomous Task Runner. Nao trate task planned/running como concluida sem evidencia validada.',
  'Acoes visuais dentro da VM passam pelo DecisionEngine/policy; coordenadas sao fallback e precisam de motivo, screenshot antes/depois e validacao.',
  'No PC real, qualquer acao relevante precisa considerar snapshot, diff, validacao e rollback antes de aplicar.',
  'Auto-melhoria da Alice deve virar proposta com riscos, testes e rollback; nunca aplique mudanca no codigo oficial por iniciativa propria.',
  'Aprendizado operacional so vira confiavel quando a validacao tiver evidencia substantiva, nao apenas ausencia de erro.',
  'Responda de forma curta por padrao, com presenca, humor leve e clareza.',
].join('\n');

export const ALICE_LIVE_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'get_navigation_context',
        description: 'Retorna o contexto da pagina atual observada no navegador: URL, dominio, titulo e texto selecionado.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'inspect_current_page',
        description: 'Inspeciona em profundidade a pagina atual e retorna secoes, links e uma avaliacao preliminar de suficiencia para a pergunta.',
        parameters: {
          type: 'OBJECT',
          properties: {
            question: {
              type: 'STRING',
              minLength: 1,
              maxLength: 400,
            },
            maxSections: {
              type: 'NUMBER',
              minimum: 1,
              maximum: 8,
            },
          },
          required: ['question'],
        },
      },
      {
        name: 'search_same_domain',
        description: 'Pesquisa paginas relacionadas no mesmo dominio do site atual.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              minLength: 1,
              maxLength: 400,
            },
            domain: {
              type: 'STRING',
              minLength: 1,
              maxLength: 255,
            },
            maxResults: {
              type: 'NUMBER',
              minimum: 1,
              maximum: 10,
            },
          },
          required: ['query', 'domain'],
        },
      },
      {
        name: 'search_web',
        description: 'Pesquisa a web geral por fontes externas relevantes.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              minLength: 1,
              maxLength: 400,
            },
            maxResults: {
              type: 'NUMBER',
              minimum: 1,
              maximum: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'fetch_web_page',
        description: 'Le e estrutura o conteudo principal de uma pagina web especifica para aprofundar a resposta.',
        parameters: {
          type: 'OBJECT',
          properties: {
            url: {
              type: 'STRING',
              minLength: 1,
              maxLength: 2048,
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'update_mind_map',
        description: 'Cria, atualiza, organiza ou exporta o mapa mental ativo do HUD da Alice de forma estruturada e segura.',
        parameters: {
          type: 'OBJECT',
          properties: {
            operation: {
              type: 'STRING',
              description: 'replace | add_node | add_edge | rename_node | remove_node | remove_edge | layout | export | set_status | mark_done | mark_failed | mark_blocked | mark_in_progress | batch | rollback',
            },
            payload: {
              type: 'OBJECT',
              description: 'Dados da operacao. Para add_node use label, type/status opcionais, parentId opcional, color e position. Para add_edge use source e target. Para set_status use nodeId e status. Para batch use operations[]. Para export use format json ou markdown.',
            },
            targetMapId: {
              type: 'STRING',
              description: 'Opcional. ID do mapa alvo; quando omitido, usa o mapa mental ativo.',
            },
          },
          required: ['operation'],
        },
      },
      {
        name: 'get_autonomous_learning_status',
        description: 'Mostra o estado operacional do aprendizado autonomo: tarefas, VM local real quando configurada, workspace fallback, propostas, riscos, rollbacks e logs.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'manage_autonomous_runner',
        description: 'Controla o Autonomous Task Runner oficial: status, ligar/desligar, pausar/retomar, enfileirar task grande, cancelar, bloquear, reexecutar e reordenar fila. Use para tarefas grandes com steps, evidencias e validacao.',
        parameters: {
          type: 'OBJECT',
          properties: {
            operation: {
              type: 'STRING',
              description: 'status | enable | disable | pause | resume | enqueue_task | cancel_task | cancel_queue | block_task | rerun_task | reorder_task',
            },
            taskId: { type: 'STRING' },
            queueRank: { type: 'NUMBER' },
            reason: { type: 'STRING' },
            title: { type: 'STRING' },
            description: { type: 'STRING' },
            command: { type: 'STRING' },
            args: { type: 'ARRAY', items: { type: 'STRING' } },
            priority: { type: 'STRING', description: 'critical | high | medium | low' },
            requiresRealVm: { type: 'BOOLEAN' },
            allowWorkspaceFallback: { type: 'BOOLEAN' },
            riskLevel: { type: 'STRING' },
            sourceFiles: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  path: { type: 'STRING' },
                  content: { type: 'STRING' },
                  targetPath: { type: 'STRING' },
                  contentHash: { type: 'STRING' },
                  sizeBytes: { type: 'NUMBER' },
                },
              },
            },
            steps: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  type: { type: 'STRING' },
                  action: { type: 'OBJECT' },
                  completionCriteria: { type: 'OBJECT' },
                  expectedEvidence: { type: 'OBJECT' },
                  timeoutPolicy: { type: 'OBJECT' },
                  retryPolicy: { type: 'OBJECT' },
                },
              },
            },
            task: { type: 'OBJECT' },
            payload: { type: 'OBJECT' },
          },
          required: ['operation'],
        },
      },
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
        description: 'Executa uma tarefa operacional de alto nivel dentro da VM real: abrir aplicativo, instalar/baixar app via winget em background, abrir URL, capturar tela, consultar ou cancelar progresso. Use para pedidos praticos na VM antes de pesquisar.',
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
              description: 'Nome do aplicativo quando houver, por exemplo Visual Studio Code, Visual Studio Community, Explorador de Arquivos, Notepad, Edge.',
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
      {
        name: 'plan_autonomous_task',
        description: 'Planeja uma tarefa operacional no fluxo oficial da Alice. Usa VM local real quando configurada ou workspace fallback honesto quando permitido.',
        parameters: {
          type: 'OBJECT',
          properties: {
            taskType: { type: 'STRING' },
            reason: { type: 'STRING' },
            environment: { type: 'STRING' },
            riskLevel: { type: 'STRING' },
            priority: { type: 'STRING' },
            executionMode: { type: 'STRING' },
            targetFiles: { type: 'ARRAY', items: { type: 'STRING' } },
            targetApps: { type: 'ARRAY', items: { type: 'STRING' } },
            affectsOfficialCode: { type: 'BOOLEAN' },
            requiresSystemAccess: { type: 'BOOLEAN' },
            usesRealFilesDirectly: { type: 'BOOLEAN' },
            requiresRealVm: { type: 'BOOLEAN' },
            allowWorkspaceFallback: { type: 'BOOLEAN' },
            command: {
              type: 'STRING',
              description: 'Executavel permitido para rodar no ambiente selecionado. No fallback, roda em workspace local copiado, nao em VM real.',
            },
            args: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Argumentos passados diretamente ao executavel permitido, sem shell intermediario.',
            },
            timeoutMs: {
              type: 'NUMBER',
              minimum: 1,
              maximum: 60000,
            },
            sourceFiles: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  path: { type: 'STRING' },
                  content: { type: 'STRING' },
                  targetPath: { type: 'STRING' },
                  contentHash: { type: 'STRING' },
                  sizeBytes: { type: 'NUMBER' },
                  directAccess: { type: 'BOOLEAN' },
                },
              },
            },
            requestedResources: {
              type: 'OBJECT',
              properties: {
                cpuPercent: { type: 'NUMBER' },
                ramMb: { type: 'NUMBER' },
                diskMb: { type: 'NUMBER' },
              },
            },
            hostResources: {
              type: 'OBJECT',
              properties: {
                cpuPercent: { type: 'NUMBER' },
                ramMb: { type: 'NUMBER' },
                diskMb: { type: 'NUMBER' },
              },
            },
            userConfirmed: { type: 'BOOLEAN' },
          },
        },
      },
      {
        name: 'create_host_change_snapshot',
        description: 'Cria snapshot fisico dos arquivos do PC real antes de acao relevante, com manifesto e base para rollback.',
        parameters: {
          type: 'OBJECT',
          properties: {
            actionId: { type: 'STRING' },
            reason: { type: 'STRING' },
            files: { type: 'ARRAY', items: { type: 'STRING' } },
            targetFiles: { type: 'ARRAY', items: { type: 'STRING' } },
            taskId: { type: 'STRING' },
            declaredFiles: { type: 'ARRAY', items: { type: 'STRING' } },
            plannedOperations: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  file: { type: 'STRING' },
                  operation: { type: 'STRING' },
                },
              },
            },
          },
        },
      },
      {
        name: 'record_host_file_checkpoint',
        description: 'Registra checkpoint antes/depois de escrita controlada para melhorar classificacao de conflito no rollback fisico.',
        parameters: {
          type: 'OBJECT',
          properties: {
            snapshotId: { type: 'STRING' },
            file: { type: 'STRING' },
            stage: { type: 'STRING' },
            taskId: { type: 'STRING' },
            operation: { type: 'STRING' },
          },
          required: ['snapshotId', 'file', 'stage'],
        },
      },
      {
        name: 'create_self_improvement_proposal',
        description: 'Cria uma proposta de auto-melhoria da Alice. A proposta exige aprovacao do usuario e nao e aplicada automaticamente.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            description: { type: 'STRING' },
            reason: { type: 'STRING' },
            affectedFiles: { type: 'ARRAY', items: { type: 'STRING' } },
            riskLevel: { type: 'STRING' },
            beforeMetrics: { type: 'OBJECT' },
            afterMetrics: { type: 'OBJECT' },
            testsRun: { type: 'ARRAY', items: { type: 'STRING' } },
            validationReport: { type: 'OBJECT' },
            rollbackPlan: { type: 'OBJECT' },
            patchSummary: { type: 'STRING' },
            patch: { type: 'STRING' },
            diff: { type: 'STRING' },
            vmTestReport: { type: 'OBJECT' },
            comparisonReport: { type: 'OBJECT' },
          },
        },
      },
      {
        name: 'approve_self_improvement_proposal',
        description: 'Registra aprovacao ou rejeicao de uma proposta de auto-melhoria. Mesmo aprovada, ela so fica pronta se tiver patch separado e validacao.',
        parameters: {
          type: 'OBJECT',
          properties: {
            proposalId: { type: 'STRING' },
            userApproved: { type: 'BOOLEAN' },
          },
          required: ['proposalId', 'userApproved'],
        },
      },
      {
        name: 'record_validated_learning',
        description: 'Registra aprendizado operacional; so promove para procedimento oficial quando a validacao tiver evidencia real.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            summary: { type: 'STRING' },
            steps: { type: 'ARRAY', items: { type: 'STRING' } },
            source: { type: 'STRING' },
            confidence: { type: 'NUMBER' },
            validationChecks: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  type: { type: 'STRING' },
                  label: { type: 'STRING' },
                  passed: { type: 'BOOLEAN' },
                  evidence: { type: 'STRING' },
                },
              },
            },
            requiredEvidence: { type: 'ARRAY', items: { type: 'STRING' } },
            commandResult: { type: 'OBJECT' },
          },
        },
      },
      {
        name: 'record_research_finding',
        description: 'Registra pesquisa operacional com fontes, riscos e plano testavel. Pesquisa deve ajudar a agir, nao virar loop.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING' },
            findings: { type: 'ARRAY', items: { type: 'OBJECT' } },
            recommendedApproach: { type: 'STRING' },
            alternatives: { type: 'ARRAY', items: { type: 'STRING' } },
            risks: { type: 'ARRAY', items: { type: 'STRING' } },
            confidence: { type: 'NUMBER' },
            testPlan: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['query'],
        },
      },
      {
        name: 'inspect_project_context',
        description: 'Analisa arquivos de projeto, comandos, linguagens e riscos antes de enviar copias para VM/workspace ou alterar PC real.',
        parameters: {
          type: 'OBJECT',
          properties: {
            files: { type: 'ARRAY', items: { type: 'STRING' } },
            targetFiles: { type: 'ARRAY', items: { type: 'STRING' } },
            packageJson: { type: 'OBJECT' },
          },
        },
      },
      {
        name: 'report_unexpected_risk',
        description: 'Registra risco inesperado no PC real e aciona rollback fisico quando snapshotId existir; sem snapshotId usa fallback logico de auditoria.',
        parameters: {
          type: 'OBJECT',
          properties: {
            actionId: { type: 'STRING' },
            snapshotId: { type: 'STRING' },
            reason: { type: 'STRING' },
            riskLevel: { type: 'STRING' },
            snapshotFiles: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  path: { type: 'STRING' },
                  content: { type: 'STRING' },
                },
              },
            },
            currentFiles: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  path: { type: 'STRING' },
                  content: { type: 'STRING' },
                },
              },
            },
          },
        },
      },
    ],
  },
];

export const createAliceLiveSetup = (options = {}) => {
  const normalizedOptions = typeof options === 'string' ? { model: options } : options;
  const model = normalizedOptions.model || ALICE_LIVE_MODEL;
  const tools = Object.prototype.hasOwnProperty.call(normalizedOptions, 'tools')
    ? normalizedOptions.tools
    : ALICE_LIVE_TOOLS;
  const systemInstruction =
    normalizedOptions.systemInstruction || ALICE_SYSTEM_INSTRUCTION;
  const resumptionHandle =
    typeof normalizedOptions.resumptionHandle === 'string'
      ? normalizedOptions.resumptionHandle.trim()
      : '';
  const memoryPrefixTurns = Array.isArray(normalizedOptions.memoryPrefixTurns)
    ? normalizedOptions.memoryPrefixTurns.filter(Boolean)
    : [];

  const setup = {
    model: `models/${model}`,
    generationConfig: {
      responseModalities: ['AUDIO'],
      temperature: 0.7,
      mediaResolution: 'MEDIA_RESOLUTION_MEDIUM',
    },
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    realtimeInputConfig: {
      turnCoverage: 'TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO',
    },
    contextWindowCompression: {
      slidingWindow: {},
    },
    tools,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };

  if (resumptionHandle) {
    setup.sessionResumption = {
      handle: resumptionHandle,
    };
  }

  if (memoryPrefixTurns.length > 0) {
    setup.historyConfig = {
      initialHistoryInClientContent: true,
    };
  }

  return setup;
};
