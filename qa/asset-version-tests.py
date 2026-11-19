#!/usr/bin/env python3
"""Regression tests for deterministic hashes and transitive browser references."""
from pathlib import Path
import tempfile,shutil,subprocess,json
script=Path(__file__).resolve().parents[1]/'pipeline/version-assets.py'
with tempfile.TemporaryDirectory() as t:
    root=Path(t);(root/'pipeline').mkdir();shutil.copy(script,root/'pipeline/version-assets.py')
    (root/'assets').mkdir();(root/'data').mkdir()
    (root/'data/latest.json').write_text('{"unchanged":true}')
    (root/'assets/icon.svg').write_text('<svg/>')
    (root/'child.mjs').write_text('export const value=1;')
    (root/'parent.mjs').write_text('export {value} from "./child.mjs";')
    (root/'theme.css').write_text('body{background:url("assets/icon.svg")}')
    (root/'index.html').write_text('<html><head><link href="theme.css"></head><body><script type="module">import {value} from "./parent.mjs";</script></body></html>')
    def build():
        subprocess.run(['python3',str(root/'pipeline/version-assets.py')],check=True,capture_output=True)
        return json.loads((root/'asset-manifest.json').read_text())
    a=build();first=(root/'index.html').read_bytes();assert a==build();assert first==(root/'index.html').read_bytes()
    assert set(a['assets'])=={'theme.css','assets/icon.svg','child.mjs','parent.mjs'}
    (root/'child.mjs').write_text('export const value=2;export const added=1;')
    b=build();assert a['version']!=b['version'];assert a['assets']['child.mjs']!=b['assets']['child.mjs'];assert a['assets']['parent.mjs']!=b['assets']['parent.mjs'];assert a['assets']['theme.css']==b['assets']['theme.css']
    for old in a['assets'].values():assert(root/old).exists()
    (root/'assets/icon.svg').write_text('<svg>changed</svg>');c=build();assert c['assets']['theme.css']!=b['assets']['theme.css']
    assert (root/'data/latest.json').read_text()=='{"unchanged":true}'
    print('PASS deterministic build, transitive module/CSS hashes, old assets retained, data untouched')
