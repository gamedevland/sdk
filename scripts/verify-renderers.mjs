import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir, readFile, rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root = process.cwd();
const temporary = resolve(root, '.tmp-renderer-checks');
await mkdir(temporary, {recursive:true});
const paths = {
  NodeBase:'layouts/NodeBase', BaseComponent:'layouts/components/BaseComponent', BaseAction:'layouts/actions/BaseAction',
  LayoutBuilder:'layouts/build/LayoutBuilder', SceneLayout:'layouts/scene/SceneLayout',
  ComponentRegistry:'layouts/components/ComponentRegistry', ActionRegistry:'layouts/actions/ActionRegistry',
  AssetManager:'assets/AssetManager', DiContainer:'di/DiContainer', EngineDi:'di/EngineDi', EventBus:'events/EventBus',
  PrefabManager:'prefabs/PrefabManager', PrefabRepository:'prefabs/PrefabRepository', InputManager:'input/InputManager',
  ThreeRendererModule:'renderers/three/ThreeRendererModule', ThreeRuntime:'renderers/three/ThreeRuntime',
  ThreeNode:'renderers/three/ThreeNode', ThreeGroup:'renderers/three/ThreeGroup', GlbLoader:'renderers/three/GlbLoader',
  ThreeHitTester:'renderers/three/ThreeHitTester', SchemaDecoder:'validation/schema/SchemaDecoder',
  LayoutInheritanceResolver:'layouts/core/LayoutInheritanceResolver',
  HybridRendererModule:'renderers/hybrid/HybridRendererModule', RenderTokens:'rendering/RenderTokens',
};
await build({stdin:{contents:Object.entries(paths).map(([name,path])=>`export {${name}} from './packages/engine/src/${path}';`).join('\n'),resolveDir:root},
  outfile:resolve(temporary,'fixture.mjs'),bundle:true,format:'esm',platform:'node',external:['three','pixi.js','matter-js','@spd789562/particle-emitter'],tsconfig:'packages/engine/tsconfig.json'});
const m=await import(pathToFileURL(resolve(temporary,'fixture.mjs')));
const THREE=await import('three');
let passed=0;
const check=async (name, run)=>{await run();passed++;console.log('PASS',name);};
const mesh={type:'Mesh',props:{geometry:{type:'box',size:{x:1,y:1,z:1}},material:{type:'standard',color:'#55bb99'}}};
function setup() {
  const assets=new m.AssetManager({retry:{retries:0,backoffMs:1,backoffFactor:1,timeoutMs:1000}});
  const container=new m.DiContainer(); new m.ThreeRendererModule().register(container,assets);
  const rendering=new m.ThreeRuntime();
  const components=new m.ComponentRegistry(), actions=new m.ActionRegistry();
  const events=new m.EventBus();
  const screen={getOrientation:()=> 'land',getViewportSize:()=>({width:100,height:100}),getVirtualSize:()=>({width:100,height:100}),getScale:()=>1,toVirtual:(x,y)=>({x,y})};
  const engine={rendering,assets,di:new m.EngineDi(container),events,screen,tweens:{kill(){}},input:{onNode:()=>()=>{}},scenes:{getCurrentSceneScopeVersion:()=>1},config:{}};
  const ctx={assets,container,components,actions,screen,engine};
  return {engine,ctx};
}
try {
await check('strict empty input accepts omitted payload and rejects extra fields',()=>{
  assert.deepEqual(m.SchemaDecoder.decode(undefined,m.SchemaDecoder.strictObject({}),'empty'),{});
  assert.throws(()=>m.SchemaDecoder.decode({bad:true},m.SchemaDecoder.strictObject({}),'empty'),/unsupported property/);
});
await check('Three quality profile is strict and directional shadow props are decoded',async()=>{
  assert.throws(()=>new m.ThreeRuntime({toneMapping:'invalid'}));
  assert.throws(()=>new m.ThreeRuntime({shadows:1}));
  const {ctx}=setup();
  const built=await new m.LayoutBuilder(ctx).build({root:{type:'Group',children:{sun:{type:'DirectionalLight',props:{color:'#fff0d2',intensity:3,castShadow:true,shadowMapSize:2048,shadowBounds:15}}}}});
  const light=built.elements.get('root.sun').object.view;
  assert.equal(light.castShadow,true);assert.equal(light.shadow.mapSize.x,2048);assert.equal(light.shadow.camera.left,-15);
  await built.root.destroy();
});
await check('renderer registrations are system-owned and reject duplicates',()=>{
  const {ctx}=setup(); assert.throws(()=>new m.ThreeRendererModule().register(ctx.container,ctx.assets),/Overriding system token/);
});
await check('one component tick per frame regardless of tree depth; idempotent cleanup',async()=>{
  let updates=0,disposals=0;
  class Counter extends m.BaseComponent {nodeType=m.ThreeNode;update(){updates++;}onDetach(){disposals++;return super.onDetach();}}
  const {engine,ctx}=setup();ctx.components.register('Counter',()=>new Counter());
  const built=await new m.LayoutBuilder(ctx).build({root:{type:'Group',children:{nested:{type:'Group',children:{item:{...mesh,components:{counter:{type:'Counter'}}}}}}}});
  const layout=m.SceneLayout.fromBuildResult(engine,built);layout.activate();layout.update(0.01);
  assert.equal(updates,1);await layout.destroy();await layout.destroy();assert.equal(disposals,1);
});
await check('unknown behavior and leaf children fail with rollback',async()=>{
  const {ctx}=setup();
  await assert.rejects(()=>new m.LayoutBuilder(ctx).build({root:{...mesh,components:{bad:{type:'Missing'}}}}),/Unregistered behavior/);
  await assert.rejects(()=>new m.LayoutBuilder(ctx).build({root:{...mesh,children:{illegal:mesh}}}),/children require/);
});
await check('partial component init is detached during rollback',async()=>{
  let disposed=0;
  class Failing extends m.BaseComponent {nodeType=m.ThreeNode;onInit(){throw new Error('init failure');}onDetach(){disposed++;return super.onDetach();}}
  const {ctx}=setup();ctx.components.register('Fail',()=>new Failing());
  await assert.rejects(()=>new m.LayoutBuilder(ctx).build({root:{...mesh,components:{fail:{type:'Fail'}}}}),/init failure/);
  assert.equal(disposed,1);
});
await check('component owner class is checked at the JSON boundary',async()=>{
  class WrongNode extends m.NodeBase {attach(){}detach(){}destroyView(){}}
  class WrongComponent extends m.BaseComponent {nodeType=WrongNode;}
  const {ctx}=setup();ctx.components.register('Wrong',()=>new WrongComponent());
  await assert.rejects(()=>new m.LayoutBuilder(ctx).build({root:{...mesh,components:{wrong:{type:'Wrong'}}}}),/Unexpected node type/);
});
await check('3D props reject unknown fields, malformed vectors and negative geometry',async()=>{
  const {ctx}=setup();
  for(const props of [{...mesh.props,typo:1},{...mesh.props,position:{x:0,y:0}},{...mesh.props,geometry:{type:'box',size:{x:-1,y:1,z:1}}}]) {
    await assert.rejects(()=>new m.LayoutBuilder(ctx).build({root:{type:'Mesh',props}}));
  }
});
await check('sibling inheritance resolves overrides and rejects cycles',()=>{
  const resolver=new m.LayoutInheritanceResolver();
  const result=resolver.resolve({base:mesh,copy:{type:'Mesh',extends:'base',props:{position:{x:2,y:0,z:0}}}});
  const reserved=resolver.resolve(JSON.parse('{"constructor":{"type":"Group"},"__proto__":{"type":"Group"}}'));
  assert.deepEqual(Object.keys(reserved),['constructor','__proto__']);
  assert.equal(result.copy.props.material.color,'#55bb99');assert.equal(result.copy.props.position.x,2);
  assert.throws(()=>resolver.resolve({a:{type:'Group',extends:'b'},b:{type:'Group',extends:'a'}}),/Cyclic/);
});
await check('GLB leases keep resources alive and clone transforms independently',async()=>{
  globalThis.document={baseURI:'http://localhost/'};
  const bytes=await readFile(resolve(root, 'examples/fixtures/mcp-crystal.glb'));
  const asset=await new m.GlbLoader().load({id:'crystal',type:'model',url:'data:model/gltf-binary;base64,'+bytes.toString('base64')},new AbortController().signal);
  const a=asset.acquire(),b=asset.acquire();a.view.position.x=9;assert.equal(b.view.position.x,0);
  assert.throws(()=>asset.dispose(),/live instances/);a.release();assert.throws(()=>asset.dispose(),/live instances/);
  b.release();asset.dispose();asset.dispose();assert.throws(()=>asset.acquire(),/disposed/);
});
await check('cancelled GLB load cannot produce a retained asset',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(()=>new m.GlbLoader().load({id:'aborted',type:'model',url:'data:application/octet-stream;base64,AA=='},controller.signal));
});
await check('prefab ensure is single-flight and removal frees the ID for reuse',async()=>{
  const {engine,ctx}=setup();
  const built=await new m.LayoutBuilder(ctx).build({root:{type:'Group'}});
  const layout=m.SceneLayout.fromBuildResult(engine,built);layout.activate();
  engine.prefabs=new m.PrefabManager(engine,{getElement:async()=>mesh});
  const parent=layout.requireNode('root',m.ThreeGroup);
  const request={parent,prefabId:'ore',localId:'ore'};
  const [a,b]=await Promise.all([engine.prefabs.ensure(request),engine.prefabs.ensure(request)]);
  assert.equal(a.node,b.node);assert.equal(a.created,true);assert.equal(b.created,false);
  await b.dispose();assert.equal(parent.hasChild('ore'),true);
  await a.dispose();await a.dispose();assert.equal(parent.hasChild('ore'),false);
  const next=await engine.prefabs.ensure(request);assert.notEqual(next.node,a.node);await layout.destroy();
});
await check('prefab properties retain their real parent and shared text style catalog', async()=>{
  const {engine,ctx}=setup();
  engine.config.layouts={textStylesConfigId:'text-styles'};
  const built=await new m.LayoutBuilder(ctx).build({root:{type:'Group'}});
  const parent=built.elements.get('root').object;
  const create=engine.rendering.createProperties.bind(engine.rendering);
  let observed;
  engine.rendering.createProperties=(context, root)=>{observed={styles:context.textStylesConfigId,root};return create(context,root);};
  const prefabs=new m.PrefabManager(engine,{getElement:async()=>mesh});
  const result=await prefabs.spawn({parent,prefabId:'mesh',localId:'child'});
  assert.equal(observed.styles,'text-styles');assert.equal(observed.root,parent);
  await result.dispose();await built.root.destroy();
});
await check('hybrid prefabs can spawn under both native parent types',async()=>{
  const {engine,ctx}=setup();
  const container=new m.DiContainer();new m.HybridRendererModule().register(container,engine.assets,{});
  ctx.container=container;engine.di=new m.EngineDi(container);engine.rendering=container.get(m.RenderTokens.Runtime);
  const built=await new m.LayoutBuilder(ctx).build({world:{type:'Group'},ui:{type:'Container'}});
  const prefabs=new m.PrefabManager(engine,{getElement:async id=>id==='ui'?{type:'Container'}:mesh});
  const world=await prefabs.spawn({parent:built.elements.get('world').object,prefabId:'world',localId:'item'});
  const ui=await prefabs.spawn({parent:built.elements.get('ui').object,prefabId:'ui',localId:'item'});
  assert.equal(world.node.view.parent,built.elements.get('world').object.view);
  assert.equal(ui.node.view.parent,built.elements.get('ui').object.view);
  await built.root.destroy();
});
await check('prefab does not attach to a parent disposed during loading',async()=>{
  const {engine,ctx}=setup();
  const built=await new m.LayoutBuilder(ctx).build({root:{type:'Group'}});
  const parent=built.elements.get('root').object;
  let resolveAsset;engine.prefabs=new m.PrefabManager(engine,{getElement:()=>new Promise(resolve=>{resolveAsset=resolve;})});
  const operation=engine.prefabs.spawn({parent,prefabId:'ore',localId:'late'});
  await parent.destroy();resolveAsset(mesh);
  await assert.rejects(()=>operation,/expired|disposed/);assert.equal(parent.hasChild('late'),false);
});
await check('raycast uses nearest visible interactive node and stable registry order',async()=>{
  const {engine,ctx}=setup();
  const built=await new m.LayoutBuilder(ctx).build({root:{type:'Group',children:{near:mesh,far:{...mesh,props:{...mesh.props,position:{x:0,y:0,z:-3}}}}}});
  const layout=m.SceneLayout.fromBuildResult(engine,built);
  const camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.z=10;camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const hits=new m.ThreeHitTester(()=>layout,()=>camera,()=>({width:100,height:100}));
  hits.addInteractive('root.far');hits.addInteractive('root.near');assert.equal(hits.hitTest({x:50,y:50}).target.id,'root.near');
  layout.requireNode('root.near',m.ThreeNode).view.visible=false;assert.equal(hits.hitTest({x:50,y:50}).target.id,'root.far');
  hits.removeInteractive('root.far');assert.equal(hits.hitTest({x:50,y:50}).target,undefined);await layout.destroy();
});
await check('pointer cancel and runtime pause cannot turn into a tap',()=>{
  const {engine}=setup();
  engine.rendering.createHitTester=()=>({hitTest:()=>({}),addInteractive(){},removeInteractive(){},clearInteractive(){}});
  engine.inputChannel={publish(){}};
  const canvas=new EventTarget();
  const manager=new m.InputManager(engine);manager.attach(canvas);
  let taps=0;manager.on('tap',()=>taps++);
  const send=type=>{const e=new Event(type);Object.assign(e,{pointerId:1,pointerType:'mouse',clientX:50,clientY:50,button:0,buttons:0,isPrimary:true});canvas.dispatchEvent(e);};
  send('pointerdown');send('pointercancel');send('pointerup');assert.equal(taps,0);
  send('pointerdown');manager.setPaused(true);manager.setPaused(false);send('pointerup');assert.equal(taps,0);
  send('pointerdown');send('pointerup');assert.equal(taps,1);manager.destroy();
});
await check('second-pointer movement remains observable without stealing the active drag',()=>{
  const {engine}=setup();
  engine.rendering.createHitTester=()=>({hitTest:()=>({}),addInteractive(){},removeInteractive(){},clearInteractive(){}});
  engine.inputChannel={publish(){}};
  const canvas=new EventTarget();
  const manager=new m.InputManager(engine);manager.attach(canvas);
  const events=[];
  for(const type of ['dragstart','drag','dragend','pointermove','pointerup']) manager.on(type,event=>events.push([type,event.pointerId]));
  const send=(type,id,x)=>{const e=new Event(type);Object.assign(e,{pointerId:id,pointerType:'touch',clientX:x,clientY:50,button:0,buttons:1,isPrimary:id===1});canvas.dispatchEvent(e);};
  try {
    send('pointerdown',1,0);send('pointermove',1,20);
    send('pointerdown',2,0);send('pointermove',2,20);send('pointermove',2,30);
    send('pointerup',2,30);send('pointermove',1,40);send('pointerup',1,40);
    assert.deepEqual(events,[['dragstart',1],['pointermove',2],['pointermove',2],['pointerup',2],['drag',1],['dragend',1],['pointerup',1]]);
  } finally {manager.destroy();}
});
console.log(`Renderer contracts: ${passed} scenarios passed. These are deterministic checks, not browser/device QA.`);
} finally {await rm(temporary,{recursive:true,force:true});}
