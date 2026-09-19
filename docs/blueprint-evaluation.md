# Blueprint evaluation and operating rates

Alex Wittman's [A.I. Learns to Optimize Factorio Blueprints](https://www.youtube.com/watch?v=mGOKKtIDNbk) combines a genetic search with wave function collapse. The video's useful distinction is between generating a connected layout and evaluating what that layout actually delivers. Its later constraints track the material on each belt, require useful inserter endpoints, and require ingredient delivery and output removal for each machine. The author also describes the limits of searching a large grid. His [project write-up](https://www.reddit.com/r/factorio/comments/1tirq60/i_tried_training_ai_to_optimize_blueprints_and/) gives further context.

Our generator already has recipe-specific networks and a bounded set of placements. Evaluating several valid placements is more practical here than reproducing the video's full search. The original starter generation stopped at the first routable candidate, which could favor a long single column even when a later placement would use less space.

## Selection criteria

1. Reject overlaps, incorrect underground connections, external intermediate ingredients, unsupported equipment, and disconnected electricity.
2. Run the saved import string in an isolated Factorio save with raw materials supplied only at its declared entrances. Verify every recipe works and each item output refills after collection.
3. Measure delivered output with all outputs collected continuously. The combined science factory must achieve at least 29.8 of every requested pack per minute, allowing a batch boundary tolerance around the 30/min target. A revised existing module must preserve or improve its measured delivery rate.
4. Compare bounding area, belt and underground counts, and construction materials among feasible candidates. An underground belt can reduce the number of visible entities while costing more iron; it is not automatically a material saving. Recipe output quantities matter when calculating construction cost.
5. Test the chosen revision again after any routing, machine-count, power, or port changes. Keep a review of the alternatives and their results.

The objectives are deliberately based on delivered products, not items circulating on belts or the presence of machines. A smaller build that starves its output is not accepted as an improvement. A bounded search does not establish a global optimum.

## Measured operating rates

Native benchmarks run for 45 simulated minutes. The first 15 minutes warm up the factory; the following 30 minutes are measured. Raw item entrances receive continuous supply up to their saved belt capacity, and fluid inputs and external electricity remain supplied. Output items and fluids are collected each second. No intermediates are injected into machines.

Output per minute is the amount collected during the measurement period divided by 30. Input per minute uses the consumption side of the force's item/fluid statistics (`output_counts`), measured at both boundaries; burner fuel is included. Ingredients marked `ignored_by_stats`, such as fluid used to fill barrels, require a recipe-count adjustment. Finished crafts and the craft in progress at the two boundaries identify this omitted consumption. This avoids reporting the initial fill of belts, tanks, and inventories as ongoing demand.

These are averages over a defined test, not a proof of maximum production. Internal buffers may still fill during the measurement period. Scarce input, output backpressure, research, quality, or changes to the layout can change the result.

The card footer lists each raw input and finished output per minute. The blueprint detail repeats the rates, includes the measurement conditions, and links the exact report. Item rates and fluid rates have separate units. The publication code checks the blueprint hash, port/research configuration, native pass status, counts, and arithmetic before accepting the displayed values.

## Storage and updates

The transport, early-game, and science collections have small version indexes under `site/data/`. Records and their blueprint, preview, functional-test, and throughput files have immutable content-addressed paths. Publishing writes those files first and switches the index last. Older snapshots remain available.

The bundled catalogue includes each record revision. Loading a current bundle therefore does not fetch all the same records again. The HTTP client checks the small indexes every 30 seconds and fetches only changed records. Updates after loading are offered through a button; no automatic page refresh occurs. Offline copies use the bundled catalogue.
