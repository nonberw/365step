# NWO Text-to-CAD Integration Guide

Complete integration between NWO Text-to-CAD and NWO Robotics API.

## Overview

This integration enables NWO Robotics agents to:
1. **Design hardware** based on task requirements
2. **Generate CAD models** programmatically
3. **Create robot descriptions** (URDF/SDF)
4. **Plan assembly** sequences
5. **Produce manufacturing** outputs

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   NWO Robotics  │────▶│  NWO Text-to-CAD │────▶│  Manufacturing  │
│      API        │     │    Generator     │     │    Outputs      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
   Task Analysis          CAD Generation           Production
   Requirements           URDF/SDF                Assembly
   Constraints            BOM                     Quality
```

## Quick Start

### 1. Install

```bash
pip install nwo-text-cad
```

### 2. Configure API Key

```bash
export NWO_API_KEY="your_api_key_here"
```

### 3. Basic Usage

```python
from nwo_text_cad import CADGenerator, URDFGenerator
from nwo_robotics import RobotAPI

# Initialize
api = RobotAPI(api_key="your_key")
cad = CADGenerator()
urdf = URDFGenerator()

# Get task from NWO API
task = api.get_task(task_id="task_123")

# Generate hardware based on task
if task.type == "pick_place":
    # Design custom gripper
    gripper = cad.generate(
        f"Parallel jaw gripper for {task.payload}kg payload, "
        f"{task.grip_width}mm opening"
    )
    gripper.export_step("gripper.step")
    
    # Generate robot URDF
    robot = urdf.generate_manipulator(
        dof=6,
        reach=task.reach,
        payload=task.payload
    )
    robot.save("robot.urdf")
```

## Integration Patterns

### Pattern 1: Task-Driven Design

Robot receives task → Generates required hardware → Produces → Executes task

```python
def handle_task(task_id: str):
    # Get task requirements
    task = api.get_task(task_id)
    
    # Analyze what hardware is needed
    required_parts = analyze_hardware_needs(task)
    
    # Generate each part
    for part_spec in required_parts:
        model = cad.generate(part_spec.description)
        
        # Export for production
        model.export_step(f"parts/{part_spec.name}.step")
        model.export_stl(f"parts/{part_spec.name}.stl")
    
    # Plan assembly
    planner = AssemblyPlanner()
    assembly = planner.generate(
        parts=[f"parts/{p.name}.step" for p in required_parts],
        mode="robot"
    )
    
    # Execute assembly
    for step in assembly.steps:
        api.execute_assembly_step(step)
    
    # Now execute original task
    api.execute_task(task)
```

### Pattern 2: Self-Production

Robot designs and manufactures its own upgrades:

```python
def self_upgrade(upgrade_type: str):
    """Design and manufacture robot upgrade."""
    
    # Design upgrade
    if upgrade_type == "camera_mount":
        design = cad.generate(
            "Camera mount for Intel RealSense D435, "
            "adjustable angle ±45°, M6 mounting"
        )
    
    # Generate production files
    planner = ProductionPlanner()
    plan = planner.create_production_plan(
        design_id="camera_mount",
        methods=["3d_print"],
        quantity=1
    )
    
    # Manufacture
    for operation in plan.operations:
        if operation.type == "3d_print":
            api.start_print(
                file="camera_mount.stl",
                material="PETG",
                printer="printer_01"
            )
    
    # Install upgrade
    api.install_upgrade("camera_mount")
```

### Pattern 3: Fleet Customization

Customize robots for specific tasks in a fleet:

```python
def customize_fleet(fleet_id: str, task_type: str):
    """Customize fleet for specific task type."""
    
    # Get fleet robots
    robots = api.get_fleet(fleet_id)
    
    # Generate task-specific modifications
    if task_type == "warehouse":
        # Design shelf-compatible base
        base = cad.generate(
            "Mobile base 800x600mm, 200mm ground clearance, "
            "shelf navigation sensors"
        )
        
        # Generate for each robot
        for robot in robots:
            # Customize URDF
            custom_urdf = urdf.generate_mobile(
                drive_type="mecanum",
                base_size=(0.8, 0.6)
            )
            custom_urdf.save(f"fleet/{robot.id}_warehouse.urdf")
```

## Motor/Gear Design Integration

### NEMA Motor Mounts

```python
# Get motor from NWO inventory
motor = api.get_component("NEMA17_01")

# Generate mount
mount = cad.motor_mount(
    motor_type=motor.specs.type,
    mounting="face",
    material="6061-T6"
)

# Add to robot model
robot.attach_component(mount, location="joint_2")
```

### Gearbox Design

```python
# Design based on torque requirements
torque_required = api.calculate_torque(
    payload=10,  # kg
    arm_length=0.5  # m
)

gearbox = cad.gearbox(
    gear_type="planetary",
    ratio=10,
    input_torque=2,  # Nm
    output_torque=torque_required
)

# Verify with simulation
api.simulate_motion(
    robot=robot,
    trajectory="pick_and_place",
    gearbox=gearbox
)
```

## Electronics Integration

### PCB Enclosures

```python
# Get PCB dimensions from NWO API
pcb = api.get_component("controller_v2")

# Generate enclosure
enclosure = cad.enclosure(
    board_type="custom",
    dimensions=pcb.dimensions,
    cooling="fan_40mm",
    connectors=["USB", "Ethernet", "Power"]
)

# Add cable management
cable_chain = cad.cable_chain(
    cable_dia=8,
    length=500,
    bend_radius=50
)
```

## Assembly Planning

### Generate Assembly Sequence

```python
from nwo_text_cad.assembly import AssemblyPlanner

planner = AssemblyPlanner()

# Plan assembly
plan = planner.generate(
    parts=[
        "base_plate.step",
        "motor_mount.step",
        "gearbox.step",
        "arm_link_1.step",
        "arm_link_2.step",
        "gripper.step"
    ],
    mode="robot",  # Optimized for robot assembly
    constraints={
        "max_part_weight": 5,  # kg
        "gripper_type": "parallel_jaw"
    }
)

# Export instructions
plan.export_instructions("assembly_instructions.pdf")
plan.save("assembly_plan.json")

# Convert to robot commands
commands = planner.to_robot_commands(plan)
for cmd in commands:
    api.execute(cmd)
```

## Production Integration

### Manufacturing Package

```python
from nwo_text_cad.production import ProductionPlanner

planner = ProductionPlanner()

# Create production plan
plan = planner.create_production_plan(
    design_id="robot_arm_v2",
    methods=["cnc", "3d_print", "sheet_metal"],
    quantity=10,
    priority="high"
)

# Estimate costs
costs = planner.estimate_cost(
    parts=["base.step", "links.step", "gripper.step"],
    quantity=10
)
print(f"Total cost: ${costs['total']:.2f}")

# Generate CNC programs
for part in plan.parts:
    if part.method == "cnc":
        gcode = planner.generate_cnc_program(
            part.file,
            machine="5-axis"
        )
        with open(f"{part.name}.nc", "w") as f:
            f.write(gcode)

# Export complete package
plan.export_package("./production_package/")
```

## API Reference

### CADGenerator

```python
generator = CADGenerator(api_key="optional")

# Generate from description
model = generator.generate("description", material="aluminum")

# Generate from NWO task
model = generator.generate_from_task(task_id)

# Specialized generators
mount = generator.motor_mount("NEMA17", material="aluminum")
gearbox = generator.gearbox("planetary", ratio=10)
gears = generator.gear_train(ratio=5, module=1.0)
enclosure = generator.enclosure("rpi4", cooling="fan_40mm")

# Export
model.export_step("file.step")
model.export_stl("file.stl")
model.export_dxf("file.dxf")
model.export("format", "file.ext")
```

### URDFGenerator

```python
generator = URDFGenerator(api_key="optional")

# Robot types
robot = generator.generate_manipulator(dof=6, reach=1.0, payload=5.0)
robot = generator.generate_mobile(drive_type="mecanum", wheel_dia=0.1)
robot = generator.generate_quadruped(leg_length=0.2)

# From task
robot = generator.generate_for_task(task_spec)

# From description
robot = generator.generate("6-DOF arm with 1m reach")

# Save and validate
robot.save("robot.urdf")
errors = robot.validate()
```

### AssemblyPlanner

```python
planner = AssemblyPlanner()

# Generate plan
plan = planner.generate(parts=["*.step"], mode="robot")

# Convert to commands
commands = planner.to_robot_commands(plan)

# Save
plan.save("plan.json")
plan.export_instructions("instructions.pdf")
```

### ProductionPlanner

```python
planner = ProductionPlanner()

# Create plan
plan = planner.create_production_plan(
    design_id="name",
    methods=["cnc", "3d_print"],
    quantity=10
)

# Estimates
costs = planner.estimate_cost(parts, quantity)
times = planner.estimate_time(plan)

# Generate outputs
gcode = planner.generate_cnc_program("part.step")
settings = planner.generate_print_settings("part.stl", "PETG")
bom = planner.create_bom(parts, sourcing=True)

# Export
plan.export_package("./output/")
```

## Best Practices

1. **Always validate** generated models before production
2. **Use task specifications** from NWO API for optimal designs
3. **Version control** generated CAD files
4. **Test assemblies** in simulation before physical build
5. **Document assumptions** in design parameters

## Troubleshooting

### Import Errors

```bash
# Install with all dependencies
pip install nwo-text-cad[dev,nwo]

# Or install build123d separately
pip install build123d ocp
```

### API Connection

```python
# Check API connectivity
api = RobotAPI(api_key="your_key")
status = api.health_check()
print(f"API Status: {status}")
```

### CAD Generation Fails

```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Try simpler description
model = cad.generate("simple bracket 100x50x5mm")
```

## Examples

See `examples/` directory for complete examples:
- `example_pick_place_robot.py` - Full pick-and-place robot design
- `example_self_production.py` - Robot manufacturing itself
- `example_fleet_customization.py` - Fleet-wide customization
