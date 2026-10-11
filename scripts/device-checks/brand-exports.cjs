const { chromium } = require('/home/user/AAICBI/node_modules/playwright-core');
const fs=require('fs');const D='/home/user/AAICBI/docs/brand';
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 // PNG exports from SVG
 const p=await b.newPage({deviceScaleFactor:1});
 const jobs={ 'aaicbi-symbol':[1024,1024],'aaicbi-symbol-reverse':[1024,1024],'aaicbi-app-icon':[1024,1024],'aaicbi-app-icon-light':[1024,1024],'aaicbi-primary-horizontal':[2400,0],'aaicbi-primary-horizontal-reverse':[2400,0],'aaicbi-primary-stacked':[1600,0],'aaicbi-primary-stacked-reverse':[1600,0],'aaicbi-secondary-horizontal':[1800,0],'aaicbi-secondary-horizontal-reverse':[1800,0]};
 for(const [n,[w]] of Object.entries(jobs)){ const svg=fs.readFileSync(`${D}/svg/${n}.svg`,'utf8'); const vb=svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); const h=Math.round(w*vb[2]/vb[1]);
  const dark=n.includes('reverse')&&!n.includes('app-icon'); await p.setViewportSize({width:w,height:h});
  await p.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg ',`<svg width="${w}" height="${h}" `)}</body>`); await p.screenshot({path:`${D}/png/${n}.png`,omitBackground:true}); }
 const g=await b.newPage({viewport:{width:1280,height:900}}); await g.goto('file://'+D+'/brand-guide.html'); await g.waitForTimeout(500);
 await g.pdf({path:D+'/brand-guide.pdf',format:'A3',printBackground:true,margin:{top:'10mm',bottom:'10mm',left:'8mm',right:'8mm'}});
 await g.screenshot({path:'/tmp/g-full.png',fullPage:true});
 const m=await b.newPage({viewport:{width:390,height:800},deviceScaleFactor:1}); await m.goto('file://'+D+'/brand-guide.html'); console.log('mobile overflow',await m.evaluate(()=>{const o=[];document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();if(r.right>innerWidth+1&&o.length<6)o.push(e.tagName+'.'+e.className+' '+Math.round(r.right))});return [document.documentElement.scrollWidth,o]}));
 await b.close()})();
