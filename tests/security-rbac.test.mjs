import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createHmac, webcrypto } from 'node:crypto';
import * as nodeCrypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server.js';
import { STAFF_ROLES, PROJECT_ONLY_ROLES, canAccessRoute, canReadProjectFile, projectDto, staffProjectPermissions } from '../lib/security/access-policy.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const company='11111111-1111-4111-8111-111111111111';
const userId='22222222-2222-4222-8222-222222222222';
const sid='33333333-3333-4333-8333-333333333333';
const fileId='44444444-4444-4444-8444-444444444444';
const secret='isolated-rbac-test-secret';
const lead={id:'deal-id',slug:'deal-id',name:'PRIVATE_CLIENT',phone:'PRIVATE_PHONE',budget:'PRIVATE_BUDGET',manager:'PRIVATE_MANAGER',address:'Work address',project:{materials:'Wood',hardware:'Hinge',color:'White'},order:{production:{stage:'Production'},estimate:{finalAmount:'PRIVATE_PAYMENT'}},messages:[{text:'PRIVATE_MESSAGE'}],tasks:[{title:'PRIVATE_TASK'}]};
async function harness() {
  const state={role:'installer',active:true,userVersion:1,sessionVersion:1,status:'ACTIVE',securityVersion:2,exists:true,fail:false,queries:[],writes:[],files:[{id:fileId,leadId:lead.slug,isCurrent:true,groupKey:'drawings-pdf',pathname:'project-files/safe.pdf',fileName:'safe.pdf'}]};
  const env={DISET_DEFAULT_COMPANY_ID:company,BOSE_AUTH_SECRET:secret,NODE_ENV:'test'};
  const context=vm.createContext({process:{env},console:{info(){},warn(){},error(){}},crypto:webcrypto,TextEncoder,TextDecoder,URL,URLSearchParams,Uint8Array,Buffer,Date,Number,Math,JSON,btoa,atob,Response,Request,Headers,structuredClone,setTimeout,clearTimeout});
  const query=async(sql,args=[])=>{
    state.queries.push(sql);if(state.fail)throw new Error('DB unavailable');
    if(sql.includes('from miniapp_sessions s'))return {rows:state.exists&&args[0]===sid&&args[1]===company&&args[2]==='123456'?[{id:sid,company_id:company,telegram_user_id:'123456',subject_type:'user',subject_id:userId,user_id:userId,profile_id:null,role:state.role,is_active:state.active,auth_version:state.userVersion,user_auth_version:state.userVersion,session_auth_version:state.sessionVersion,session_status:state.status,security_version:state.securityVersion,expires_at:new Date(Date.now()+60000).toISOString()}]:[]};
    if(sql.startsWith('select')&&sql.includes('from users')) {
      if(args[1] && args[1] !== '123456')return {rows:[],rowCount:0};
      if(sql.includes("role='owner'")&&state.role!=='owner')return {rows:[],rowCount:0};
      return {rows:state.active?[{id:userId,company_id:company,telegram_user_id:'123456',full_name:'Worker',role:state.role,auth_version:state.userVersion}]:[],rowCount:state.active?1:0};
    }
    if(sql.includes('from clients'))return {rows:[]};
    if(sql.includes('from project_file_versions'))return {rows:[]};
    if(/^(insert|update|delete)/i.test(sql)){state.writes.push(sql);return {rows:[],rowCount:1};}
    return {rows:[],rowCount:0};
  };
  const overrides={
    'lib/db.js':{query,isLiveDatabaseEnabled:()=>true,getPool:()=>({connect:async()=>({query,release(){}})})},
    'lib/server-data.js':{getLeadsData:async()=>[lead],getLeadBySlug:async()=>lead},
    'lib/project-files.js':{listProjectFiles:async()=>state.files,getProjectFile:async id=>state.files.find(file=>file.id===id)},
    'lib/persistent-store.js':{isBlobStoreEnabled:()=>true,getPrivateBlob:async()=>({statusCode:200,stream:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('safe project file'));c.close();}})})},
    'lib/telegram.js':{getTelegramBotToken:()=>{throw new Error('Real Telegram must never be used');}}
  };
  const modules=new Map();
  const synthetic=(values)=>new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value)},{context});
  async function load(relative){
    relative=relative.replaceAll('\\','/');if(modules.has(relative))return modules.get(relative);
    if(overrides[relative]){const mod=synthetic(overrides[relative]);modules.set(relative,mod);return mod;}
    const mod=new vm.SourceTextModule(await readFile(path.join(root,relative),'utf8'),{context,identifier:relative});modules.set(relative,mod);
    await mod.link(async(spec,ref)=>{
      if(spec==='next/server')return synthetic({NextRequest,NextResponse});
      if(spec==='node:crypto')return synthetic({...nodeCrypto,default:nodeCrypto});
      if(!spec.startsWith('.'))throw new Error('Unexpected dependency: '+spec);
      let target=path.posix.normalize(path.posix.join(path.posix.dirname(ref.identifier),spec));if(!path.posix.extname(target))target+='.js';return load(target);
    });return mod;
  }
  async function get(p){const mod=await load(p);if(mod.status==='linked')await mod.evaluate();return mod.namespace;}
  const signing=await get('lib/security/session-auth.js');
  const cookie=()=>signing.createBoseSessionToken({sessionId:sid,companyId:company,telegramUserId:'123456',role:'owner',isOwner:true,expiresAt:Date.now()+60000});
  return {state,get,cookie,query,signing,stub:(file,values)=>{overrides[file]=values;}};
}

test('each role has an explicit web/API boundary and minimal project DTO',()=>{
  for(const role of STAFF_ROLES){const s={role};assert.equal(canAccessRoute(s,'/projects','GET'),true);assert.equal(canAccessRoute(s,'/api/projects','GET'),true);assert.equal(canAccessRoute(s,'/api/leads','GET'),['owner','manager'].includes(role));assert.equal(canAccessRoute(s,'/api/leads/x','PATCH'),['owner','manager'].includes(role));assert.equal(canAccessRoute(s,'/api/admin/demo-state/cleanup','POST'),role==='owner');assert.equal(canAccessRoute(s,'/api/telegram/webhook','GET'),role==='owner');assert.equal(canAccessRoute(s,'/project-files/unsafe.pdf','GET'),false);}
  for(const role of PROJECT_ONLY_ROLES){const text=JSON.stringify(projectDto(lead,role));assert.doesNotMatch(text,/PRIVATE_/);assert.equal(canReadProjectFile(role,{isCurrent:true,groupKey:'estimate-excel'}),false);}
  assert.equal(projectDto(lead,'production').address,undefined);
  assert.equal(projectDto(lead,'installer').address,'Work address');
});

test('v2 contains identity only; authentic legacy v1 and tampering are rejected',async()=>{
  const h=await harness();const token=await h.cookie();const payload=JSON.parse(Buffer.from(token.split('.')[0],'base64url'));assert.equal(payload.v,2);assert.equal(payload.role,undefined);assert.equal(payload.owner,undefined);
  const body=Buffer.from(JSON.stringify({v:1,sid,subjectId:userId,role:'owner',owner:true,exp:Date.now()+60000})).toString('base64url');
  const old=body+'.'+createHmac('sha256',secret).update(body).digest('base64url');assert.equal(await h.signing.verifyBoseSessionToken(old),null);assert.equal(await h.signing.verifyBoseSessionToken(token+'x'),null);
});

test('cookie cannot preserve owner rights after a DB role change; revocation fails closed',async()=>{
  const h=await harness();h.state.role='owner';const token=await h.cookie();const server=await h.get('lib/security/session-server.js');assert.equal((await server.resolveServerSession(token)).isOwner,true);
  h.state.role='installer';assert.equal((await server.resolveServerSession(token)).isOwner,false);assert.equal((await server.resolveServerSession(token)).role,'installer');
  for(const patch of [{userVersion:2},{active:false},{status:'ENDED'},{exists:false},{securityVersion:1}]){Object.assign(h.state,{userVersion:1,active:true,status:'ACTIVE',exists:true,securityVersion:2},patch);assert.equal(await server.resolveServerSession(token),null);}
  assert.ok(h.state.queries.filter(sql=>sql.includes('from miniapp_sessions s')).length>=7);
});

test('self-selected director and matching username cannot change the DB-assigned installer role',async()=>{
  const h=await harness();const auth=await h.get('lib/telegram/miniapp-auth.js');const subject=await auth.resolveMiniAppSubject({telegramUserId:'123456',telegramUsername:'murat_rdn',role:'director',isOwner:true});assert.equal(subject.role,'installer');assert.equal(h.state.queries.some(sql=>sql.includes('telegram_subscribers')),false);assert.equal(h.state.queries.some(sql=>sql.includes('lower(')),false);
  const staff=await h.get('lib/security/staff-access.js');await assert.rejects(staff.assignStaffRole('123456',{telegramUserId:'999999',role:'manager',name:'Other'}),/только владелец/);assert.equal(h.state.writes.length,0);
  h.state.role='owner';await assert.rejects(staff.assignStaffRole('123456',{telegramUserId:'999999',role:'owner',name:'Other'}),/Владельцы задаются отдельно/);
});

test('HTTP integration: actual middleware and handlers enforce every role, blob ownership, no-cache and DB failure',async()=>{
  const h=await harness();const middleware=await h.get('middleware.js');const projects=await h.get('app/api/projects/route.js');const leads=await h.get('app/api/leads/route.js');const blob=await h.get('app/api/blob/route.js');
  const server=createServer(async(req,res)=>{try{const request=new NextRequest('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers});let response=await middleware.middleware(request);if(response.headers.get('x-middleware-next')==='1'){response=req.url.startsWith('/api/projects')?await projects.GET(request):req.url.startsWith('/api/blob')?await blob.GET(request):await leads.GET();}res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;const cookie='bose-session='+await h.cookie();
  try {
    assert.equal((await fetch(base+'/api/leads')).status,401);
    for(const role of STAFF_ROLES){h.state.role=role;const p=await fetch(base+'/api/projects',{headers:{cookie}});assert.equal(p.status,200,role);assert.doesNotMatch(await p.text(),/PRIVATE_/);assert.match(p.headers.get('cache-control'),/no-store/);const crm=await fetch(base+'/api/leads',{headers:{cookie}});assert.equal(crm.status,['owner','manager'].includes(role)?200:403,role);const owner=await fetch(base+'/api/admin/demo-state/cleanup',{headers:{cookie}});assert.equal(owner.status,role==='owner'?200:403,role);}
    h.state.role='installer';assert.equal((await fetch(base+'/api/blob?fileId='+fileId,{headers:{cookie}})).status,200);h.state.files[0].groupKey='estimate-excel';assert.equal((await fetch(base+'/api/blob?fileId='+fileId,{headers:{cookie}})).status,403);assert.equal((await fetch(base+'/api/blob?pathname=state/private.json',{headers:{cookie}})).status,403);
    h.state.role='owner';assert.equal((await fetch(base+'/api/leads/x',{method:'PATCH',headers:{cookie,origin:'https://other.invalid'}})).status,403);
    h.state.fail=true;assert.equal((await fetch(base+'/api/projects',{headers:{cookie}})).status,503);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

for(const role of ['production','installer','designer','workshop_head','production_manager','operator'])test(role+' file permissions are independent from CRM rights',()=>{
  const p=staffProjectPermissions(role);assert.equal(p.read,true);assert.equal(p.addFiles,['installer','designer','workshop_head','production_manager'].includes(role));assert.equal(canAccessRoute({role},'/leads','GET'),false);assert.equal(canReadProjectFile(role,{groupKey:'site-file:123',isCurrent:true}),true);assert.equal(canReadProjectFile(role,{groupKey:'estimate-preview',kind:'photo',isCurrent:true}),false);
});


test('actual Telegram register/callback/menu do not grant roles and restore installer buttons',async()=>{
  const h=await harness();const source=await readFile(path.join(root,'lib/telegram-control.js'),'utf8');
  const real=new Set(['./security/staff-access','./security/access-policy','./core/roles','./telegram/project-flow']);
  for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
    if(real.has(match[2]))continue;
    const names=match[1].split(',').map(s=>s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    const stubs=Object.fromEntries(names.map(name=>[name,async()=>null]));
    if(names.includes('isTelegramBotConfigured'))Object.assign(stubs,{isTelegramBotConfigured:()=>false});
    if(names.includes('isRuntimeStatePostgresEnabled'))Object.assign(stubs,{isRuntimeStatePostgresEnabled:()=>true,listTelegramDispatchLogsFromDb:async()=>[],listTelegramRegistrationStatesFromDb:async()=>[]});
    if(names.includes('readPersistentJson'))Object.assign(stubs,{readPersistentJson:async(_,fallback)=>fallback});
    if(names.includes('getLeadsData'))Object.assign(stubs,{getLeadsData:async()=>[]});
    if(names.includes('getBOSEBotScenario'))Object.assign(stubs,{getBOSEBotScenario:()=>null});
    if(names.includes('withProjectChatLock'))Object.assign(stubs,{withProjectChatLock:async(_,fn)=>fn(),projectAccess:async()=>staffProjectPermissions(h.state.role)});
    h.stub(path.posix.normalize('lib/'+match[2])+'.js',stubs);
  }
  const bot=await h.get('lib/telegram-control.js');const from={id:123456,first_name:'Worker'};const chat={id:123456,type:'private'};
  const registered=await bot.handleTelegramCommand('/register director Evil',from,chat);assert.equal(registered.action,'register');assert.equal(h.state.role,'installer');assert.equal(h.state.writes.length,0);
  const selected=await bot.handleTelegramCallbackQuery({id:'test',from,message:{chat},data:'reg|role|director'});assert.equal(selected.action,'registration_role_denied');assert.equal(h.state.writes.length,0);
  for(const command of ['/start','/menu']){const menu=await bot.handleTelegramCommand(command,from,chat);assert.equal(menu.action,'staff_menu');assert.ok(menu.reply.payload.replyMarkup.keyboard.flat().some(button=>button.text==='Проекты'));assert.equal(menu.reply.payload.replyMarkup.is_persistent,true);}
  const denied=await bot.handleTelegramCommand('/staff_role 999999 manager Intruder',from,chat);assert.equal(denied.action,'staff_role_denied');assert.equal(h.state.writes.length,0);
  const crm=await bot.handleTelegramCommand('/today',from,chat);assert.equal(crm.action,'project_only');
  const cb=await bot.handleTelegramCallbackQuery({id:'test',from,message:{chat},data:'fu|done|other-project'});assert.equal(cb.action,'callback_denied');
});
