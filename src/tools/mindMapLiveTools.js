export const MIND_MAP_LIVE_TOOL_DECLARATIONS = [
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
];
