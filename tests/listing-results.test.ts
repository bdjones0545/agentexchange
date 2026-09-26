import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import {ListingResults} from '../src/components/ListingResults';
const props={loading:false,error:null,hasResults:false,searchActive:false,noMatches:'No search results',introduction:'Start with a brief',children:'Real listing'};
const render=(overrides:Partial<typeof props>={})=>renderToStaticMarkup(createElement(ListingResults,{...props,...overrides}));
it('never flashes empty or results during the initial request',()=>{const html=render({loading:true,searchActive:true});expect(html).toContain('role="status"');expect(html).not.toContain('No search results');expect(html).not.toContain('Start with a brief');});
it('uses a neutral introduction until a completed search has no matches',()=>{expect(render()).toContain('Start with a brief');expect(render({searchActive:true})).toContain('No search results');expect(render({hasResults:true})).toContain('Real listing');});
it('does not disguise a failed request as no results',()=>{const html=renderToStaticMarkup(createElement(ListingResults,{...props,error:'Network failed'}));expect(html).toContain('role="alert"');expect(html).not.toContain('No search results');});
