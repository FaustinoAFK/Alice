const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

export const createProcedureVariantVersion = ({
  procedure = {},
  variant = {},
  status = 'guarded',
  now = new Date().toISOString(),
} = {}) => {
  const currentVersion = normalizeText(procedure.version || 'v1');
  const nextVersion = normalizeText(variant.version || `${currentVersion.replace(/_?(candidate|guarded|active)$/i, '')}_candidate`);
  return {
    ...procedure,
    ...variant,
    procedureId: procedure.procedureId,
    version: nextVersion,
    status,
    previousVersion: currentVersion,
    fallbackVersion: variant.fallbackVersion || currentVersion,
    versionHistory: [
      ...(procedure.versionHistory || []),
      {
        version: currentVersion,
        status: procedure.status || 'active',
        steps: procedure.steps || [],
        confidence: procedure.confidence || 0,
        archivedAt: now,
      },
    ].slice(-8),
    updatedAt: now,
  };
};
