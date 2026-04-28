import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import CustomNode from './CustomNode';

vi.mock('@xyflow/react', () => ({
  Handle: ({ className }) => <span className={className} />,
  Position: { Left: 'left', Right: 'right' },
}));

describe('CustomNode', () => {
  it('renders status and type markers for operational nodes', () => {
    const html = renderToString(
      <CustomNode
        id="task"
        selected={false}
        isConnectable
        data={{
          label: 'Rodar testes',
          status: 'blocked',
          nodeType: 'task',
          color: 'default',
          readOnly: true,
        }}
      />,
    );

    expect(html).toContain('custom-node--blocked');
    expect(html).toContain('Tarefa');
    expect(html).toContain('Bloqueado');
  });
});
