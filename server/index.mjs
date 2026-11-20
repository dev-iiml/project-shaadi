import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {Firestore} from '@google-cloud/firestore';
import {Google} from './google.mjs';
import {AppError,fail,uid,safeEqual,signInvite,verifyInvite,text,validateRsvp,validateUpload,assertUploadsOpen,imageType,nextOffset,extensions} from './domain.mjs';
export function createApp({env,event,db,google}){
for(const key of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN','INVITE_SECRET','ADMIN_SECRET','PENDING_FOLDER_ID','APPROVED_FOLDER_ID','SHEET_ID','PUBLIC_ORIGIN'])if(!env[key])throw new Error('Missing configuration: '+key);
if(env.INVITE_SECRET.length<32||env.ADMIN_SECRET.length<32)throw new Error('Use secrets of at least 32 characters.');
const root=db.collection('events').doc(event.id);
const guests=root.collection('guests'),uploads=root.collection('uploads');
const CHUNK=4*1024*1024;
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req,limit=16384){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>limit)fail(413,'Request is too large.');parts.push(part);}return Buffer.concat(parts);}
async function json(req){try{return JSON.parse((await body(req)).toString());}catch(e){if(e instanceof AppError)throw e;fail(400,'Invalid request.');}}
async function guestAuth(req){const id=verifyInvite(req.headers.authorization?.replace(/^Bearer /,''),env.INVITE_SECRET),snap=await guests.doc(id).get();if(!snap.exists||snap.data().revoked)fail(401,'This invitation is no longer active.');return {id,...snap.data()};}
function adminAuth(req){if(!safeEqual(req.headers.authorization,'Bearer '+env.ADMIN_SECRET))fail(401,'Owner access is required.');}
async function lease(ref,fn){
 const lock=uid();await db.runTransaction(async t=>{const s=await t.get(ref);if(!s.exists)fail(404,'Record not found.');if((s.data().lockUntil||0)>Date.now())fail(409,'Another request is in progress. Please retry shortly.');t.update(ref,{lock,lockUntil:Date.now()+90000});});
 try{return await fn();}finally{await db.runTransaction(async t=>{const s=await t.get(ref);if(s.data()?.lock===lock)t.update(ref,{lockUntil:0});});}
}
async function ensureGuestFolder(guest,kind){
 const ref=guests.doc(guest.id),field=kind==='pending'?'pendingFolder':'approvedFolder';
 const current=(await ref.get()).data();if(current[field])return current[field];
 const parent=kind==='pending'?env.PENDING_FOLDER_ID:env.APPROVED_FOLDER_ID;
 const id=await google.folder(current.name+' — '+guest.id.slice(0,8),parent);await ref.update({[field]:id});return id;
}
async function complete(ref,s){
 const file=await google.metadata(s.fileId);
 if(Number(file.size)!==s.size||file.mimeType!==s.mime||!file.parents?.includes(s.parent))fail(502,'The uploaded photo could not be verified. Contact the hosts.');
 await ref.update({status:'pending',offset:s.size,completedAt:new Date().toISOString()});return {offset:s.size,status:'pending'};
}
const server=http.createServer(async(req,res)=>{
 try{
  const origin=req.headers.origin;if(origin&&origin!==env.PUBLIC_ORIGIN)fail(403,'Origin not allowed.');
  const u=new URL(req.url,'http://localhost'),path=u.pathname,method=req.method;
  if(path==='/api/health'&&method==='GET')return send(res,200,{ok:true});
  if(path.startsWith('/api/admin/')){
   adminAuth(req);
   if(path==='/api/admin/invites'&&method==='POST'){
    const d=await json(req),id=uid(),maxGuests=Number(d.maxGuests);if(!Number.isInteger(maxGuests)||maxGuests<1||maxGuests>30)fail(400,'Guest limit must be between 1 and 30.');
    await guests.doc(id).create({name:text(d.name,100,true),maxGuests,allowStay:d.allowStay===true,revoked:false,reservedFiles:0,reservedBytes:0});
    return send(res,201,{id,url:env.PUBLIC_ORIGIN+'/#invite='+signInvite(id,env.INVITE_SECRET)});
   }
   if(path==='/api/admin/invites'&&method==='GET')return send(res,200,{guests:(await guests.limit(500).get()).docs.map(d=>({id:d.id,name:d.data().name,revoked:d.data().revoked,rsvp:d.data().rsvp||null,sheetSynced:d.data().sheetSynced??null}))});
   const inviteAction=/^\/api\/admin\/invites\/([a-f0-9]{32})\/(revoke|sync)$/.exec(path);
   if(inviteAction&&method==='POST'){
    const ref=guests.doc(inviteAction[1]);
    return await lease(ref,async()=>{const s=(await ref.get()).data();if(inviteAction[2]==='revoke')await ref.update({revoked:true});else {if(!s.rsvp)fail(400,'No RSVP to sync.');await google.sheet(env.SHEET_ID,ref.id,s.rsvp);await ref.update({sheetSynced:true});}send(res,200,{ok:true});});
   }
   if(path==='/api/admin/photos'&&method==='GET')return send(res,200,{photos:(await uploads.where('status','==','pending').limit(100).get()).docs.map(d=>({id:d.id,...Object.fromEntries(['originalName','guestName','size','fileId','completedAt'].map(k=>[k,d.data()[k]]))}))});
   const photoAction=/^\/api\/admin\/photos\/([a-f0-9]{32})\/(approve|reject)$/.exec(path);
   if(photoAction&&method==='POST'){
    const ref=uploads.doc(photoAction[1]);return await lease(ref,async()=>{
     const s=(await ref.get()).data();if(s.status!=='pending')fail(409,'This photo has already been reviewed.');
     if(photoAction[2]==='approve'){
      await lease(guests.doc(s.guestId),async()=>{const dest=await ensureGuestFolder({id:s.guestId},'approved');const meta=await google.metadata(s.fileId);if(!meta.parents?.includes(dest))await google.move(s.fileId,s.parent,dest);});
      await ref.update({status:'approved'});
     }else await ref.update({status:'rejected'}); // Rejected originals remain private; the owner may delete them in Drive.
     send(res,200,{ok:true});
    });
   }
   fail(404,'Unknown owner action.');
  }
  const guest=await guestAuth(req);
  if(path==='/api/invite'&&method==='GET')return send(res,200,{name:guest.name,maxGuests:guest.maxGuests,allowStay:guest.allowStay,rsvp:guest.rsvp||null,uploads:event.uploads});
  if(path==='/api/rsvp'&&method==='POST'){
   const data=validateRsvp(await json(req),guest),ref=guests.doc(guest.id);
   return await lease(ref,async()=>{
    data.updatedAt=new Date().toISOString();await ref.update({rsvp:data,sheetSynced:false});
    // Firestore is the durable source of truth; Sheets is a recoverable projection.
    let sheetSynced=true;try{await google.sheet(env.SHEET_ID,guest.id,data);}catch{sheetSynced=false;}
    await ref.update({sheetSynced});send(res,200,{ok:true,sheetSynced});
   });
  }
  if(path==='/api/uploads'&&method==='POST'){
   assertUploadsOpen(event);const input=await json(req),data=validateUpload(input,event),id=text(input.id,32,true);
   if(!/^[a-f0-9]{32}$/.test(id))fail(400,'Invalid upload identifier.');
   const ref=uploads.doc(id);
   const exists=await ref.get();if(exists.exists){if(exists.data().guestId!==guest.id)fail(403,'Upload belongs to another guest.');return send(res,200,{id});}
   const guestRef=guests.doc(guest.id);
   return await lease(guestRef,async()=>{
    const current=(await guestRef.get()).data();
    if(current.reservedFiles>=event.uploads.maxFilesPerInvite||current.reservedBytes+data.size>event.uploads.maxBytesPerInvite)fail(429,'Your invitation’s photo allowance has been reached. Contact the hosts.');
    const parent=await ensureGuestFolder(guest,'pending'),fileId=await google.generatedId();
    // Reserve before starting Google requests. Abandoned sessions intentionally count against allowance.
    await db.runTransaction(async t=>{const check=await t.get(ref);if(check.exists)fail(409,'Upload already exists; retry.');t.create(ref,{...data,guestId:guest.id,guestName:guest.name,parent,fileId,status:'initializing',offset:0,createdAt:new Date().toISOString()});t.update(guestRef,{reservedFiles:current.reservedFiles+1,reservedBytes:current.reservedBytes+data.size});});
    const uri=await google.createSession({...data,parent,fileId,name:id+'.'+extensions[data.mime]});await ref.update({uri,status:'uploading'});send(res,201,{id});
   });
  }
  const uploadMatch=/^\/api\/uploads\/([a-f0-9]{32})$/.exec(path);
  if(uploadMatch&&['GET','PUT'].includes(method)){
   const ref=uploads.doc(uploadMatch[1]),snapshot=await ref.get();if(!snapshot.exists)fail(404,'Upload not found.');if(snapshot.data().guestId!==guest.id)fail(403,'Upload belongs to another guest.');
   const bytes=method==='PUT'?await body(req,CHUNK):null;
   return await lease(ref,async()=>{
    const s=(await ref.get()).data();
    if(['pending','approved','rejected'].includes(s.status))return send(res,200,{offset:s.size,status:s.status});
    if(s.status==='initializing'){
     // A failed initiation may have left no usable URI. Keep the reserved slot, then retry with the same file ID.
     const uri=await google.createSession({...s,name:ref.id+'.'+extensions[s.mime]});await ref.update({uri,status:'uploading'});s.uri=uri;
    }
    const status=await google.status(s),offset=nextOffset(status,s.size);
    if(offset===s.size)return send(res,200,await complete(ref,s));
    if(method==='GET')return send(res,200,{offset,status:'uploading'});
    assertUploadsOpen(event);
    if(Number(u.searchParams.get('offset'))!==offset)return send(res,409,{error:'Upload progress changed; retry.',offset});
    if(!bytes.length||offset+bytes.length>s.size||(offset+bytes.length<s.size&&bytes.length%262144!==0))fail(400,'Invalid upload chunk.');
    if(offset===0){const detected=imageType(bytes);if(detected!==s.mime)fail(400,'The file content does not match an allowed image type.');}
    const r=await google.put(s,offset,bytes),next=nextOffset(r,s.size);
    if(next===s.size)return send(res,200,await complete(ref,s));
    await ref.update({offset:next});send(res,200,{offset:next,status:'uploading'});
   });
  }
  fail(404,'Page not found.');
 }catch(e){const status=e instanceof AppError?e.status:500;if(status===500)console.error('Request failed',e.name);if(!res.headersSent)send(res,status,{error:e instanceof AppError?e.message:'The request could not be completed. Please retry.'});else res.end();}
});
server.requestTimeout=60000;return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const env=process.env,event=JSON.parse(await readFile(new URL('../config/event.json',import.meta.url)));
 createApp({env,event,db:new Firestore(),google:new Google(env)}).listen(Number(env.PORT||8080),'0.0.0.0');
}
