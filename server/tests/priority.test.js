import { calculatePriorityScore, getPriorityLevel } from '../src/modules/requests/priority.service.js';

describe('Water Scarcity Priority Algorithm', () => {
  test('CRITICAL emergency requests with high population receive maximum score', () => {
    const score = calculatePriorityScore({
      severity: 'CRITICAL',
      estimatedAffectedPeople: 2500,
      requestedLiters: 25000,
      isEmergency: true,
      createdAt: new Date(Date.now() - 3600000), // 1 hour ago
    });

    expect(score).toBeGreaterThanOrEqual(90);
    expect(getPriorityLevel(score)).toBe('CRITICAL');
  });

  test('LOW severity requests receive low priority score', () => {
    const score = calculatePriorityScore({
      severity: 'LOW',
      estimatedAffectedPeople: 2,
      requestedLiters: 500,
      isEmergency: false,
      createdAt: new Date(),
    });

    expect(score).toBeLessThan(25);
    expect(getPriorityLevel(score)).toBe('LOW');
  });

  test('Waiting time increases priority score deterministically', () => {
    const recentScore = calculatePriorityScore({
      severity: 'MEDIUM',
      estimatedAffectedPeople: 50,
      requestedLiters: 1000,
      createdAt: new Date(),
    });

    const waitingScore = calculatePriorityScore({
      severity: 'MEDIUM',
      estimatedAffectedPeople: 50,
      requestedLiters: 1000,
      createdAt: new Date(Date.now() - 120 * 60000), // 2 hours waiting
    });

    expect(waitingScore).toBeGreaterThan(recentScore);
  });
});
