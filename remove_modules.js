const fs = require('fs');

try {
    const filePath = './mall/purple.json';
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    let removedCount = 0;

    if (data.blueprint && data.blueprint.entities) {
        data.blueprint.entities.forEach(entity => {
            if (entity.items) {
                if (Array.isArray(entity.items)) {
                    const originalLength = entity.items.length;
                    entity.items = entity.items.filter(item => {
                        const name = item.id && item.id.name;
                        if (name && (name.includes('speed-module') || name.includes('productivity-module') || name.includes('quality-module') || name.includes('efficiency-module'))) {
                            return false;
                        }
                        // Also check if it's just a string or key-value
                        return true;
                    });
                    removedCount += (originalLength - entity.items.length);
                    if (entity.items.length === 0) {
                        delete entity.items;
                    }
                } else if (typeof entity.items === 'object') {
                    // Older format: "items": { "speed-module-3": 2 }
                    for (const key in entity.items) {
                        if (key.includes('speed-module') || key.includes('productivity-module') || key.includes('quality-module') || key.includes('efficiency-module')) {
                            delete entity.items[key];
                            removedCount++;
                        }
                    }
                    if (Object.keys(entity.items).length === 0) {
                        delete entity.items;
                    }
                }
            }
        });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Successfully removed ${removedCount} modules.`);
} catch (e) {
    console.error("Error:", e.message);
}
