---
name: nwo-assembly
description: Assembly planning and instruction generation for NWO Robotics. Creates assembly sequences, BOMs, and work instructions from CAD models. Optimizes for robot self-assembly and human-robot collaboration.
---

# NWO Assembly Skill

Plan and optimize mechanical assemblies for NWO Robotics production.

## Purpose

Generate assembly sequences, bills of materials (BOMs), and work instructions from CAD models. Optimized for both autonomous robot self-assembly and human-robot collaborative assembly.

## Self-Assembly Modes

### Full Autonomy
Robot assembles entire structure without human intervention:
- Pre-kitted components in known positions
- Vision-guided pick-and-place
- Automated fastening (snap-fit, screws, welding)

### Human-Robot Collaboration
Shared assembly tasks:
- Robot handles heavy/large components
- Human performs delicate/fine operations
- Coordinated handoffs

### Human-Assisted
Robot assembly with human oversight:
- Human provides components
- Robot performs assembly
- Human verifies quality

## Assembly Sequence Generation

```bash
# Generate from CAD files
nwo-assembly plan --parts "*.step" --output assembly.json

# Optimize for robot assembly
nwo-assembly plan --parts "*.step" --mode robot --gripper "parallel-jaw"

# Generate work instructions
nwo-assembly instructions --plan assembly.json --format pdf
```

## BOM Generation

```bash
# Extract BOM from assembly
nwo-assembly bom --assembly robot.urdf --format csv

# With sourcing info
nwo-assembly bom --assembly robot.urdf --sourcing --vendors "mcmaster,amazon"
```

Example BOM output:
```csv
Part ID,Description,Quantity,Material,Source,Cost,Lead Time
MNT-001,NEMA 17 Mount,4,6061-T6,McMaster,12.50,2 days
SCR-001,M3x10 Socket Head,16,A2-70,Amazon,0.05,1 day
BRG-001,608ZZ Bearing,4,Steel,Amazon,2.00,1 day
```

## Assembly Instructions

### Visual Instructions

```bash
# Generate step-by-step images
nwo-assembly visualize --plan assembly.json --steps all

# Exploded view
nwo-assembly exploded --assembly robot.step --output exploded.png
```

### Text Instructions

```bash
# Natural language instructions
nwo-assembly instructions --plan assembly.json --format text

# Structured JSON
nwo-assembly instructions --plan assembly.json --format json
```

Example instruction:
```json
{
  "step": 1,
  "action": "place",
  "part": "NEMA-17-MOUNT",
  "target": "FRAME-001",
  "position": [100, 50, 0],
  "orientation": [0, 0, 0],
  "fasteners": ["M3x10-001", "M3x10-002", "M3x10-003", "M3x10-004"],
  "torque": 2.5,
  "vision_check": true
}
```

## Robot Assembly Programming

Generate NWO Robotics API commands for assembly:

```python
from nwo_text_cad.assembly import AssemblyPlanner
from nwo_robotics import RobotAPI

# Load assembly plan
planner = AssemblyPlanner()
plan = planner.load("assembly.json")

# Generate robot commands
api = RobotAPI(api_key="your_key")
for step in plan.steps:
    command = planner.to_robot_command(step)
    api.execute(command)
```

Generated commands:
```python
# Pick component
api.pick("NEMA-17-MOUNT", location="kit_position_1")

# Place at target
api.place("NEMA-17-MOUNT", target="FRAME-001", position=[100, 50, 0])

# Fasten
api.screw("M3x10-001", position=[105, 55, 0], torque=2.5)
```

## Design for Assembly (DFA)

Guidelines for self-assembly:

### Fastening
- **Snap-fit:** Preferred for plastic parts
- **Thread-forming screws:** For repeated assembly
- **Captive hardware:** Prevents dropped fasteners
- **Standard tools:** Minimize tool changes

### Alignment
- **Self-locating features:** Chamfers, guides
- **Visual markers:** For vision systems
- **Tactile feedback:** Confirm engagement
- **Error recovery:** Detect and correct misalignment

### Accessibility
- **Tool clearance:** Sufficient space for tools
- **Line of sight:** Visible for cameras
- **Reachability:** Within robot workspace
- **Stability:** Parts stay in place during assembly

## Assembly Verification

```bash
# Check assemblability
nwo-assembly verify --parts "*.step" --mode robot

# Detect issues
nwo-assembly check --plan assembly.json --issues all
```

Common issues detected:
- Insufficient tool clearance
- Unreachable fasteners
- Unstable intermediate states
- Missing alignment features

## Commands

### Plan

```bash
python scripts/nwo-assembly plan --parts <glob> --output <file>
python scripts/nwo-assembly plan --cad-dir ./parts --mode robot
```

### BOM

```bash
python scripts/nwo-assembly bom --assembly <file> --format <csv|json|xlsx>
python scripts/nwo-assembly bom --urdf robot.urdf --sourcing
```

### Instructions

```bash
python scripts/nwo-assembly instructions --plan <file> --format <pdf|html|json>
python scripts/nwo-assembly visualize --plan <file> --output-dir ./visuals
```

### Robot Code

```bash
python scripts/nwo-assembly generate-code --plan <file> --robot <type>
python scripts/nwo-assembly simulate --plan <file> --robot <urdf>
```

## Integration with NWO API

```python
# Get assembly task from NWO
api = RobotAPI(api_key="your_key")
task = api.get_assembly_task(task_id)

# Generate plan
planner = AssemblyPlanner()
plan = planner.generate(
    parts=task.parts,
    constraints=task.constraints,
    mode=task.mode  # 'robot', 'human', 'collaborative'
)

# Execute
for step in plan.steps:
    api.execute_assembly_step(step)
```

## References

- `references/dfa-guidelines.md` - Design for Assembly
- `references/fastening.md` - Fastener selection
- `references/robot-assembly.md` - Robot-specific considerations
