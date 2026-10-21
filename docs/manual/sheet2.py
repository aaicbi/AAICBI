import sys
from PIL import Image
folder,kind=sys.argv[1],sys.argv[2]; names=sys.argv[3].split(','); H=int(sys.argv[4]) if len(sys.argv)>4 else 470
W=700 if kind=='desktop' else 300
out=[]
for n in names:
    im=Image.open(f'screenshots/{folder}/{n}-{kind}.png').convert('RGB'); r=W/im.width; im=im.resize((W,int(im.height*r))); out.append(im.crop((0,0,W,min(H,im.height))))
cols=2 if kind=='desktop' else 4
rows=(len(out)+cols-1)//cols
S=Image.new('RGB',(cols*(W+6),rows*(H+6)),(80,80,80))
for i,im in enumerate(out): S.paste(im,((i%cols)*(W+6),(i//cols)*(H+6)))
S.save('/tmp/dev/s3.png')
