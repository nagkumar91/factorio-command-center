# bands-six-panels (rejected: low power)

6 solar panels (1,080 kW) and 9 accumulators in the east and south bands. 279 tiles, 19 x 18, 5,000 kg.

The full protocol failed only `noLowPower`: 11,131 low-power machine-ticks, the first 3.7 minutes after the build, with the accumulators down to 1.45 MJ. Production still measured 60.00 per minute. The platform draws about 1,000 kW at full rate, so 1,080 kW of panels leaves too little to recharge the accumulators after the start-up demand. Seven panels (1,260 kW) is the floor; with them the accumulators never drop below 4.89 of 5 MJ.
