import { describe, expect, it } from 'vitest';
import {
  parseArgs,
  updateReportContent,
} from './alice-code-auditor.mjs';

const detectedError = {
  title: 'Bridge local de conhecimento aceita escrita cross-origin sem autenticação nem limite de corpo',
  severity: 'Alta',
  module: 'Ponte local',
  files: ['src-tauri/src/web_knowledge.rs'],
  summary: 'Resumo',
  evidence: 'Evidência',
  impact: 'Impacto',
  scenario: 'Cenário',
  confirmation: 'Confirmação',
  suggestion: 'Sugestão',
  priority: 'P1',
};

const detectedImprovement = {
  title: 'Criar comando único de validação completa do projeto',
  priority: 'P2',
  module: 'Scripts',
  files: ['package.json'],
  evidence: 'Evidência',
  value: 'Valor técnico',
  risk: 'Risco',
  confirmation: 'Confirmação',
  suggestion: 'Sugestão',
};

describe('alice code auditor local script', () => {
  it('defaults to a single audit pass', () => {
    expect(parseArgs([])).toMatchObject({
      once: true,
      watch: false,
      reportPath: 'erros.md',
    });
  });

  it('parses watch mode and interval', () => {
    expect(parseArgs(['--watch', '--interval-ms', '60000', '--report', 'tmp/report.md'])).toMatchObject({
      once: false,
      watch: true,
      intervalMs: 60000,
      reportPath: 'tmp/report.md',
    });
  });

  it('creates a report with errors and improvements', () => {
    const result = updateReportContent({
      existingReport: '',
      detectedErrors: [detectedError],
      detectedImprovements: [detectedImprovement],
      timestamp: '2026-05-01 12:00:00 -04:00',
    });

    expect(result.addedErrors).toBe(1);
    expect(result.addedImprovements).toBe(1);
    expect(result.content).toContain('# Relatório de Erros e Riscos — Projeto Alice');
    expect(result.content).toContain('## ERRO-0001 — Bridge local');
    expect(result.content).toContain('## MELHORIA-0001 — Criar comando único');
    expect(result.content).toContain('- Melhorias recomendadas: 1');
  });

  it('preserves existing entries and avoids duplicates by title', () => {
    const first = updateReportContent({
      existingReport: '',
      detectedErrors: [detectedError],
      detectedImprovements: [detectedImprovement],
      timestamp: '2026-05-01 12:00:00 -04:00',
    });
    const second = updateReportContent({
      existingReport: first.content,
      detectedErrors: [detectedError],
      detectedImprovements: [detectedImprovement],
      timestamp: '2026-05-01 12:01:00 -04:00',
    });

    expect(second.addedErrors).toBe(0);
    expect(second.addedImprovements).toBe(0);
    expect(second.totalErrors).toBe(1);
    expect(second.totalImprovements).toBe(1);
    expect(second.content.match(/^## ERRO-0001/gm)).toHaveLength(1);
    expect(second.content.match(/^## MELHORIA-0001/gm)).toHaveLength(1);
  });
});
