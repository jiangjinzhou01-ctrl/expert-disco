"""Fetch Solar System Scope maps through a pinned, attributed GitHub mirror.

The upstream download currently returns an anti-bot page in the build environment.
Only the original JPEG/PNG texture assets are used, never the mirror's application
code. All maps remain covered by Solar System Scope's CC BY 4.0 licence.
"""
from pathlib import Path
from urllib.request import urlopen
from hashlib import sha256
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/orbital/space'
COMMIT = '6c81feb760cb36d7d83d1421aef257833ba9768e'
BASE = f'https://raw.githubusercontent.com/RTF22/Orrery/{COMMIT}/'
FILES = {
 'saturn.jpg': ('assets-quellen/texturen/saturn/albedo.jpg', '2k_saturn.jpg'),
 'moon.jpg': ('assets-quellen/texturen/moon/albedo.jpg', '2k_moon.jpg'),
 'neptune.jpg': ('assets-quellen/texturen/neptune/albedo.jpg', '2k_neptune.jpg'),
 'mars.jpg': ('assets-quellen/texturen/mars/albedo.jpg', '2k_mars.jpg'),
 'saturn-ring.png': ('public/textures/saturn/ring.png', '2k_saturn_ring_alpha.png'),
}
OUT.mkdir(parents=True,exist_ok=True)
assets=[]
for filename,(mirror_path,original) in FILES.items():
 data=urlopen(BASE+mirror_path,timeout=40).read()
 path=OUT/filename;path.write_bytes(data)
 with Image.open(path) as image:
  image.verify()
 with Image.open(path) as image:
  width,height=image.size
 assert width<=2048, f'{filename}: exceeds authored 2k budget'
 assets.append({'file':filename,'author':'Solar System Scope / INOVE','license':'CC-BY-4.0','licenseURL':'https://creativecommons.org/licenses/by/4.0/','source':'https://www.solarsystemscope.com/textures/download/'+original,'mirror':BASE+mirror_path,'mirrorCommit':COMMIT,'dimensions':[width,height],'bytes':len(data),'sha256':sha256(data).hexdigest(),'processing':'Unmodified upstream 2k asset, filename changed only'})
 print(filename,width,height,len(data))
manifest={'attribution':'Planet and ring textures by Solar System Scope / INOVE, CC BY 4.0. https://www.solarsystemscope.com/textures/','sourcePage':'https://www.solarsystemscope.com/textures/','mirrorProvenance':f'https://github.com/RTF22/Orrery/blob/{COMMIT}/ASSETS.md','assets':assets}
(OUT/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'ATTRIBUTION.txt').write_text(manifest['attribution']+'\nLicense: https://creativecommons.org/licenses/by/4.0/\nRetrieved through pinned GitHub mirror because upstream download returned an anti-bot challenge. No application code copied. See sources.json for original URLs, mirror URLs, dimensions and SHA-256.\nComposition, shaders and procedural stars are original THRESHOLD work; planet spacing and sizes are artistic, not a solar-system simulation.\n')
