# Manhattan

**A chip-layout viewer that opens a whole chip in a browser tab.**

Manhattan streams layouts of billions of placements to a WebGL2 viewer as a tile
pyramid. You can pan and zoom from the full die down to the rectangles inside a
single cell, toggle layers, click a cell to identify it, and paste the URL into a
review so someone else lands on the same rectangle.

> **Source-available showcase, not open source.** The implementation is in a
> private repository. This repo holds the project's website and write-ups.
> To read the source, [request access](https://github.com/netanelyan/manhattan/issues/new?title=Code%20access%20request).
> See [LICENSE](LICENSE).

## The problem

A GPU draws about **2M rectangles at 60 fps**. That was measured on an RTX 4060
at 3440×1440. A real design has tens of millions of placements per block, and a
chip places a block dozens of times. So the design can never be handed to the
renderer whole.

## The approach

Digital layout is Manhattan geometry, so everything on screen is an axis-aligned
rectangle. The data is a tile pyramid with three representations, and the viewer
picks a level from the zoom:

| level | what a tile holds |
|---|---|
| **far** | merged density blocks, macros and the power grid |
| **mid** | one outline per cell |
| **deep** | full cell internals |

Tiles are binary, laid out so the viewer takes typed-array views straight over
the bytes. **Nothing is parsed at runtime.**

## Measured

| | |
|---|---|
| scale tested | 50M-placement block × 70 instances = **3.5 billion placements** |
| worst frame in the zoom range | 1,531,094 rects, inside a ~2M-rect budget |
| draw calls inside a block | **8**, against a 4,634-master library |
| block instancing | 349M placements in 117 MB instead of ~8.2 GB flattened |
| lazy deep tiles | 1,185 MB → 233 MB on disk, 62 s → 15 s to generate |
| tiles built on request | byte-identical to written ones, 4,068 of 4,068 |
| real LEF/DEF | ISPD 2015 `mgc_superblue16_a`: 80.3 MB in, viewable in 2.4 s. OpenROAD sky130 routed `gcd` |
| Rust/WASM core | 49,841 B (19.9 KB gzipped), `no_std`, 0 dependencies, byte-identical to the C it replaced (4,072 of 4,072 files) |

## This repo

| path | what |
|---|---|
| [`website/`](website/) | the project site, static HTML/CSS/JS with no build step |
| [`LICENSE`](LICENSE) | all rights reserved; view-only |

---

© 2026 Yanchevsky. All rights reserved.
