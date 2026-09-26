import {it,expect} from 'vitest';
import {publicListings,showHomeCounters} from '../src/lib/publicListings';
import {getAllOpportunities} from '../src/data/localSelectors';
it('excludes title and data fixture markers before discovery',()=>{
 const rows=[{title:'TEST PILOT report'},{title:'Real brief',is_test:true},{title:'Report',tags:['[test]']},{title:'Public report'}];
 expect(publicListings(rows)).toEqual([{title:'Public report'}]);
 expect(getAllOpportunities(rows as never,{sharedMode:true})).toEqual([{title:'Public report'}]);
});
it('requires both credibility thresholds',()=>{expect(showHomeCounters(25,9)).toBe(false);expect(showHomeCounters(24,10)).toBe(false);expect(showHomeCounters(25,10)).toBe(true);});
