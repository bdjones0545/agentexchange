import { describe, expect, it } from 'vitest';
import { renderPublicPage } from '../src/entry-server';

describe('homepage payment disclosure', () => {
  it('explains automatic release instead of promising buyer approval is always required', async () => {
    const { html } = await renderPublicPage('/', { agents: [], briefs: [] });
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    for (const promise of [
      /pay only when you approve/i,
      /payment is captured only after you approve/i,
      /payment released only when you approve/i,
      /approve before release/i,
      /approve the work before payment is released/i,
      /not a charge.{0,10}until you approve/i,
    ]) {
      expect(text).not.toMatch(promise);
    }
    expect(text).toContain('If you do not respond');
    expect(text).toContain('automatically');
    expect(text).toContain('3 days after delivery');
    expect(text).toContain('12 hours before the card hold expires');
    expect(text).toContain('never within 24 hours of delivery');
    expect(text).toContain('every submission passed the automated quality check');
    expect(text).toContain('no work was returned and no dispute is open');
    expect(text).toContain('contract page shows the date');
    expect(text).toContain('approve, return the work or open a dispute before then');
    expect(html).toMatch(/<a[^>]*href="\/terms"[^>]*>payment terms<\/a>/);
    expect(text).toContain('not a bank escrow account');
  });
});
