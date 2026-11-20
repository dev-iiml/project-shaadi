import {createHmac, timingSafeEqual, randomBytes} from 'node:crypto';
export class AppError extends Error { constructor(status,message){super(message);this.status=status;} }
export const fail=(status,message)=>{throw new AppError(status,message);};
export const uid=()=>randomBytes(16).toString('hex');
export function safeEqual(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);}
export function signInvite(id,key){return id+'.'+createHmac('sha256',key).update(id).digest('base64url');}
export function verifyInvite(token,key){const [id,sig,...rest]=(token||'').split('.');if(rest.length||!/^\w{32}$/.test(id||'')||!safeEqual(token,signInvite(id,key)))fail(401,'Open your personal invitation link to continue.');return id;}
export function text(value,max,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(400,'Please check the text fields.');return value.trim();}
export function validateRsvp(data,guest){
 const attending=data.attending;if(!['Yes','No'].includes(attending))fail(400,'Please choose whether you are attending.');
 const yes=attending==='Yes',party=yes?data.partyType:'Not attending';
 if(yes&&!['Solo','Plus one','Family'].includes(party))fail(400,'Please choose your party type.');
 const count=yes?Number(data.guestCount):0;
 if(!Number.isInteger(count)||count<0||(yes&&count<1)||count>guest.maxGuests||(party==='Solo'&&count!==1)||(party==='Plus one'&&count!==2))fail(400,'Please check your guest count.');
 const stay=yes&&guest.allowStay?data.stayingOver:yes?'Not asked':'Not applicable';
 if(yes&&guest.allowStay&&!['Yes','No'].includes(stay))fail(400,'Please choose your overnight-stay preference.');
 const stayingCount=stay==='Yes'?Number(data.stayingCount):0;
 if(!Number.isInteger(stayingCount)||stayingCount<0||stayingCount>count||(stay==='Yes'&&stayingCount<1))fail(400,'Please check the overnight guest count.');
 if(data.website)fail(400,'Unable to accept this reply.');
 return {guestName:text(data.guestName,100,true),attending,partyType:party,guestCount:count,companionNames:text(data.companionNames||'',300),stayingOver:stay,stayingCount,message:text(data.message||'',1000),version:guest.allowStay?'stay':'attendance'};
}
export function imageType(bytes){
 if(bytes.length>=3&&bytes.subarray(0,3).equals(Buffer.from([255,216,255])))return 'image/jpeg';
 if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
 if(bytes.length>=16&&bytes.toString('ascii',4,8)==='ftyp'){
  const brands=[bytes.toString('ascii',8,12)];for(let i=16;i+4<=Math.min(bytes.length,64);i+=4)brands.push(bytes.toString('ascii',i,i+4));
  if(brands.some(b=>['heic','heix','hevc','hevx'].includes(b)))return 'image/heic';
  if(brands.some(b=>['mif1','msf1'].includes(b)))return 'image/heif';
 }return null;
}
export const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif'};
export function validateUpload(data,event){
 const size=Number(data.size),mime=data.mime;
 if(!Number.isSafeInteger(size)||size<16||size>event.uploads.maxFileBytes)fail(400,'This photo is empty or exceeds the upload size limit.');
 if(!extensions[mime])fail(400,'Choose a JPEG, PNG, WebP, HEIC or HEIF photo.');
 return {size,mime,originalName:text(data.name,200,true)};
}
export function assertUploadsOpen(event,now=Date.now()){
 if(!event.uploads.enabled||now<Date.parse(event.uploads.opensAt)||now>Date.parse(event.uploads.closesAt))fail(403,'Photo uploads are currently closed.');
}
export function nextOffset(response,total){
 if(response.status===200||response.status===201)return total;
 if(response.status!==308)fail(502,'The photo service could not confirm this upload. Please retry.');
 const range=response.headers.get('range');if(!range)return 0;
 const match=/^bytes=0-(\d+)$/.exec(range);if(!match)fail(502,'Invalid upload progress response.');
 const offset=Number(match[1])+1;if(offset>total)fail(502,'Invalid upload progress response.');return offset;
}
export const sheetCell=value=>typeof value==='string'&&/^[=+@\-\t\r]/.test(value)?"'"+value:value;
export function rsvpRow(id,data){return [id,data.updatedAt,data.guestName,data.attending,data.partyType,data.guestCount,data.companionNames,data.stayingOver,data.stayingCount,data.message].map(sheetCell);}
