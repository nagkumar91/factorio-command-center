import {createHash} from 'node:crypto';
export function starterConfigurationHash(info){
 const configuration={kind:info.kind,ports:info.ports,products:info.products,resource:info.resource};
 if(info.rawOnly)Object.assign(configuration,{rawOnly:true,researchClosure:info.researchClosure});
 if(info.inputDisplays)configuration.inputDisplays=info.inputDisplays;
 if(info.powerNetwork)configuration.powerNetwork=info.powerNetwork;
 if(info.surface)configuration.surface=info.surface;
 if(info.loopControl)configuration.loopControl=info.loopControl;
 if(info.scienceFactory)configuration.scienceFactory=true;
 if(info.fuelPolicy)configuration.fuelPolicy=info.fuelPolicy;
 if(info.targetPerMinute)configuration.targetPerMinute=info.targetPerMinute;
 return createHash('sha256').update(JSON.stringify(configuration)).digest('hex');
}
