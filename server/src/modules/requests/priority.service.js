/**
 * Priority scoring algorithm for water requests.
 *
 * Deterministic scoring based on:
 * - severity
 * - affected population
 * - requested quantity
 * - waiting time
 * - emergency flag
 *
 * Score range: 0–100+ (higher = more urgent)
 */

const SEVERITY_WEIGHTS = {
  LOW: 5,
  MEDIUM: 15,
  HIGH: 30,
  CRITICAL: 50,
};

const EMERGENCY_WEIGHT = 20;

/**
 * Calculate priority score for a water request.
 * @param {Object} request
 * @returns {number} Priority score
 */
export const calculatePriorityScore = (request) => {
  const {
    severity = 'MEDIUM',
    estimatedAffectedPeople = 1,
    requestedLiters = 1000,
    isEmergency = false,
    createdAt,
  } = request;

  // 1. Severity weight (0–50)
  const severityScore = SEVERITY_WEIGHTS[severity] || 15;

  // 2. Affected people weight (0–20)
  // Scale: 1–100 people → 0-5, 100–500 → 5-10, 500–2000 → 10-15, 2000+ → 15-20
  let affectedScore = 0;
  if (estimatedAffectedPeople >= 2000) affectedScore = 20;
  else if (estimatedAffectedPeople >= 500) affectedScore = 10 + (estimatedAffectedPeople / 2000) * 10;
  else if (estimatedAffectedPeople >= 100) affectedScore = 5 + (estimatedAffectedPeople / 500) * 5;
  else affectedScore = (estimatedAffectedPeople / 100) * 5;

  // 3. Quantity weight (0–10)
  // More water needed = slightly higher priority
  let quantityScore = 0;
  if (requestedLiters >= 20000) quantityScore = 10;
  else if (requestedLiters >= 10000) quantityScore = 7;
  else if (requestedLiters >= 5000) quantityScore = 5;
  else if (requestedLiters >= 1000) quantityScore = 3;
  else quantityScore = 1;

  // 4. Waiting time weight (0–15)
  // Every 30 minutes of waiting adds score, capped at 15
  let waitingScore = 0;
  if (createdAt) {
    const waitingMinutes = (Date.now() - new Date(createdAt).getTime()) / 60000;
    waitingScore = Math.min(15, Math.floor(waitingMinutes / 30) * 3);
  }

  // 5. Emergency weight (0 or 20)
  const emergencyScore = isEmergency ? EMERGENCY_WEIGHT : 0;

  const totalScore = severityScore + affectedScore + quantityScore + waitingScore + emergencyScore;

  return Math.round(totalScore * 100) / 100;
};

/**
 * Determine priority level from score.
 */
export const getPriorityLevel = (score) => {
  if (score >= 60) return 'CRITICAL';
  if (score >= 40) return 'HIGH';
  if (score >= 20) return 'MEDIUM';
  return 'LOW';
};
