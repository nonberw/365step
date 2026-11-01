# CAD Project Harness

## Project Structure

```
project/
├── cad/              # CAD source files
├── urdf/             # Robot descriptions
├── meshes/           # Mesh files
├── assembly/         # Assembly plans
├── production/       # Manufacturing outputs
└── docs/             # Documentation
```

## Workflow

1. **Design** in `cad/` using build123d
2. **Generate** URDF in `urdf/` for robots
3. **Export** meshes to `meshes/`
4. **Plan** assembly in `assembly/`
5. **Produce** in `production/`

## Commands

```bash
# Generate CAD
nwo-cad generate "description" -o cad/part.step

# Generate URDF
nwo-urdf manipulator --dof 6 -o urdf/robot.urdf

# Plan assembly
nwo-assembly plan --parts "cad/*.step" -o assembly/plan.json

# Production
nwo-production package --project my_robot -o production/
```
