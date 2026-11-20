import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFile,writeFile,unlink} from 'node:fs/promises';
test('build preserves story, removes Sites dependency and emits isolated PWA',async()=>{
 execFileSync(process.execPath,['scripts/build.mjs']);const html=await readFile('public/index.html','utf8'),event=JSON.parse(await readFile('config/event.json'));
 assert.equal((html.match(/class="story-frame/g)||[]).length,5);assert.ok(html.includes(event.venue.name));assert.match(html,/mountPhotos\(invitation\)/);assert.doesNotMatch(html,/google\.script\.run|chatgpt\.site|setup\.html|fonts\.googleapis/);assert.match(html,/api\('\/rsvp'/);
 const sw=await readFile('public/sw.js','utf8');assert.match(sw,/startsWith\('\/api\/'\)/);assert.doesNotMatch(sw,/admin\.html|admin\.js/);
 const manifest=JSON.parse(await readFile('public/manifest.webmanifest'));assert.equal(manifest.display,'standalone');assert.equal(manifest.icons.length,2);
 const ics=await readFile('public/assets/wedding.ics','utf8');assert.ok(ics.includes('DTSTART;VALUE=DATE:'+event.date.replaceAll('-','')));
 for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});
test('a friend can change names, venue and date without inherited event text',async()=>{
 const config=JSON.parse(await readFile('config/event.example.json'));config.names=['Alex <script>','Sam'];config.date='2028-02-29';config.venue={name:'New venue',city:'New city',address:'New address',mapQuery:'New venue'};
 const file='config/test-temporary.json';await writeFile(file,JSON.stringify(config));
 try{execFileSync(process.execPath,['scripts/build.mjs',file]);const html=await readFile('public/index.html','utf8');assert.doesNotMatch(html,/Partner One|Partner Two|Your wedding venue|Your city|DECEMBER 2028|1 December 2028/);assert.match(html,/Alex &lt;script&gt;/);assert.match(html,/29 February 2028/);const ics=await readFile('public/assets/wedding.ics','utf8');assert.match(ics,/DTEND;VALUE=DATE:20280301/);}
 finally{await unlink(file);execFileSync(process.execPath,['scripts/build.mjs']);}
});
