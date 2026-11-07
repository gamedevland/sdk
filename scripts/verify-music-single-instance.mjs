import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { build } from 'esbuild';

// Real Howler queue/event implementation; only the browser's HTML media device is simulated.
const elements=[];
class Media {
 constructor(){this.listeners=new Map();this.readyState=0;this.duration=180;this.currentTime=0;this.paused=true;this.volume=1;this.muted=false;this.playbackRate=1;this.seekable={length:1,end:()=>180};this.oncanplaythrough=null;this.starts=0;this.history=[];elements.push(this);}
 canPlayType(){return 'probably';}
 addEventListener(type,fn){const set=this.listeners.get(type)??new Set();set.add(fn);this.listeners.set(type,set);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 load(){}
 play(){if(this.readyState<4)return Promise.reject(new Error('Media is not ready'));this.paused=false;this.starts++;this.history.push({src:this.src,position:this.currentTime});return Promise.resolve();}
 pause(){this.paused=true;}
 removeAttribute(){}
 ready(){this.readyState=4;for(const fn of [...this.listeners.get('canplaythrough')??[]])fn();}
}
const req=createRequire(import.meta.url),timers=new Set();
const sandbox={module:{exports:{}},exports:{},console:{...console,warn(){}},Promise,Audio:Media,navigator:{userAgent:'Audio SDK deterministic media device',platform:'Linux',appVersion:'1.0',vendor:''},document:{addEventListener(){},removeEventListener(){}},window:{addEventListener(){},removeEventListener(){}},setTimeout(fn,ms,...args){const timer=setTimeout(()=>{timers.delete(timer);fn(...args);},ms);timers.add(timer);return timer;},clearTimeout(timer){clearTimeout(timer);timers.delete(timer);}};
sandbox.exports=sandbox.module.exports;
sandbox.location={protocol:'https:'};sandbox.window=sandbox;sandbox.addEventListener=()=>{};sandbox.removeEventListener=()=>{};
vm.runInNewContext(readFileSync(req.resolve('howler'),'utf8'),sandbox,{filename:'howler.js'});
const {Howler,Howl}=sandbox.module.exports;Howler.usingWebAudio=false;Howler.autoUnlock=false;
globalThis.__singleMusicFixture={Howler,Howl};
const bundle=await build({stdin:{contents:"export {AudioManager} from './packages/engine/src/audio/AudioManager.ts'; export {HowlerAudioBackend} from './packages/engine/src/audio/internal/HowlerAudioBackend.ts';",resolveDir:process.cwd(),loader:'ts'},tsconfig:'packages/engine/tsconfig.json',bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'real-howler-device',setup(b){b.onResolve({filter:/^howler$/},()=>({path:'howler',namespace:'device'}));b.onLoad({filter:/.*/,namespace:'device'},()=>({contents:'export const {Howler,Howl}=globalThis.__singleMusicFixture;',loader:'js'}));}}]});
const {AudioManager,HowlerAudioBackend}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text+'\n//# sourceURL=sdk-audio-single-instance.js').toString('base64'));
const assets={has:()=>true,getRequired:id=>({id,url:id})};
const settle=async()=>{for(let turn=0;turn<12;turn++)await new Promise(resolve=>setTimeout(resolve,0));};
const audio=AudioManager.createDefault(assets),music='audio/music.mp3';
const audioElements=()=>elements.filter(e=>e.src?.endsWith('.mp3'));
try{
 const first=audio.playMusic(music);assert(first);
 assert.equal(audio.playMusic(music),first,'Repeated request while decoding returned another handle');
 for(const element of elements)element.ready();await settle();
 assert(audio.isMusicPlaying(),'Queued stop removed music bookkeeping before the first queued play');
 const active=audioElements().find(e=>!e.paused);assert(active,'Music did not start');active.currentTime=42;
 const starts=audioElements().reduce((sum,e)=>sum+e.starts,0);
 audio.setMusicEnabled(true);audio.playMusic(music);await Promise.all([audio.unlock(),audio.unlock(),audio.unlock()]);await settle();
 assert.equal(audioElements().reduce((sum,e)=>sum+e.starts,0),starts,'Boot/main or unlock restarted the same track');
 assert.equal(active.currentTime,42,'Playback position was reset by a repeated request');
 assert.equal(audioElements().filter(e=>!e.paused).length,1,'More than one media element is playing');
 const backend=new HowlerAudioBackend();backend.createSource({id:'audio/direct.mp3',url:'audio/direct.mp3'});
 const direct=backend.play('audio/direct.mp3',{channel:'music',loop:true});assert.equal(backend.play('audio/direct.mp3',{channel:'music',loop:true}),direct,'Backend itself failed to deduplicate a pending track');
 for(const element of elements)element.ready();await settle();
 assert(backend.isHandlePlaying(direct));const directStarts=audioElements().reduce((sum,e)=>sum+e.starts,0);assert.equal(backend.play('audio/direct.mp3',{channel:'music',loop:true}),direct);await settle();assert.equal(audioElements().reduce((sum,e)=>sum+e.starts,0),directStarts,'Backend repeated an active track');backend.dispose();
 audio.stopAll('music');
 audio.playMusic('audio/slow.mp3');audio.setMusicEnabled(false);audio.setMusicEnabled(true);audio.playMusic('audio/slow.mp3');
 for(const element of elements)element.ready();await settle();assert(audio.isMusicPlaying(),'Mute/unmute during decode lost the new handle');
 assert.equal(audioElements().filter(e=>!e.paused).length,1);assert.equal(elements.reduce((sum,e)=>sum+e.history.filter(p=>p.src==='audio/slow.mp3').length,0),1,'Mute/unmute queued a duplicate start');
 audio.stopAll('music');audio.playMusic('audio/cancel.mp3');audio.stopAll('music');for(const element of elements)element.ready();await settle();assert(!audio.isMusicPlaying());assert.equal(audioElements().filter(e=>!e.paused).length,0,'Cancelled load left an orphaned music stream');
 console.log('Real Howler: cold media queue, repeated boot/main requests, unlock race, backend deduplication and preserved seek position passed.');
}finally{audio.dispose();Howler.unload();for(const timer of timers)clearTimeout(timer);delete globalThis.__singleMusicFixture;}
