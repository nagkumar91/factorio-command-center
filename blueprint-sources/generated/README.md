# Compact production cells

60 original single-recipe blueprints fill gaps in the imported library. Recipes use normal-quality Factorio 2.0 / Space Age machines. Each ground cell includes requesters, bulk inserters, a provider output, a substation, and a roboport. Platform cells use turbo belts and inserters because robots and storage chests cannot operate there.

Supply intermediate ingredients, electricity, robots and the marked fluids. These are recipe modules, not complete factories from raw ore. The website's operating-supply planner shows the upstream chain. Surface, research, heating, spoilage and byproduct requirements remain in effect. Each blueprint description records its particular setup.

Native test results in validation.json are tied to the exact blueprint strings by SHA-256. The test imports the strings into a disposable vanilla Space Age save, delivers items through saved chests and inserters (robots on ground cells), supplies fluids through the saved pipes, and checks actual output. Test electricity and external supplies are fixtures and are not part of the blueprint.

Regenerate with npm run generate:cells after indexing the community collections. Revalidate with npm run test:cells before publishing.
