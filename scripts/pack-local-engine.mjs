import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const branch=git('branch','--show-current');
execFileSync('npm',['run','build'],{cwd:root,stdio:'inherit'});
const folder=mkdtempSync(resolve(tmpdir(),'three-sdk-pack-'));
try {
 const packages=[];
 for(const name of ['engine','vite']) {
  const packageRoot=resolve(root,'packages',name);
  const pkg=JSON.parse(readFileSync(resolve(packageRoot,'package.json'),'utf8'));
  const [result]=JSON.parse(execFileSync('npm',['pack','--json','--pack-destination',folder],{cwd:packageRoot,encoding:'utf8'}));
  const packed=resolve(folder,result.filename);
  const sha256=createHash('sha256').update(readFileSync(packed)).digest('hex');
  const filename=`gamedevland-${name}-${pkg.version}-${sha256.slice(0,12)}.tgz`;
  renameSync(packed,resolve(folder,filename));
  packages.push({name:pkg.name,version:pkg.version,filename,sha256,peerDependencies:pkg.peerDependencies});
 }
 const [engine,tooling]=packages;
 const checks=[{command:'npm run build',exitCode:0}];
 const bundleHash=createHash('sha256').update(packages.map(p=>p.sha256).join(':')+JSON.stringify(checks)).digest('hex').slice(0,12);
 const info={branch,commit:git('rev-parse','HEAD'),dirty:Boolean(git('status','--porcelain')),packages,
  version:engine.version,package:engine.filename,sha256:engine.sha256,toolingPackage:tooling.filename,
  validation:{build:'passed (npm run build)',checks,report:'docs/RENDERER_INTEGRATION_VALIDATION.md; browser and device scope are recorded separately'}};
 writeFileSync(resolve(folder,'build-info.json'),JSON.stringify(info,null,2)+'\n');
 writeFileSync(resolve(folder,'LOCAL-INSTALL.md'),`# Local SDK build\n\nExtract this ZIP into the game's vendor/ directory, then run:\n\n\`\`\`sh\nnpm install ./vendor/${engine.filename}\nnpm install -D ./vendor/${tooling.filename}\n\`\`\`\n\nInstall only the selected renderer and its types. Both SDK packages are private. No registry publication is performed.\n`);
 const output=resolve(root,'artifacts');mkdirSync(output,{recursive:true});
 const zip=resolve(output,`sdk-${engine.version}-${bundleHash}.zip`);
 const files=[...packages.map(p=>resolve(folder,p.filename)),resolve(folder,'build-info.json'),resolve(folder,'LOCAL-INSTALL.md')];
 execFileSync('zip',['-q','-j',zip,...files]);
 for(const pkg of packages) copyFileSync(resolve(folder,pkg.filename),resolve(output,pkg.filename));
 const latest={...info,zip,tarball:resolve(output,engine.filename),toolingTarball:resolve(output,tooling.filename)};
 writeFileSync(resolve(output,'latest.json'),JSON.stringify(latest,null,2)+'\n');
 console.log(JSON.stringify(latest,null,2));
} finally {rmSync(folder,{recursive:true,force:true});}
