# Inventario arquivo por arquivo

            O inventario detalhado foi dividido em partes para manter os arquivos navegaveis. Ele cobre 236 arquivos textuais relevantes e registra caminho, tipo, dominio, responsabilidade, uso, imports, dependentes, exports/simbolos, dados, efeitos colaterais, criticidade, risco e testes relacionados.

            ## Partes

            - [`03-inventario-arquivo-por-arquivo-parte-1.md`](./03-inventario-arquivo-por-arquivo-parte-1.md)
- [`03-inventario-arquivo-por-arquivo-parte-2.md`](./03-inventario-arquivo-por-arquivo-parte-2.md)
- [`03-inventario-arquivo-por-arquivo-parte-3.md`](./03-inventario-arquivo-por-arquivo-parte-3.md)

            ## Observacao metodologica

            - Imports/dependentes sao inferidos estaticamente para JS/Python/Rust quando possivel.
            - Chamadas Tauri por string (`invoke('nome')`) sao descritas nos fluxos e no backend, mas podem nao aparecer como dependencia reversa.
            - Arquivos binarios, builds, caches, memoria e evidencias reais foram excluidos conforme escopo.
