# Memory Boundary

Fronteira futura para dividir a memoria persistente por dominio mantendo `src/aliceMemory.js` como facade compativel.

Qualquer extracao deve preservar `ALICE_MEMORY_SCHEMA_VERSION`, migracoes existentes, pruning e compatibilidade do arquivo `alice-memory.json`.
