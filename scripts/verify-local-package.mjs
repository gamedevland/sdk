import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const root=process.cwd();
const info=JSON.parse(readFileSync(resolve(root,'artifacts/latest.json'),'utf8'));
const temporary=mkdtempSync(resolve(tmpdir(),'three-renderer-consumers-'));
for(const mode of ['core','three','pixi','hybrid']) {
 const folder=resolve(temporary,mode);mkdirSync(folder);
 const deps={'@gamedevland/engine':'file:'+info.tarball};
 const dev={typescript:'^5.9.3'};
 if(mode==='three'||mode==='hybrid'){deps.three='^0.187.0';dev['@types/three']='^0.187.0';}
 if(mode==='pixi'||mode==='hybrid'){deps['pixi.js']='^8.16.0';}
 writeFileSync(resolve(folder,'package.json'),JSON.stringify({name:'renderer-'+mode,private:true,type:'module',dependencies:deps,devDependencies:dev},null,2));
 execFileSync('npm',['install','--no-audit','--no-fund'],{cwd:folder,stdio:'pipe'});
 const require=createRequire(resolve(folder,'package.json'));
 for(const banned of mode==='core'?['three','pixi.js']:mode==='three'?['pixi.js']:mode==='pixi'?['three']:[]) {
  assert.throws(()=>require.resolve(banned),{code:'MODULE_NOT_FOUND'},mode+' must not require '+banned);
 }
 if(mode==='pixi') cpSync(resolve(root,'examples/pixi-smoke'),folder,{recursive:true});
 else writeFileSync(resolve(folder,'main.ts'),`import {Engine, BaseComponent, BaseAction, SchemaDecoder} from '@gamedevland/engine';\n${mode==='hybrid'?"import {HybridRendererModule} from '@gamedevland/engine/renderers/hybrid';\nexport {HybridRendererModule};":mode==='three'?"import {ThreeRendererModule, ThreeNode} from '@gamedevland/engine/renderers/three';\nexport {ThreeRendererModule,ThreeNode};":''}\nexport {Engine,BaseComponent,BaseAction,SchemaDecoder};\n`);
 writeFileSync(resolve(folder,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'Bundler',strict:true,noEmit:true,skipLibCheck:false,lib:['ES2022','DOM','DOM.Iterable']},include:['*.ts']}));
 execFileSync(resolve(folder,'node_modules/.bin/tsc'),['--noEmit'],{cwd:folder,stdio:'inherit'});
 const result=await build({entryPoints:[resolve(folder,'main.ts')],outdir:resolve(folder,'dist'),bundle:true,format:'esm',platform:'browser',target:'es2022',metafile:true,define:{'import.meta.env':JSON.stringify({VITE_PLATFORM:'web',VITE_DEFAULT_LOCALE:'en'})}});
 const modules=Object.keys(result.metafile.inputs).join('\n');
 if(mode==='hybrid') { assert(modules.includes('/pixi.js/') && modules.includes('/three/'),'Hybrid must contain both renderers'); } else
 assert(!modules.includes(mode==='three'?'/pixi.js/':mode==='pixi'?'/three/':'/three/') && (mode!=='core'||!modules.includes('/pixi.js/')),'Unexpected renderer in '+mode+' module graph');
 if(mode==='pixi') {
  cpSync(resolve(folder,'index.html'),resolve(folder,'dist/index.html'));
  cpSync(resolve(folder,'layout.json'),resolve(folder,'dist/layout.json'));
 }
 console.log('PASS isolated',mode,'consumer: real tarball, strict declarations and expected renderer module graph');
}
writeFileSync(resolve(root,'artifacts/consumer-checks.json'),JSON.stringify({temporary,tarball:info.tarball,passed:['core','three','pixi','hybrid']},null,2));
console.log('Consumer fixtures retained for browser QA:',temporary);
