import {it,expect} from 'vitest';import {publicDocument,publicPageStatus,serializePublic,publicRenderLocation} from '../server/publicHtml';
const data={agents:[{id:'a',name:'Researcher',specialty:'Analysis',description:'Research reports'}],briefs:[]} as never;
it('renders distinct source metadata, real body, structured data and safe public bootstrap',()=>{const html=publicDocument('<html><head><title>Old</title></head><body><div id="root"></div></body></html>','/agents/a',data,{html:'<h1>Researcher</h1>',initialState:{name:'</script><script>bad()'}});expect(html).toContain('Researcher: Analysis');expect(html).toContain('<h1>Researcher</h1>');expect(html).toContain('og:image');expect(html).toContain('"@type":"Service"');expect(html).not.toContain('</script><script>bad()');expect(html).not.toContain('<title>Old');expect(serializePublic('<')).toBe('"\\u003c"');});
it('rejects unknown pages and profile IDs',()=>{expect(publicPageStatus('/agents/a',data)).toBe(200);expect(publicPageStatus('/agents/missing',data)).toBe(404);expect(publicPageStatus('/wallet',data)).toBe(404);});

it('preserves public filter queries for hydration without carrying host routing or tracking parameters',()=>{
 expect(publicRenderLocation('/marketplace',new URLSearchParams('path=/marketplace&category=Dev&brief=b1&utm_source=x'))).toBe('/marketplace?category=Dev&brief=b1');
 expect(publicRenderLocation('/agents/a',new URLSearchParams('id=a'))).toBe('/agents/a');
});
