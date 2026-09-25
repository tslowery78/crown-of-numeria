# Crown of Numeria — art pass

Reviewed the four supplied screenshots: the 3.5 m lock, hall and library views, and the 6 × 7 m window wall. The simplest improvement is to reduce competing detail and give each room a few warm, readable focal points. Retain the castle geometry and tactile furniture.

Ranked by expected visual impact relative to effort:

| Rank | Change | Concrete implementation | Impact / effort |
| --- | --- | --- | --- |
| 1 | Quiet the stone | Reduce wall normal strength and ambient occlusion; compare a gentle cream fill against the current harsh scan before retaining it. Preserve mortar and the stone scale. | High / low |
| 2 | Replace the crude painting | Four gouache-style paintings: kingdom landscape, friendly dragon, sunset castle, unicorn meadow. Use sage, honey, dusty blue, rose and plum; reuse the physical frames. | High / medium |
| 3 | Make books feel bound | Replace saturated random stripes with muted leather/cloth colours, restrained gold spine bands and cream page edges. Keep the existing batched geometry. | High / low |
| 4 | Give banners woven character | Six matching swallow-tail textiles, gold botanical borders and the existing floor emblems: king, queen, rook, knight, sparkle, black queen. Preserve the six floor colour identities. | Medium / medium |
| 5 | Replace the target-like rugs | Six round woven rugs with soft botanical borders, floor colours and restrained central medallions. Alpha outside the circle; no extra lighting effects. | Medium / medium |
| 6 | Warm the floor labels | Cream parchment, warm brown text and a fine gold inner rule; retain clear canvas-rendered text for headset legibility and dynamic labels. | Medium / low |
| 7 | Break up large empty walls | Two wide storybook tapestries on large, window-free side-wall spans only. Never cover the north lock wall, scroll, gem tray, east-wall mirrors on floors 1/4, or library shelving. | Medium / medium |
| 8 | Soften lighting if comparison supports it | Test a modest warm ambient/material fill. Keep the existing light count; no real-time shadows, transmission or post-processing. | Medium / low |

## Asset and performance constraints

Use 1024 × 1024 paintings: the suggested 1024 × 768 is not power-of-two in both dimensions. Banners are 512 × 1024, rugs 512 × 512, tapestries 1024 × 512. Each final image must be at most 300,000 bytes. PNG/WebP preserve textile alpha. Every image is optional and uses the existing settled-load fallback. Missing tapestry art can reuse the canvas painting fallback.

Planning estimate: 18 images at the cap would be 5.4 MB downloaded; uncompressed RGBA plus mipmaps would be about 53 MiB if all are resident. Actual compressed sizes and tests will be recorded after verification. Reuse loaded maps/materials and static batches; do not add render passes.
