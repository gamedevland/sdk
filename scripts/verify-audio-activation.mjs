import assert from 'node:assert/strict';
import { build } from 'esbuild';

let gesture = false;
let contextMode = 'running';
let allowHtml = false;
let nextId = 0;
const contexts = [];
const sources = [];
function makeContext() {
  const context = {
    state: contextMode === 'running' ? 'running' : 'suspended', calls: [], pending: [],
    resume() {
      this.calls.push(gesture);
      if (gesture || contextMode === 'running') { this.state = 'running'; return Promise.resolve(); }
      if (contextMode === 'pending') return new Promise(resolve => this.pending.push(resolve));
      if (contextMode === 'unchanged') return Promise.resolve();
      return Promise.reject(new Error('NotAllowedError'));
    },
  };
  contexts.push(context);
  return context;
}
const howler = {
  usingWebAudio: true, noAudio: false, ctx: null,
  volume() { if (this.usingWebAudio && !this.ctx) this.ctx = makeContext(); return 1; },
  mute() {},
};
class FakeHowl {
  constructor(options) {
    this.url = options.src[0]; this.listeners = []; this.sounds = new Map(); this.requests = []; this.starts = 0; this.loaded = true;
    howler.volume(); sources.push(this);
  }
  play(id) {
    if (howler.usingWebAudio) assert.equal(howler.ctx.state, 'running', 'Suspended Web Audio must be resumed with handled rejection before Howler.play');
    id ??= ++nextId;
    this.requests.push({id,gesture});
    if (!this.sounds.get(id)) {
      if (!howler.usingWebAudio && !allowHtml) queueMicrotask(() => this.emit('playerror',id));
      else { this.sounds.set(id,true); this.starts++; queueMicrotask(() => this.emit('play',id)); }
    }
    return id;
  }
  playing(id) { return this.sounds.get(id) === true; }
  state() { return this.loaded ? 'loaded' : 'unloaded'; }
  on(event,fn,id) { this.listeners.push({event,fn,id,once:false}); return this; }
  once(event,fn,id) { this.listeners.push({event,fn,id,once:true}); return this; }
  off(event,fn,id) { this.listeners = this.listeners.filter(l => !(l.event===event && (!fn||l.fn===fn) && (id===undefined||l.id===id))); return this; }
  emit(event,id) { for (const l of [...this.listeners]) if(l.event===event && (l.id===undefined||l.id===id)) { if(l.once)this.off(event,l.fn,l.id); l.fn(id); } }
  stop(id) { for(const key of id===undefined?[...this.sounds.keys()]:[id]) {this.sounds.set(key,false); this.emit('stop',key);} return this; }
  pause(id) { this.sounds.set(id,false); return this; }
  loop() { return this; } rate() { return this; } volume() { return this; } mute() { return this; } seek() { return this; }
  unload() { this.stop(); this.listeners=[]; }
}
globalThis.__audioActivationFixture = { Howler: howler, Howl: FakeHowl };
const bundled = await build({
  stdin:{contents:"export { AudioManager } from './packages/engine/src/audio/AudioManager.ts';",resolveDir:process.cwd(),loader:'ts'},
  tsconfig:'packages/engine/tsconfig.json',bundle:true,platform:'node',format:'esm',write:false,
  plugins:[{name:'mock-browser-audio',setup(b){
    b.onResolve({filter:/^howler$/},()=>({path:'howler',namespace:'mock-audio'}));
    b.onLoad({filter:/.*/,namespace:'mock-audio'},()=>({contents:'export const {Howler,Howl}=globalThis.__audioActivationFixture;',loader:'js'}));
  }}],
});
const { AudioManager } = await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const flush = async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
class Target {
  constructor(document) { this.listeners=new Map(); this.ownerDocument=document; }
  addEventListener(type,fn,options) { assert(options===true||options.capture);const set=this.listeners.get(type)??new Set();set.add(fn);this.listeners.set(type,set); }
  removeEventListener(type,fn) { this.listeners.get(type)?.delete(fn); }
  dispatch(type,extra={}) { const event={isTrusted:true,isPrimary:true,button:0,touches:[],...extra};gesture=event.isTrusted;try{for(const fn of this.listeners.get(type)??[])fn(event);}finally{gesture=false;} }
  count() {return [...this.listeners.values()].reduce((sum,set)=>sum+set.size,0);}
}
function setup(mode='running',web=true) {
  contextMode=mode;allowHtml=false;howler.usingWebAudio=web;howler.noAudio=false;howler.ctx=null;sources.length=0;contexts.length=0;
  const doc=new Target();doc.body={};doc.activeElement=doc.body;doc.hidden=false;
  const target=new Target(doc);
  const assets={has:()=>true,getRequired:id=>({id,url:id})};
  const audio=AudioManager.createDefault(assets);
  audio.attachInteractionTarget(target);audio.attachInteractionTarget(target);
  assert.equal(target.count(),3);assert.equal(doc.count(),1,'Activation attachment must be idempotent');
  return{audio,target,doc};
}
const music='audio/music.mp3';
let runs=0;
for(const mode of ['running','rejected','pending','unchanged']) {
  const {audio,target,doc}=setup(mode);
  const initial=audio.playMusic(music);await flush();
  if(mode==='running'){assert(initial);assert(audio.isMusicPlaying());assert.equal(sources[0].starts,1);}
  else {
    assert.equal(audio.isMusicPlaying(),false);assert.equal(sources[0].starts,0);
    assert.equal(audio.playSfx('audio/tap.mp3'),undefined,'Blocked SFX must not accumulate');
    target.dispatch('pointerup',{isTrusted:false});target.dispatch('pointerup',{button:2});target.dispatch('pointerup',{isPrimary:false});await flush();
    assert.equal(sources[0].starts,0,'Synthetic/right/secondary input must not unlock');
    target.dispatch('pointerup');await flush();assert(audio.isMusicPlaying());assert.equal(sources[0].starts,1);
    assert(contexts[0].calls.includes(true),'resume must run on the native gesture stack');
  }
  const starts=sources[0].starts;target.dispatch('pointerdown');target.dispatch('pointerup');await flush();audio.playMusic(music);await flush();assert.equal(sources[0].starts,starts,'Duplicate gestures/music requests layered music');
  audio.setMusicEnabled(false);target.dispatch('pointerup');await flush();assert.equal(audio.isMusicPlaying(),false);
  audio.setMusicEnabled(true);await flush();assert(audio.isMusicPlaying());
  audio.dispose();audio.dispose();assert.equal(target.count(),0);assert.equal(doc.count(),0);assert(sources.every(s=>s.listeners.length===0));
  runs++;
}
{
 const {audio,target}=setup('pending');audio.playMusic(music);await flush();const context=contexts[0];audio.dispose();context.state='running';context.pending.forEach(resolve=>resolve());await flush();assert.equal(sources[0].starts,0,'Disposed autoplay continued');assert.equal(target.count(),0);runs++;
}
{
 const {audio,target}=setup('rejected');target.dispatch('pointerup');await flush();assert.equal(contexts[0].state,'running','Early boot gesture did not initialize/unlock context');audio.playMusic(music);await flush();assert.equal(sources[0].starts,1);audio.dispose();runs++;
}
{
 const {audio,target}=setup('running',false);const handle=audio.playMusic(music);await flush();assert(handle);assert(!audio.isMusicPlaying());assert.equal(sources[0].starts,0);
 allowHtml=true;target.dispatch('pointerup');assert(sources[0].requests.at(-1).gesture,'HTML media retry escaped native gesture stack');await flush();assert(audio.isMusicPlaying());assert.equal(sources[0].starts,1);assert(sources[0].requests.every(r=>r.id===sources[0].requests[0].id),'HTML retry allocated duplicate sounds');
 const sfx=audio.playSfx('audio/tap.mp3');await flush();assert(sfx);audio.dispose();runs++;
}
{
 const {audio,target,doc}=setup('rejected');audio.playMusic(music);await flush();doc.hidden=true;target.dispatch('pointerup');await flush();assert.equal(sources[0].starts,0);doc.hidden=false;doc.dispatch('keydown',{repeat:true});await flush();assert.equal(sources[0].starts,0);doc.dispatch('keydown');await flush();assert(audio.isMusicPlaying());audio.dispose();runs++;
}
{
 const {audio,target}=setup('rejected');audio.setMusicEnabled(false);audio.setSfxEnabled(false);audio.playMusic(music);await flush();target.dispatch('pointerup');await flush();assert.equal(sources[0].starts,0);assert.equal(audio.isMusicPlaying(),false);audio.dispose();runs++;
}
{
 const {audio}=setup();const values=new Map([['mix',{'channel.music':.5,'channel.sfx':1,[music]:.4}]]);audio.applyBootstrapConfig({volumeConfigId:'mix'},{getRequired:id=>values.get(id)});audio.playMusic(music);await flush();assert(audio.isMusicPlaying());assert.throws(()=>audio.applyVolumeOverrides({'channel.typo':1}));assert.throws(()=>audio.applyVolumeOverrides({[music]:2}));audio.dispose();runs++;
}
{
 const {audio,target}=setup('running',false);allowHtml=true;audio.playMusic(music);await flush();assert(audio.isMusicPlaying());assert.equal(sources[0].starts,1,'Allowed HTML autoplay waited for input');target.dispatch('pointerup');await flush();assert.equal(sources[0].starts,1);audio.dispose();runs++;
}
{
 const {audio,target}=setup('running',false);audio.playMusic(music);audio.playSfx('audio/tap.mp3');await flush();assert.equal(sources[1].starts,0);assert.equal(sources[1].listeners.length,0,'Blocked HTML SFX retained listeners');allowHtml=true;target.dispatch('touchend');await flush();assert.equal(sources[0].starts,1);assert.equal(sources[1].starts,0,'Blocked HTML SFX replayed after activation');audio.dispose();runs++;
}
{
 const {audio,target}=setup();audio.playMusic(music);await flush();const playing=sources[0].starts;howler.ctx.state='suspended';target.dispatch('pointerup');await flush();assert.equal(howler.ctx.state,'running');assert.equal(sources[0].starts,playing,'Interruption recovery layered music');audio.setPlatformMuted(true);target.dispatch('pointerup');await flush();audio.setPlatformMuted(false);assert.equal(sources[0].starts,playing);audio.dispose();runs++;
}
{
 const {audio,target}=setup('pending');audio.playMusic(music);await flush();audio.stopAll('music');target.dispatch('pointerup');await flush();assert.equal(sources[0].starts,0,'Explicit stop was undone by recovery');audio.dispose();runs++;
}
{
 const {audio}=setup('running',false);audio.playMusic(music);await flush();sources[0].loaded=false;sources[0].emit('loaderror');assert(!audio.isMusicPlaying());assert.equal(sources[0].listeners.length,0,'Load failure leaked handle listeners');audio.dispose();runs++;
}
{
 const {audio}=setup('unchanged');audio.playMusic(music);await flush();await assert.rejects(audio.unlock(),error=>error.code==='AUDIO_PLAYBACK_BLOCKED');assert(!audio.isMusicPlaying());audio.dispose();runs++;
}
{
 const {audio,target}=setup();howler.noAudio=true;audio.playMusic(music);await flush();target.dispatch('pointerup');await flush();assert(!audio.isMusicPlaying());assert.equal(sources[0].starts,0);await assert.rejects(audio.unlock(),error=>error.code==='AUDIO_PLAYBACK_BLOCKED');audio.dispose();runs++;
}
{
 const {audio,target}=setup('rejected');audio.setMusicEnabled(false);audio.playSfx('audio/tap.mp3');await flush();assert.equal(contexts[0].calls.length,1,'SFX-only games did not attempt automatic resume');assert.equal(sources[0].starts,0);target.dispatch('pointerup');await flush();audio.playSfx('audio/tap.mp3');await flush();assert.equal(sources[0].starts,1);assert(!audio.isMusicPlaying());audio.dispose();runs++;
}
// A one-shot may finish between a consumer retaining its handle and stopping it later.
for (const terminal of ['end', 'playerror', 'loaderror', 'mute', 'stopAll', 'dispose']) {
 const {audio}=setup();await audio.unlock();
 const handle=audio.playSfx('audio/swoosh.mp3');await flush();assert(handle);
 const source=sources.at(-1),soundId=source.requests.at(-1).id;
 if(terminal==='mute')audio.setSfxEnabled(false);
 else if(terminal==='stopAll')audio.stopAll('sfx');
 else if(terminal==='dispose')audio.dispose();
 else source.emit(terminal,soundId);
 assert.doesNotThrow(()=>audio.stopByHandle(handle),`Stopping a ${terminal} one-shot must be idempotent`);
 assert.doesNotThrow(()=>audio.stopByHandle(handle),'Repeated cleanup must be idempotent');
 audio.dispose();runs++;
}
{
 const {audio}=setup();await audio.unlock();
 const ended=audio.playSfx('audio/swoosh.mp3');await flush();assert(ended);
 const source=sources.at(-1);source.emit('end',source.requests.at(-1).id);
 const active=audio.playSfx('audio/swoosh.mp3');await flush();assert(active);
 const activeId=source.requests.at(-1).id;
 assert.throws(()=>audio.pauseByHandle(ended),error=>error.code==='AUDIO_MISSING_REQUIRED','Other handle operations remain strict');
 audio.stopByHandle(ended);assert.equal(source.playing(activeId),true,'An expired handle must not stop a later playback');
 audio.stopByHandle(active);assert.equal(source.playing(activeId),false);
 audio.stopByHandle(active);audio.dispose();runs++;
}
console.log(`Audio activation: ${runs} scenarios passed (autoplay, blocked/rejected/pending contexts, first/early gesture, HTML retry, duplicate prevention, SFX dropping, mute, keyboard, disposal and volume validation).`);
delete globalThis.__audioActivationFixture;
