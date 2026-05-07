export const createLearningPlannerHudRequest = (objective = '') => ({
  objective: String(objective || '').trim(),
});
