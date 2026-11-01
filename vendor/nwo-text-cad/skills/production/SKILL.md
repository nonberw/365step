---
name: nwo-production
description: Manufacturing output generation for NWO Robotics. Creates CNC toolpaths, 3D print files, sheet metal patterns, and assembly BOMs. Optimizes for in-house production and supply chain integration.
---

# NWO Production Skill

Generate manufacturing-ready outputs from CAD models.

## Purpose

Transform CAD designs into production files: CNC toolpaths, 3D print slices, sheet metal patterns, and complete manufacturing packages with BOMs and work instructions.

## Manufacturing Methods

### CNC Machining

```bash
# Generate G-code for milling
nwo-production cnc --input part.step --machine "3-axis-mill" --material aluminum

# 5-axis complex part
nwo-production cnc --input housing.step --machine "5-axis" --material titanium

# Turning
nwo-production cnc --input shaft.step --machine "lathe" --material steel
```

Output formats:
- G-code (.nc, .tap)
- CL data
- Setup sheets
- Tool lists

### 3D Printing

```bash
# FDM printing
nwo-production print --input bracket.stl --method fdm --material PETG

# SLA resin
nwo-production print --input gear.stl --method sla --material tough-resin

# SLS nylon
nwo-production print --input housing.stl --method sls --material nylon12

# Multi-material
nwo-production print --input complex.stl --method mmu --materials "PLA,PVA"
```

Slicer integration:
- PrusaSlicer
- Cura
- Bambu Studio
- ChiTuBox (resin)

### Sheet Metal

```bash
# Flat pattern
nwo-production sheetmetal --input enclosure.step --thickness 2 --material steel

# Bend sequence
nwo-production sheetmetal --input bracket.step --sequence --k-factor 0.5

# DXF for laser/waterjet
nwo-production sheetmetal --input panel.step --format dxf --nesting
```

Outputs:
- Flat pattern DXF
- Bend drawings
- 3D model with bends
- Nesting layouts

### Laser Cutting

```bash
# 2D profiles
nwo-production laser --input profiles.dxf --material acrylic --thickness 5

# With engraving
nwo-production laser --input panel.dxf --engrave logo.svg --material plywood
```

## Production Planning

### Job Packaging

```bash
# Complete production package
nwo-production package --project robot-arm --output ./production/

# Includes:
# - All CAD files (STEP, STL)
# - CNC G-code
# - 3D print files
# - BOM
# - Work instructions
# - Quality checklist
```

### Cost Estimation

```bash
# Estimate production cost
nwo-production cost --parts "*.step" --quantity 10

# With sourcing
nwo-production cost --bom bom.csv --vendors vendors.json
```

Example output:
```json
{
  "materials": 450.00,
  "machining": 320.00,
  "printing": 85.00,
  "assembly": 150.00,
  "total": 1005.00,
  "per_unit": 100.50
}
```

### Lead Time

```bash
# Estimate production time
nwo-production schedule --parts "*.step" --resources "cnc,printer,laser"

# Critical path
nwo-production schedule --project robot --critical-path
```

## Quality Control

### Inspection Planning

```bash
# Generate inspection plan
nwo-production inspect --part part.step --tolerance 0.05

# CMM program
nwo-production inspect --part housing.step --method cmm --output program.dmis
```

### Tolerance Analysis

```bash
# Stack-up analysis
nwo-production tolerance --assembly assembly.step --analysis stack-up

# Statistical tolerance
nwo-production tolerance --parts "*.step" --method statistical
```

## Supply Chain Integration

### Vendor Management

```bash
# Generate RFQ
nwo-production rfq --parts "*.step" --vendors "vendor1,vendor2"

# Compare quotes
nwo-production compare --quotes "quote1.json,quote2.json"
```

### Inventory

```bash
# Check stock
nwo-production inventory --bom bom.csv --warehouse "main"

# Order list
nwo-production order --bom bom.csv --min-stock 5
```

## NWO Robotics Self-Production

For autonomous robot manufacturing:

```python
from nwo_text_cad.production import ProductionPlanner
from nwo_robotics import RobotAPI

# Design part
part = cad.generate("motor mount for NEMA 17")

# Plan production
planner = ProductionPlanner()
plan = planner.create_production_plan(
    part=part,
    methods=["3d_print", "cnc"],
    priority="speed"
)

# Execute with factory robots
api = RobotAPI(api_key="factory_key")
for operation in plan.operations:
    if operation.type == "3d_print":
        api.start_print(operation.file, operation.material)
    elif operation.type == "cnc":
        api.load_cnc_program(operation.gcode)
```

## Commands

### CNC

```bash
python scripts/nwo-production cnc --input <file> --machine <type> --material <mat>
python scripts/nwo-production cnc --input part.step --setup --output setup.pdf
```

### 3D Print

```bash
python scripts/nwo-production print --input <stl> --method <fdm|sla|sls> --material <mat>
python scripts/nwo-production print --input gear.stl --slicer prusa --profile 0.2mm
```

### Sheet Metal

```bash
python scripts/nwo-production sheetmetal --input <step> --thickness <t> --material <mat>
python scripts/nwo-production sheetmetal --input panel.step --nesting --sheet 1000x500
```

### Package

```bash
python scripts/nwo-production package --project <name> --output <dir>
python scripts/nwo-production package --project robot --format zip
```

### Cost/Schedule

```bash
python scripts/nwo-production cost --parts <glob> --quantity <n>
python scripts/nwo-production schedule --project <name> --resources <list>
```

## Integration with NWO API

```python
# Submit production job
api = RobotAPI(api_key="your_key")
job = api.create_production_job(
    design_id="design_123",
    quantity=10,
    priority="high",
    methods=["cnc", "3d_print"]
)

# Track progress
status = api.get_production_status(job.id)
```

## References

- `references/cnc-parameters.md` - Speeds and feeds
- `references/3d-printing.md` - Slicer settings
- `references/sheet-metal.md` - K-factors, bend radii
- `references/supply-chain.md` - Vendor management
