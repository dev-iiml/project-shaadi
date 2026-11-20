import {OAuth2Client} from 'google-auth-library';
import {AppError} from './domain.mjs';
export class Google {
 constructor(env){this.auth=new OAuth2Client(env.GOOGLE_CLIENT_ID,env.GOOGLE_CLIENT_SECRET);this.auth.setCredentials({refresh_token:env.GOOGLE_REFRESH_TOKEN});}
 async request(url,options={}){
  const {token}=await this.auth.getAccessToken();
  const r=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(15000),headers:{...options.headers,Authorization:'Bearer '+token}});
  if(!r.ok&&r.status!==308)throw new AppError(502,'Google could not complete the request. Please retry.');return r;
 }
 async json(url,options={}){return (await this.request(url,options)).json();}
 async folder(name,parent){const f=await this.json('https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',parents:[parent]})});return f.id;}
 async createSession({fileId,name,mime,size,parent}){
  // Pre-generate the file ID to make initialization retries idempotent.
  const r=await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size,mimeType,parents',{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':mime,'X-Upload-Content-Length':String(size)},body:JSON.stringify({id:fileId,name,mimeType:mime,parents:[parent]})});
  const uri=r.headers.get('location');if(!uri||new URL(uri).origin!=='https://www.googleapis.com')throw new AppError(502,'Could not create the upload session.');return uri;
 }
 async generatedId(){return (await this.json('https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive')).ids[0];}
 async status(session){const r=await this.request(session.uri,{method:'PUT',headers:{'Content-Length':'0','Content-Range':`bytes */${session.size}`}});return r;}
 async put(session,offset,bytes){return this.request(session.uri,{method:'PUT',headers:{'Content-Type':session.mime,'Content-Range':`bytes ${offset}-${offset+bytes.length-1}/${session.size}`},body:bytes});}
 async metadata(id){return this.json(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,size,mimeType,parents,name`);}
 async move(id,from,to){return this.json(`https://www.googleapis.com/drive/v3/files/${id}?addParents=${to}&removeParents=${from}&fields=id,parents`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{}'});}
 async sheet(id,guestId,data){
  const base=`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/`;
  const rows=(await this.json(base+encodeURIComponent('RSVP!A:A'))).values||[];
  const {rsvpRow}=await import('./domain.mjs');const row=rows.findIndex(r=>r[0]===guestId);
  const values={values:[rsvpRow(guestId,data)]};
  if(row>=0)await this.json(base+encodeURIComponent(`RSVP!A${row+1}:J${row+1}`)+'?valueInputOption=RAW',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
  else await this.json(base+encodeURIComponent('RSVP!A:J')+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
 }
}
