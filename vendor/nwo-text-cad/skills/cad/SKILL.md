---
name: nwo-cad
description: NWO Robotics CAD generation skill. Create parametric mechanical parts, motor/gear assemblies, electronics enclosures, and robot components from natural language. Integrates with NWO Robotics API for task-aware design. Outputs STEP, STL, 3MF, DXF for manufacturing.
---

# NWO CAD Skill

Generate production-ready CAD models for NWO Robotics hardware.

## Purpose

Transform natural language specifications into parametric CAD models optimized for robotic applications. Specialized for motor mounts, gearboxes, structural components, and electronics integration.

## Integration with NWO Robotics API

```python
from nwo_text_cad import CADGenerator
from nwo_robotics import RobotAPI

# Get task requirements from NWO API
api = RobotAPI(api_key="your_key")
task = api.get_task(task_id)

# Generate task-specific hardware
generator = CADGenerator()
part = generator.generate_from_task(task)

# Export for production
part.export_step("output.step")
part.export_stl("output.stl")
```

## Motor/Gear Design

### NEMA Motor Mounts

```bash
# Standard NEMA 17 mount
nwo-cad motor-mount --type NEMA17 --material aluminum --thickness 5

# With custom hole pattern
nwo-cad motor-mount --type NEMA23 --holes "4xM4 on 47.14mm PCD"
```

### Gearbox Design

```bash
# Planetary gearbox
nwo-cad gearbox --type planetary --ratio 10:1 --input NEMA23 --output 20mm

# Harmonic drive
nwo-cad gearbox --type harmonic --ratio 100:1 --torque 50Nm
```

### Gear Train

```bash
# Spur gear train
nwo-cad gear-train --ratio 5:1 --module 1.0 --pressure-angle 20

# Bevel gears for right-angle drive
nwo-cad bevel-gears --ratio 2:1 --shaft-angle 90
```

## Electronics Integration

### PCB Enclosures

```bash
# Arduino enclosure with mounting ears
nwo-cad enclosure --board arduino-uno --material PETG --thickness 2

# Raspberry Pi 4 with cooling
nwo-cad enclosure --board rpi4 --cooling fan-40mm --vents
```

### Cable Management

```bash
# Cable chain for 10mm cables
nwo-cad cable-chain --cable-dia 10 --length 500 --bend-radius 50

# Cable gland plate
nwo-cad gland-plate --holes "4xPG9, 2xPG16" --panel-thickness 3
```

## Structural Components

### Frames & Brackets

```bash
# 2020 extrusion bracket
nwo-cad bracket --profile 2020 --type corner --material aluminum

# Custom L-bracket
nwo-cad bracket --type L --legs "50x50" --thickness 5 --holes "4xM5"
```

### Shaft Couplers

```bash
# Rigid coupler
nwo-cad coupler --type rigid --input 8mm --output 10mm

# Flexible (Oldham)
nwo-cad coupler --type oldham --input 6mm --output 8mm --torque 2Nm
```

## Commands

### Generate

```bash
python scripts/nwo-cad generate "description"
python scripts/nwo-cad generate "NEMA 17 mount" -o mount.step
python scripts/nwo-cad generate-from-task <task_id> --api-key <key>
```

### Export

```bash
python scripts/nwo-cad export input.py --format step
python scripts/nwo-cad export input.py --format stl --quality high
python scripts/nwo-cad export input.py --format dxf --layer top
```

### Inspect

```bash
python scripts/nwo-cad inspect model.step
python scripts/nwo-cad inspect model.step --measure volume
python scripts/nwo-cad inspect model.step --check manufacturability
```

## NWO API Task Integration

When generating from NWO Robotics tasks:

1. **Extract requirements** from task description
2. **Query robot specs** from NWO API (payload, reach, precision)
3. **Generate appropriate geometry** based on constraints
4. **Validate** against manufacturing capabilities
5. **Export** production-ready formats

Example task flows:

| Task | Generated Component |
|------|---------------------|
| "pick up 5kg box" | Custom gripper jaws, wrist reinforcement |
| "navigate stairs" | Suspension mounts, wheel hubs |
| "solder PCB" | Tool changer adapter, camera mount |
| "carry 20kg load" | Frame reinforcement, battery tray |

## Design Rules

Default assumptions for NWO Robotics hardware:

- **Units:** millimeters
- **Material:** 6061-T6 aluminum (structural), PETG (printed)
- **Fasteners:** ISO metric (M3, M4, M5, M6, M8)
- **Tolerances:** ±0.1mm ( machined), ±0.3mm (printed)
- **Wall thickness:** 3mm minimum for structural
- **Hole clearances:** +0.4mm for M3, +0.5mm for M4/M5

## Output Formats

| Format | Use Case | Command |
|--------|----------|---------|
| STEP | Master CAD file | `--format step` |
| STL | 3D printing | `--format stl` |
| 3MF | Advanced printing | `--format 3mf` |
| DXF | Laser/waterjet | `--format dxf` |
| GLB | Visualization | `--format glb` |

## References

- `references/motor-standards.md` - NEMA, ISO motor dimensions
- `references/gear-design.md` - Gear ratios, materials, lubrication
- `references/materials.md` - Aluminum, steel, polymer specs
- `references/manufacturing.md` - CNC, 3D print, sheet metal
