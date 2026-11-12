// Normalize labels only; raw native results remain in the private test directory.
export function describeEvidence(report){
 for(const b of report.builds){
  b.outputMode=b.id==='forest-kit'?'Stored finished items; stocking test, not continuous throughput':b.id==='renewable-nursery'?'Surplus wood collected; 100-wood reserve retained':b.id==='standing-grove'?'Standing canopy; no harvesting':'Autonomous closed material loop; no exports or ongoing inputs';
  if(b.maintenance){const m=b.maintenance;
   for(const [old,name]of [['onSeconds','emittingSeconds'],['offSeconds','zeroEmissionSeconds'],['onPollution','emissionsDuringActiveSeconds'],['offPollution','emissionsDuringIdleSeconds'],['onPowerFailures','powerFailureSeconds']])if(old in m){m[name]=m[old];delete m[old];}
   delete m.offEnergyMax;
   m.measurementStartMinute=60;m.measurementEndMinute=report.minutes;
   m.powerMode='Continuously connected to included solar/accumulators; activity counters are not power-switch states.';
   m.fullRunNetRemovalPerMinute=(Object.values(b.samples).at(-1).pollution.trees-Object.values(b.samples).at(-1).pollution.tower-Object.values(b.samples).at(-1).pollution.assembler)/report.minutes;
  }
 }
 return report;
}
