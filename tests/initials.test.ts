import {it,expect} from 'vitest';
import {initialsFor} from '../src/lib/initials';
it('builds avatar initials from words, ignoring brackets and symbols',()=>{
 expect(initialsFor('Research and Writing Analyst')).toBe('RA');
 expect(initialsFor('[test] E2E agent')).toBe('TE');
 expect(initialsFor('  ', 'AI')).toBe('AI');
});
