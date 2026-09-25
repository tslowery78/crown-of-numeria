# My Kingdom art pass

Implemented on `codex/kingdom-art`. Six painted textures, island magic, and wood/parchment UI backgrounds are integrated. All painting files are WebP, power-of-two, and below 400,000 bytes. No added lights or post-processing; the existing single shadow map remains.

## Changes and files

- `assets/kingdom/art/island-meadow.webp`: round meadow composition, winding cobblestones, stepping stones, and flower patches. Buildings remain freely placeable; the painted path is decorative.
- `assets/kingdom/art/island-earth.webp`: repeating painted strata, roots, and small crystal deposits on the rim and tapered underside.
- `assets/kingdom/art/storybook-sky.webp`: visit-only spherical panorama with soft clouds, forests, hills, and a far castle. Revised the original painting and feathered the narrow wrap boundary in the existing dome shader pass (no extra draw call); raised the horizon through sphere UVs so the meadow does not hide the distant landscape.
- `assets/kingdom/art/meadow-tile.webp`: repeating painted meadow outside the enlarged island.
- `assets/kingdom/art/carved-wood.webp`, `parchment.webp`: shop backboard/header and quest board backgrounds. All titles, arithmetic, prices, progress gems, buttons, and input remain canvas-drawn at their existing resolution.
- `assets/kingdom/art/PROMPTS.md`: exact generation and revision prompts. Built-in image generation was used; source paintings were resized and encoded to WebP at quality 83.
- `js/kingdom-art.js`: per-image settle-to-null loading with a 10-second timeout, sRGB/mipmap filtering, three clusters of instanced crystals, 36 soft motes, six animated butterflies, bobbing underside glow, and a nine-second fading quest rainbow. Missing art retains each original background independently.
- `js/kingdom.js`: integrates art and effects, keeps sky/meadow out of normal mixed reality, batches building contact shadows, reduces smoke from five to three puffs per chimney, batches the dragon body while preserving animated wings, and limits overlapping quest/milestone celebrations to one visiting dragon.
- `js/game.js`: optional canvas background images for Panel; other modes retain their existing backgrounds.
- `tests/kingdom-art.cjs`: renders a saved 13-building kingdom, checks the draw budget and rainbow lifecycle, checks shadow instances after lifting/replacing a building, and forces all art requests to 404 to exercise the fallback.

## Asset budget

| File | Pixels | Bytes |
| --- | --- | ---: |
| island-meadow.webp | 1024 × 1024 | 317,142 |
| island-earth.webp | 1024 × 512 | 93,234 |
| storybook-sky.webp | 2048 × 1024 | 86,610 |
| meadow-tile.webp | 1024 × 1024 | 243,654 |
| carved-wood.webp | 1024 × 1024 | 60,792 |
| parchment.webp | 1024 × 1024 | 25,844 |
| **Total** | | **827,276** |

Dimensions and file sizes were read back with Pillow. An upper bound assuming every painting is uploaded as RGBA with full mipmaps is about 34.7 MiB; compressed download size is not GPU memory. Parchment is actually composited into the existing panel canvas rather than used as a separate GPU map.

Initial estimate: approximately six extra submissions for magic, without adding lighting passes. Final effects use four persistent submissions and one temporary rainbow submission. The first populated audit exceeded budget (155 normal / 181 quest), prompting the shadow and dragon batching. The final fixed-view browser audit reports **139 normal / 148 quest / 96 visit** draw calls, with renderer counters reset before rendering and automatic reset disabled. These are desktop scene measurements, not Quest stereo timing or a guarantee for every possible kingdom arrangement.

## Verification

`npm test` exited 0:

```text
# tests 4
# pass 4
# fail 0
{
  "samples": 15600,
  "generators": 78,
  "mismatches": []
}
```

`node tests/browser.cjs http://castle.test/ --files` exited 0. Its output reports:

```text
kingdom: start 3, pieces 52, afterSolve 6, cottage true,
         gemsAfterBuy 3, onTaken false, onPond false,
         visibleMeshes 1, shrunkScale 8, islandTopY 0,
         scrollHidden true, shopHidden true, villagers 2,
         back true, restored "cottage"
errors: []
hiddenPreviewDraws: 0
```

`node tests/kingdom-art.cjs` exited 0:

```text
loaded: true; buildings: 13
normalCalls: 139; questCalls: 148; visitCalls: 96
rainbowVisible: true; rainbowExpired: true; dragons: 1
shadowLights: 1; liftedShadows: 12; placedShadows: 13
fallback: allNull true, canvasGrass true, gradientSky true,
          buildings 13, shopBack true
errors: []
```

The supplied `ROOT=$PWD node /tmp/pt/kingdom.mjs` was run before and after the changes. It exercises quest completion, purchases, moving a building, insufficient gems, visiting, growing back, and save restoration. Both runs restored 13 buildings and 11 gems with `errors: none`. The rejected garden placement (`garden:false`) also occurs in the baseline: that cell is reserved for the pond. The helper's immediate `info` after `growBack()` precedes the next render, so use the dedicated art test for normal-mode draw counts.

Full captured output is saved in `design-shots/after/verification.txt`.

## Visual review

Compared the supplied originals against the final captures at the same scripted camera positions. Kept the painted path and flowers, warm carved backgrounds with crisp text, softer particles, crystals, and painted visit horizon. Rejected the first sky's conspicuous vertical seam, revised the painting, and blended the remaining edge color difference in the dome shader before delivery.

| Before (supplied) | After |
| --- | --- |
| design-shots/k-built.png | design-shots/after/k-built.png |
| design-shots/k-shop.png | design-shots/after/k-shop.png |
| design-shots/k-villagers.png | design-shots/after/k-villagers.png |
| design-shots/k-visit1.png | design-shots/after/k-visit1.png |
| design-shots/k-visit3.png | design-shots/after/k-visit3.png |

Also saved final `k-station.png`, `k-side.png`, `k-start.png`, and `k-visit2.png` from the supplied helper. Additional `k-underside.png` shows the painted cliff and glow, and `k-horizon.png` shows the far castle. Characters, questions, confetti, and celebration timing vary between captures.

## Remaining uncertainty

- No physical Quest 3 was available. Stereo frame time, passthrough glow contrast, and close-up texture readability need a headset check. The counter tests establish submissions in the specified desktop views, not headset FPS.
- The missing-file path was exercised with real 404 responses; the timeout branch was inspected but not separately delayed in the browser test.
- Paintings are deliberately soft at village scale. Texture repetition and spherical-pole distortion were not exhaustively inspected from every possible head position.
