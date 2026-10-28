from pathlib import Path
import imageio.v2 as iio
import numpy as np
from scipy import ndimage
import json,sys

src=Path(sys.argv[1]);dst=Path(sys.argv[2]);dst.parent.mkdir(parents=True,exist_ok=True)
key_warm_effects='--key-warm-effects' in sys.argv[3:]
retain_right_puffs='--retain-body-and-right-puffs' in sys.argv[3:]
reader=iio.get_reader(str(src));meta=reader.get_meta_data();fps=meta['fps']
writer=iio.get_writer(str(dst),fps=fps,codec='libx264',quality=None,ffmpeg_params=['-crf','16','-preset','medium','-pix_fmt','yuv420p'],macro_block_size=None)
count=0;removed=[]
try:
 for frame in reader:
  a=np.asarray(frame).copy();c=a.astype(np.int16)
  # Normalize only green-dominant backdrop pixels. The muted grey/pink/purple
  # characters are not green-dominant and keep their original RGB values.
  key=(c[:,:,1]>140)&(c[:,:,1]>c[:,:,0]+22)&(c[:,:,1]>c[:,:,2]+22)
  if key_warm_effects:
   # This cloud's body/face has muted grey/rose/cream colors. Its generated
   # yellow/orange rings are highly saturated and can be keyed independently.
   key|=(c[:,:,0]>120)&(c[:,:,1]>90)&(c[:,:,2]<np.minimum(c[:,:,0],c[:,:,1])*.65)
  labelling_mask=ndimage.binary_opening(~key,structure=np.ones((5,5))) if retain_right_puffs else ~key
  labels,n=ndimage.label(labelling_mask);sizes=np.bincount(labels.ravel());keep=sizes>=80;keep[0]=False
  if retain_right_puffs and n:
   largest=int(np.argmax(sizes[1:])+1)
   center_x=float(np.where(labels==largest)[1].mean())
   centers=ndimage.center_of_mass(np.ones(labels.shape),labels,list(range(1,n+1)))
   for label,center in enumerate(centers,1):
    if label!=largest and center[1]<center_x:keep[label]=False
  # Remove tiny isolated background sparks; retain all sizeable creature parts,
  # including the three original detached puffs of the lake boss.
  foreground=keep[labels]
  if retain_right_puffs:foreground=ndimage.binary_dilation(foreground,iterations=2)&~key
  changed=(~foreground)&np.any(a!=[0,255,0],axis=2)
  a[~foreground]=[0,255,0]
  removed.append(int(changed.sum()));writer.append_data(a);count+=1
finally:
 reader.close();writer.close()
report={'source':str(src),'video':str(dst),'frames':count,'fps':fps,'process':'normalize green-dominant background to #00FF00; remove isolated non-green specks smaller than 80 output pixels; preserve source creature RGB on retained components','warmEffectColorKey':key_warm_effects,'retainBodyAndRightPuffs':retain_right_puffs,'meanNormalizedPixels':sum(removed)/max(1,len(removed)),'rawPreserved':src.exists()}
dst.with_suffix('.cleanup.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
