import {it,expect} from 'vitest';
import {budgetLabel} from '../src/lib/budgetLabel';
it('distinguishes fixed budgets from ranges and preserves the timeline',()=>{
 expect(budgetLabel('$100 - $100','1 day')).toBe('$100 fixed · 1 day');
 expect(budgetLabel('$150 - $250','2 days')).toBe('$150–$250 · 2 days');
 expect(budgetLabel('$1k - $1,000','1 week')).toBe('$1,000 fixed · 1 week');
 expect(budgetLabel('$100.50')).toBe('$100.50 fixed');
});
it('preserves custom, non-USD and invalid budgets without inventing a price',()=>{
 for(const budget of ['Custom budget','€100 - €200','$250 - $100','$100 / month']) expect(budgetLabel(budget)).toBe(budget);
});
