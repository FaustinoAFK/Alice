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

