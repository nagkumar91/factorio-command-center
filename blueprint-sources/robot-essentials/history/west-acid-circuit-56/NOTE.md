# west-acid-circuit-56 (exploration pass, superseded)

The 35 x 16 = 560 layout (`collector-east-column`, since superseded by the 528 corner-collector design) with ring limits circuits 56 and plastic 28 (the published designs use 64 and 24).

- Exploration run at full protocol lengths passed every check (steady 5.27 / 5.4 / 0.57 / 2.2 / 2.2, recovery 5.2 / 5.4 / 0.5 / 2.2 / 2.2).
- Why not published: circuits were the tightest item. Ring circuits fell to 16 at the end of measurement; the passive-provider-chest machine was short of circuits 416 of 1,800 samples and the electric-engine machines 118 to 170. Raising the circuit limit to 64 (plastic 28 -> 24 to stay under 60% of ring capacity) cut those to 189 and 76 to 134 with identical product rates, so the published design keeps more circuit headroom.
- Reproduce: `RE_OPTIONS='{"supplyGate":false,"cornerChest":false,"oldPowerWording":true,"limits":{"electronic-circuit":56,"plastic-bar":28}}'`
