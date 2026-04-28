import { Handle, Position } from '@xyflow/react';
import React from 'react';

const COLORS = [
  { id: 'default', bg: 'rgba(30, 32, 45, 0.65)', border: 'rgba(109, 40, 217, 0.4)' },
  { id: 'green', bg: 'rgba(20, 83, 45, 0.65)', border: 'rgba(34, 197, 94, 0.4)' },
  { id: 'red', bg: 'rgba(127, 29, 29, 0.65)', border: 'rgba(239, 68, 68, 0.4)' },
  { id: 'blue', bg: 'rgba(30, 58, 138, 0.65)', border: 'rgba(59, 130, 246, 0.4)' },
  { id: 'gold', bg: 'rgba(113, 63, 18, 0.65)', border: 'rgba(234, 179, 8, 0.4)' }
];

const STATUS_LABELS = {
  pending: 'Pendente',
  in_progress: 'Em progresso',
  done: 'Feito',
  failed: 'Falhou',
  blocked: 'Bloqueado',
  unknown: 'Indefinido',
};

const TYPE_LABELS = {
  task: 'Tarefa',
  goal: 'Goal',
  idea: 'Ideia',
  resource: 'Recurso',
  blocker: 'Bloqueio',
  note: 'Nota',
};

const CustomNode = ({ id, data, isConnectable, selected }) => {
  const onChange = (evt) => {
    if (!data.readOnly && data.onChange) {
      data.onChange(id, evt.target.value);
    }
  };

  const onFocus = () => {
    if (!data.readOnly && data.onEditStart) {
      data.onEditStart(id);
    }
  };

  const onBlur = () => {
    if (data.onEditEnd) {
      data.onEditEnd(id);
    }
  };

  const currentColor = COLORS.find(c => c.id === data.color) || COLORS[0];
  const status = data.status || 'unknown';
  const nodeType = data.nodeType || 'idea';

  return (
    <div
      className={`custom-node custom-node--${status} custom-node-type--${nodeType} ${selected ? 'selected' : ''} ${data.dimmed ? 'dimmed' : ''}`}
      style={{
        '--node-bg': currentColor.bg,
        '--node-border': currentColor.border
      }}
    >
      {selected && !data.readOnly && (
        <div className="color-picker nodrag">
          {COLORS.map(c => (
            <button
              key={c.id}
              className="color-btn"
              style={{ background: c.border.replace('0.4', '1') }}
              onClick={() => data.onColorChange && data.onColorChange(id, c.id)}
              title={`Cor ${c.id}`}
              aria-label={`Aplicar cor ${c.id}`}
            />
          ))}
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="custom-handle"
      />
      <div className="node-content">
        <div className="node-meta-row">
          <span className="node-type-pill">{TYPE_LABELS[nodeType] || TYPE_LABELS.idea}</span>
          <span className="node-status-pill">{STATUS_LABELS[status] || STATUS_LABELS.unknown}</span>
        </div>
        <div className="size-measurer" aria-hidden="true">
          {(data.label || '') + ' '}
        </div>
        <textarea
          id={`text-${id}`}
          name={`text-${id}`}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          className="nodrag node-input"
          value={data.label}
          placeholder="Ideia..."
          rows={1}
          readOnly={Boolean(data.readOnly)}
        />
      </div>

      {data.hasChildren && (
        <button
          className="fold-btn nodrag"
          onClick={() => !data.readOnly && data.onToggleFold && data.onToggleFold(id)}
          title={data.isCollapsed ? 'Expandir descendentes' : 'Ocultar descendentes'}
          aria-label={data.isCollapsed ? 'Expandir descendentes' : 'Ocultar descendentes'}
        >
          {data.isCollapsed ? '+' : '-'}
        </button>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="a"
        isConnectable={isConnectable}
        className="custom-handle"
      />
    </div>
  );
};

export default CustomNode;
