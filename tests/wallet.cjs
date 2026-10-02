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
let owner=true,validAuth=true,ready=true;let signed=0;const filters=[];
const fakeClient={auth:{getUser:async()=>({data:{user:validAuth?{id:'user-1'}:null},error:validAuth?null:{message:'invalid'}})},from(table){return {select(){return this;},eq(k,v){filters.push([table,k,v]);return this;},async maybeSingle(){return {data:table==='customers'?{id:'customer-1',display_name:'Camille'}:owner?{id,program:{business:{name:'Maison Auguste'}}}:null,error:null};}};}};
const route=load(root+'/app/api/wallet/apple/route.ts',{'@supabase/supabase-js':{createClient:()=>fakeClient},'@/lib/wallet-config':{walletConfigured:()=>ready},'@/lib/wallet-pass':{createWalletPass:()=>{signed++;return pass;}}});
const req=(token,body)=>({headers:new Headers(token?{authorization:'Bearer '+token}:{}),json:async()=>body});
(async()=>{
 assert.equal((await route.POST(req(null,{membershipId:id}))).status,401);
 assert.equal((await route.POST(req('test',{membershipId:'bad'}))).status,400);
 validAuth=false;assert.equal((await route.POST(req('test',{membershipId:id}))).status,401);validAuth=true;
 owner=false;assert.equal((await route.POST(req('test',{membershipId:id}))).status,404);assert.equal(signed,0);owner=true;
 ready=false;assert.equal((await route.POST(req('test',{membershipId:id}))).status,503);ready=true;
 const response=await route.POST(req('test',{membershipId:id}));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/vnd.apple.pkpass');assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(signed,1);
 assert.ok(filters.some(([t,k,v])=>t==='customers'&&k==='auth_user_id'&&v==='user-1'));assert.ok(filters.some(([t,k,v])=>t==='memberships'&&k==='customer_id'&&v==='customer-1'));
 console.log('PASS: signed pass generation; 401/400/404/503/200; ownership filter; no caching');
})().catch(e=>{console.error(e);process.exit(1)});
