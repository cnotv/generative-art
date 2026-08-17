---
'@webgamekit/threejs': patch
---

Fix the package being unimportable outside a browser. The pixel shader read the window
dimensions while its module was evaluating, so importing anything from this package threw in
Node and in any server-rendering context, before a single function was called. The uniform now
takes a neutral default and the render pass supplies the real dimensions when it is built,
which also means the value reflects the window size at pass creation rather than at whichever
moment the module first loaded.
