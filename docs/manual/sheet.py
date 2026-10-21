import sys,glob,os
from PIL import Image,ImageDraw
folder,kind,cols,start,count=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4]),int(sys.argv[5])
fs=sorted(glob.glob(f'screenshots/{folder}/*-{kind}.png'))[start:start+count]
W=700 if kind=='desktop' else 300
ims=[]
for f in fs:
    im=Image.open(f).convert('RGB'); r=W/im.width; im=im.resize((W,int(im.height*r)))
    if kind=='mobile': im=im.crop((0,0,W,min(im.height,650)))
    else: im=im.crop((0,0,W,min(im.height,440)))
    d=ImageDraw.Draw(im); d.rectangle((0,0,W,16),fill=(255,255,0)); d.text((3,2),os.path.basename(f),fill=(0,0,0)); ims.append(im)
rows=(len(ims)+cols-1)//cols; H=max(i.height for i in ims)
S=Image.new('RGB',(cols*(W+6),rows*(H+6)),(80,80,80))
for i,im in enumerate(ims): S.paste(im,((i%cols)*(W+6),(i//cols)*(H+6)))
S.save('/tmp/dev/sheet.png'); print(len(ims),S.size)
