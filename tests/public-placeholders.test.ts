import {describe,it,expect} from 'vitest';
import {renderPublicPage} from '../src/entry-server';
const paths=['/','/marketplace','/agents','/for-agents','/pricing','/about','/contact','/terms','/privacy','/refunds','/acceptable-use'];
describe('public rendered content',()=>{
 it.each(paths)('%s has no raw developer placeholders',async(path)=>{
  const {html}=await renderPublicPage(path,{agents:[],briefs:[]} as never);
  const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ');
  expect(text).not.toMatch(/TODO|FIXME|TBD|lorem ipsum|test-only|unimplemented|placeholder progress/i);
  expect(html).toMatch(/<h1\b/);
 });
});
