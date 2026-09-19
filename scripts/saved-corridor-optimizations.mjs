import {createHash} from 'node:crypto';
export const blueprintStructureHash=blueprint=>{const {label,description,...layout}=blueprint;return createHash('sha256').update(JSON.stringify(layout)).digest('hex');};
// Replay the exact accepted corridor edits on the deterministic generator.
// Pin the decoded structure so Node/zlib compression differences cannot make
// an unrelated layout eligible. Publication still requires the saved-code SHA.
export function applySavedCorridorOptimization(blueprint,optimization){
 if(!optimization)return blueprint;
 if(blueprintStructureHash(blueprint)!==optimization.baselineStructureSha256)throw Error('Corridor baseline changed: '+optimization.id);
 const result=structuredClone(blueprint),removed=new Set(optimization.removeEntityIds);
 if(result.entities.filter(e=>removed.has(e.entity_number)).length!==removed.size)throw Error('Missing corridor entities');
 result.entities=result.entities.filter(e=>!removed.has(e.entity_number));
 result.entities.push(...structuredClone(optimization.addEntities));
 Object.assign(result,optimization.displayMetadata);
 if(blueprintStructureHash(result)!==optimization.candidateStructureSha256)throw Error('Corridor replay differs from tested candidate: '+optimization.id);
 return result;
}
