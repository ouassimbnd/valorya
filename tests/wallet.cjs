const ts=require('typescript');const fs=require('fs');const vm=require('vm');const assert=require('node:assert/strict');const path=require('path');
const root=path.resolve(__dirname,'..');
const {execFileSync}=require('node:child_process');
const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'valorya-wallet-test-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(temp,'key.pem'),'-out',path.join(temp,'cert.pem'),'-days','1','-subj','/CN=Valorya test/OU=TESTTEAM'],{stdio:'ignore'});
process.on('exit',()=>fs.rmSync(temp,{recursive:true,force:true}));
function load(file,overrides={}){const exports={};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;const req=name=>{if(overrides[name])return overrides[name];if(name.startsWith('./'))return load(path.resolve(path.dirname(file),name+'.ts'),overrides);return require(require.resolve(name,{paths:[root]}));};vm.runInNewContext(js,{exports,require:req,process,Buffer,URL,Uint8Array,console,Response},{filename:file});return exports;}
const cert=fs.readFileSync(path.join(temp,'cert.pem')).toString('base64');const key=fs.readFileSync(path.join(temp,'key.pem')).toString('base64');
Object.assign(process.env,{APP_URL:'https://valorya.example',APPLE_PASS_TYPE_IDENTIFIER:'pass.example.valorya',APPLE_TEAM_IDENTIFIER:'TESTTEAM',APPLE_SIGNER_CERT_BASE64:cert,APPLE_SIGNER_KEY_BASE64:key,APPLE_WWDR_CERT_BASE64:cert,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test'});
const {createWalletPass}=load(root+'/lib/wallet-pass.ts');const id='11111111-1111-4111-8111-111111111111';const pass=createWalletPass({membershipId:id,customerName:'Camille',businessName:'Maison Auguste'});assert.ok(pass.length>1000);
const route=load(root+'/app/api/wallet/apple/route.ts');
(async()=>{assert.equal((await route.POST()).status,410);console.log('PASS: signed pass generation; legacy direct issuer disabled to prevent billing bypass');})().catch(e=>{console.error(e);process.exit(1)});
