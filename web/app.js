const tokenFromHash=new URLSearchParams(location.hash.slice(1)).get('invite');
if(tokenFromHash){sessionStorage.setItem('shaadi-invite',tokenFromHash);history.replaceState(null,'',location.pathname+location.search);}
const token=()=>sessionStorage.getItem('shaadi-invite')||'';
export async function api(path,options={}){
 const response=await fetch('/api'+path,{...options,cache:'no-store',headers:{Authorization:'Bearer '+token(),...(options.body instanceof Blob?{}:{'Content-Type':'application/json'}),...options.headers}});
 let data;try{data=await response.json();}catch{throw new Error('The service is not connected yet. Please contact the hosts.');}
 if(!response.ok){const error=new Error(data.error||'Please try again.');error.status=response.status;throw error;}return data;
}
export async function loadInvite(){
 if(!token())return null;
 try{return await api('/invite');}catch(e){document.getElementById('accessStatus').textContent=e.message;return null;}
}
export function mountAccess(invite){
 const box=document.getElementById('accessBox');box.hidden=Boolean(invite);
 document.getElementById('accessForm').onsubmit=e=>{e.preventDefault();try{const value=document.getElementById('inviteLink').value.trim();const t=value.includes('#')?new URLSearchParams(new URL(value).hash.slice(1)).get('invite'):value;if(!t||!/^\w{32}\.[\w-]+$/.test(t))throw Error();sessionStorage.setItem('shaadi-invite',t);location.reload();}catch{document.getElementById('accessStatus').textContent='Please paste the personal invitation link from the hosts.';}};
 document.getElementById('forgetInvite').onclick=()=>{sessionStorage.clear();location.reload();};
 document.getElementById('forgetInvite').hidden=!invite;
}
function mimeFor(file){if(['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type))return file.type;return ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif'})[file.name.split('.').pop().toLowerCase()]||'';}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function retry(task){for(let i=0;i<5;i++){try{return await task();}catch(e){if(e.status&&![409,429,500,502,503,504].includes(e.status))throw e;if(i===4)throw e;await delay(Math.min(8000,800*2**i));}}}
export function mountPhotos(invite){
 const form=document.getElementById('photoForm'),status=document.getElementById('photoStatus'),progress=document.getElementById('uploadProgress'),list=document.getElementById('photoList');
 if(!invite){form.querySelectorAll('input,button').forEach(el=>el.disabled=true);status.textContent='Open your personal invitation link to share photos.';return;}
 const settings=invite.uploads;
 document.getElementById('uploadLimit').textContent='Original files · JPEG, PNG, WebP, HEIC / HEIF · Up to '+Math.round(settings.maxFileBytes/1048576)+' MB per photo';
 if(!settings.enabled||Date.now()<Date.parse(settings.opensAt)||Date.now()>Date.parse(settings.closesAt)){status.textContent='Photo sharing opens '+new Date(settings.opensAt).toLocaleDateString()+' and closes '+new Date(settings.closesAt).toLocaleDateString()+'.';form.querySelectorAll('input,button').forEach(el=>el.disabled=true);return;}
 const queue=[];
 for(const id of ['photoFiles','cameraFile'])document.getElementById(id).onchange=e=>{for(const file of e.target.files){if(!queue.some(f=>f.name===file.name&&f.size===file.size&&f.lastModified===file.lastModified))queue.push(file);}render();};
 function render(){list.replaceChildren();queue.forEach((f,i)=>{const item=document.createElement('li');item.textContent=f.name+' · '+(f.size/1048576).toFixed(1)+' MB ';const remove=document.createElement('button');remove.type='button';remove.className='text-button';remove.textContent='Remove';remove.onclick=()=>{queue.splice(i,1);render();};item.append(remove);list.append(item);});}
 form.onsubmit=async e=>{
  e.preventDefault();if(!queue.length){status.textContent='Choose at least one photo.';return;}
  form.querySelectorAll('button,input').forEach(el=>el.disabled=true);progress.hidden=false;let completed=0;
  const total=queue.reduce((n,f)=>n+f.size,0);
  try{
   while(queue.length){
    const file=queue[0],mime=mimeFor(file);if(!mime||file.size>settings.maxFileBytes||file.size<16)throw Error('Please remove '+file.name+': unsupported format or size.');
    status.textContent='Preparing '+file.name+'… Keep this page open during uploads.';
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
    const storageKey='shaadi-upload-'+token().slice(0,32)+'-'+digest;
    let id=sessionStorage.getItem(storageKey);if(!id){id=crypto.randomUUID().replaceAll('-','');sessionStorage.setItem(storageKey,id);}
    await retry(()=>api('/uploads',{method:'POST',body:JSON.stringify({id,name:file.name,size:file.size,mime})}));
    let result=await retry(()=>api('/uploads/'+id));
    while(result.offset<file.size){
     status.textContent='Uploading '+file.name+' · '+Math.floor(result.offset/file.size*100)+'%';
     result=await retry(async()=>{
      const current=await api('/uploads/'+id);if(current.offset>=file.size)return current;
      return api('/uploads/'+id+'?offset='+current.offset,{method:'PUT',body:file.slice(current.offset,Math.min(file.size,current.offset+4194304))});
     });
     progress.value=(completed+result.offset)/total;
    }
    completed+=file.size;queue.shift();render();form.querySelectorAll('button,input').forEach(el=>el.disabled=true);
   }
   status.textContent='Your photos are received and private. The hosts will review them before sharing.';progress.value=1;
  }catch(e){status.textContent=e.message+' You can retry with the remaining selected photos; completed chunks will be checked first.';}
  finally{form.querySelectorAll('button,input').forEach(el=>el.disabled=false);document.getElementById('photoFiles').value='';document.getElementById('cameraFile').value='';}
 };
}
export function installPwa(){
 if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
 let prompt;const button=document.getElementById('installApp');
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;button.hidden=false;});
 button.onclick=async()=>{if(prompt){await prompt.prompt();prompt=null;button.hidden=true;}};
}
