// Run only on your own computer. Credentials are written to ignored .private/.
import http from 'node:http';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
try{await access('.private/secrets.json');throw Error('Setup already exists. Keep your existing credentials; do not reconnect unless deliberately creating a fresh event.');}catch(e){if(e.code!=='ENOENT')throw e;}
const event=JSON.parse(await readFile('config/event.json'));
const downloaded=JSON.parse(await readFile('.private/oauth-client.json'));
const client=downloaded.web;if(!client)throw Error('Use a Web application OAuth client. See docs/DEPLOY.md.');
const redirect='http://localhost:8787/callback',state=randomBytes(32).toString('hex');
const auth=new OAuth2Client(client.client_id,client.client_secret,redirect);
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost:8787');if(url.pathname!=='/callback'){res.writeHead(404).end();return;}
 if(url.searchParams.get('state')!==state){res.writeHead(403).end('Invalid state.');return;}
 if(!url.searchParams.get('code')){res.writeHead(400).end('Authorisation was not completed.');return;}
 try{
  const {tokens}=await auth.getToken(url.searchParams.get('code'));if(!tokens.refresh_token)throw Error('No refresh token received. Revoke this app’s prior grant, then retry.');auth.setCredentials(tokens);
  const {token}=await auth.getAccessToken();
  async function json(url,body){const r=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('Google setup request failed ('+r.status+'). Check enabled APIs and permissions.');return r.json();}
  const folder=async(name,parent)=>(await json('https://www.googleapis.com/drive/v3/files?fields=id',{name,mimeType:'application/vnd.google-apps.folder',...(parent?{parents:[parent]}:{})})).id;
  const root=await folder(event.names.join(' & ')+' · Wedding');
  const pending=await folder('Pending uploads — PRIVATE',root),approved=await folder('Approved gallery',root);
  const sheet=await json('https://sheets.googleapis.com/v4/spreadsheets',{properties:{title:event.names.join(' & ')+' · RSVP'},sheets:[{properties:{title:'RSVP'}}]});
  const headers=['Invitation ID','Updated at','Guest name','Attending','Party type','Guest count','Companion names','Staying over','Staying count','Message'];
  const r=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values/RSVP!A1:J1?valueInputOption=RAW`,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({values:[headers]})});if(!r.ok)throw Error('Could not initialise RSVP sheet.');
  await mkdir('.private',{recursive:true,mode:0o700});
  const secrets={GOOGLE_CLIENT_ID:client.client_id,GOOGLE_CLIENT_SECRET:client.client_secret,GOOGLE_REFRESH_TOKEN:tokens.refresh_token,INVITE_SECRET:randomBytes(32).toString('hex'),ADMIN_SECRET:randomBytes(32).toString('hex')};
  await writeFile('.private/secrets.json',JSON.stringify(secrets,null,2),{mode:0o600});
  const settings={PENDING_FOLDER_ID:pending,APPROVED_FOLDER_ID:approved,SHEET_ID:sheet.spreadsheetId,PUBLIC_ORIGIN:'REPLACE_WITH_FIREBASE_ORIGIN'};
  await writeFile('.private/runtime.json',JSON.stringify(settings,null,2),{mode:0o600});
  await writeFile('.private/resources.json',JSON.stringify({rootFolderId:root,pendingFolderId:pending,approvedFolderId:approved,sheetId:sheet.spreadsheetId},null,2),{mode:0o600});
  res.writeHead(200,{'Content-Type':'text/plain'}).end('Connected. Return to your terminal. All folders are private.');
  console.log('Connected. Owner credentials: .private/secrets.json. Resources: .private/resources.json. Follow docs/DEPLOY.md next.');server.close();
 }catch(e){res.writeHead(500,{'Content-Type':'text/plain'}).end('Setup did not finish. See your terminal.');console.error(e.message);server.close();process.exitCode=1;}
});
server.listen(8787,'127.0.0.1',()=>console.log('Open this URL in your browser and authorise the Google account that will own the photos:\n'+auth.generateAuthUrl({access_type:'offline',prompt:'consent',scope:['https://www.googleapis.com/auth/drive.file'],state})));
setTimeout(()=>{console.error('Setup timed out. Run again to retry.');server.close();process.exitCode=1;},10*60*1000).unref();
