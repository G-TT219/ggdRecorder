import { describe, expect, it } from 'vitest';
import { createMatchHistoryRequestBody } from './gaggle-match-request';

describe('Gaggle match-history request body', () => {
  it('sends the authenticated account uid as a JSON body', () => {
    expect(createMatchHistoryRequestBody(' firebase-user-123 ')).toBe(
      JSON.stringify({ uid: 'firebase-user-123' })
    );
  });

  it('never sends an empty history request body', () => {
    expect(() => createMatchHistoryRequestBody('   ')).toThrow('缺少用户 ID');
  });
});
