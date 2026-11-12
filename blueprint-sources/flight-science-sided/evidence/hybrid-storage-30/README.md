# Additional hybrid full-storage stress evidence

This separate diagnostic report does not replace the original 5-minute collection-pause qualification. The original report bytes and exact cloned control are preserved. No machine-local configuration, cache or mod archive is included.

Blueprint SHA-256: `ac9fca587c69eebf93c587406f9dd02df4b0dd124352cdce66c5a2b6f650cb3c`

Control SHA-256: `e7130014799aa34fbee5ad4fc457b156119f73aac7e8701bc4d7917410cca1cf`

Report SHA-256: `47835ec8efbdcab6f741f668c00d9fae3080b5ee8f5c51eac27d724c31686ffd`

Prototype SHA-256: `33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f`

Protocol: Factorio 2.1.24, 15-minute empty-start warmup, 30-minute steady measurement, 30-minute collection pause, 2-minute settling and 3-minute recovery measurement. All six output chests remained at 200/200 usable capacity for all 121 observations during the final two paused minutes. All science machines made zero crafts, independently confirmed by zero science production-statistic deltas during that window.

| Pack | Newly crafted/min | Collected/min (includes backlog) |
| --- | ---: | ---: |
| automation-science-pack | 62.000 | 60.333 |
| logistic-science-pack | 67.667 | 70.000 |
| military-science-pack | 63.333 | 63.667 |
| chemical-science-pack | 62.667 | 59.667 |
| production-science-pack | 66.000 | 115.667 |
| utility-science-pack | 64.000 | 111.667 |

Fresh production uses each science assembler’s products_finished delta times its recipe result count. Independent native production statistics agree exactly. Every newly crafted rate is at least 60/min. Collected backlog is not the production measure.

For reproduction, use the frozen matching hybrid blueprint/manifest, the hybrid native runner’s payload/feeding/research policy and this exact control in a separate copied profile. Set `warmup=54000`, `measure=108000`, `recovery={pauseTicks:108000,settleTicks:7200,measureTicks:10800}`. Disable authoritative report-copy steps and retain new results separately. The report keeps its original private-stress provenance flags; promotion does not alter those fields.
