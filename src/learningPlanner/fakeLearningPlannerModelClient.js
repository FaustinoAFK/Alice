export const createFakeLearningPlannerModelAdapter = ({
  response = null,
  error = null,
  assertRequest = null,
} = {}) => ({
  async createLearningPlan(input) {
    if (typeof assertRequest === 'function') {
      assertRequest(input);
    }
    if (error) {
      throw error;
    }
    return response;
  },
});
