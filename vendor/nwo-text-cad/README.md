# NWO Text-to-CAD

**AI-Powered CAD Generation for NWO Robotics**

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PyPI](https://img.shields.io/badge/pypi-v0.1.0-blue.svg)](https://pypi.org/project/nwo-text-cad/)

Transform natural language descriptions into production-ready mechanical designs, robot descriptions, and manufacturing outputs. Built for autonomous robot self-production and fleet customization.

---

## 🎯 Overview

NWO Text-to-CAD bridges the gap between high-level task descriptions and physical hardware production. It enables:

- **Autonomous Design**: Robots design their own hardware based on task requirements
- **Self-Production**: End-to-end manufacturing from description to physical part
- **Fleet Customization**: Rapid adaptation of robot fleets for specific missions
- **Knowledge Capture**: Design patterns encoded as reusable, version-controlled code

---

## ✨ Core Capabilities

### Without NWO Robotics API

**Standalone CAD Generation:**
```python
from nwo_text_cad import CADGenerator

cad = CADGenerator()

# Generate mechanical parts from descriptions
bracket = cad.generate("L-bracket 100x50x5mm with 4x M5 holes")
bracket.export_step("bracket.step")
bracket.export_stl("bracket.stl")

# Motor mounts with standard specifications
mount = cad.motor_mount("NEMA17", material="6061-T6")
mount.export_step("mount.step")

# Gearbox design
gb = cad.gearbox("planetary", ratio=10, input="NEMA23")
gb.export_step("gearbox.step")

# Electronics enclosures
enclosure = cad.enclosure("raspberry-pi-4", cooling="fan-40mm")
enclosure.export_stl("case.stl")
```

**Robot Description Generation:**
```python
from nwo_text_cad import URDFGenerator

urdf = URDFGenerator()

# Manipulator arms
arm = urdf.generate_manipulator(dof=6, reach=1.0, payload=5.0)
arm.save("arm.urdf")

# Mobile robots
rover = urdf.generate_mobile(drive_type="mecanum", wheel_dia=0.1)
rover.save("rover.urdf")

# Legged robots
quadruped = urdf.generate_quadruped(leg_length=0.2)
quadruped.save("quadruped.urdf")
```

**Assembly Planning:**
```python
from nwo_text_cad.assembly import AssemblyPlanner

planner = AssemblyPlanner()

# Generate assembly sequence
plan = planner.generate(
    parts=["base.step", "motor.step", "arm.step"],
    mode="manual"  # or "robot" for automated assembly
)

plan.save("assembly.json")
plan.export_instructions("instructions.pdf")
```

**Production Planning:**
```python
from nwo_text_cad.production import ProductionPlanner

prod = ProductionPlanner()

# Cost estimation
costs = prod.estimate_cost(["part1.step", "part2.step"], quantity=10)
print(f"Total: ${costs['total']:.2f}")

# CNC G-code generation
gcode = prod.generate_cnc_program("part.step", machine="3-axis")
with open("part.nc", "w") as f:
    f.write(gcode)

# 3D print settings
settings = prod.generate_print_settings("part.stl", material="PETG")
```

### With NWO Robotics API

**Task-Driven Design:**
```python
from nwo_text_cad import CADGenerator, URDFGenerator
from nwo_robotics import RobotAPI

api = RobotAPI(api_key="your_key")
cad = CADGenerator(api_key="your_key")
urdf = URDFGenerator(api_key="your_key")

# Fetch task from NWO API
task = api.get_task("task_pick_place_001")
# Task: {type: "pick_place", payload: 5kg, reach: 0.8m}

# Automatically design optimal hardware
gripper = cad.generate_from_task(task)
# Generates: Parallel jaw gripper, 5kg capacity, 80mm opening

robot = urdf.generate_for_task(task)
# Generates: 6-DOF arm, 0.8m reach, 5kg payload

# Export for immediate production
gripper.export_step("gripper.step")
gripper.export_stl("gripper.stl")
robot.save("robot.urdf")
```

**Self-Production Loop:**
```python
from nwo_text_cad.assembly import AssemblyPlanner
from nwo_text_cad.production import ProductionPlanner

# Design upgrade
sensor_mount = cad.generate(
    "Camera mount for Intel RealSense D435, "
    "45-degree adjustable, M6 mounting"
)

# Plan production
prod = ProductionPlanner()
plan = prod.create_production_plan(
    design_id="sensor_mount",
    methods=["3d_print"],
    quantity=1
)

# Manufacture
for op in plan.operations:
    if op.type == "3d_print":
        api.start_print(
            file="sensor_mount.stl",
            material="PETG",
            printer_id="printer_01"
        )

# Assemble
planner = AssemblyPlanner()
assembly = planner.generate(
    parts=["sensor_mount.stl"],
    mode="robot"
)

for step in assembly.steps:
    api.execute_assembly_step(step)

# Install
api.install_upgrade("sensor_mount")
```

**Fleet Customization:**
```python
# Customize entire fleet for specific task
fleet = api.get_fleet("fleet_warehouse")

for robot in fleet.robots:
    # Analyze robot's assigned tasks
    tasks = api.get_robot_tasks(robot.id)
    
    # Generate custom modifications
    if any(t.type == "shelf_picking" for t in tasks):
        # Extend reach
        extension = cad.generate(
            f"Arm extension 100mm, {robot.arm_interface} mounting"
        )
        extension.export_step(f"{robot.id}_extension.step")
        
        # Update URDF
        custom_urdf = urdf.generate_manipulator(
            dof=robot.dof,
            reach=robot.reach + 0.1,
            payload=robot.payload
        )
        custom_urdf.save(f"{robot.id}_custom.urdf")
        
        # Deploy
        api.update_robot_model(robot.id, custom_urdf)
```

**Simulation-Driven Validation:**
```python
from nwo_text_cad.sdf import SDFGenerator

sdf = SDFGenerator()

# Generate simulation from task
task = api.get_task("task_navigate_warehouse")
sim_world = sdf.generate_for_task(task)
# Includes: warehouse layout, shelves, dynamic obstacles

sim_world.save("warehouse_sim.world")

# Launch simulation
sim_id = api.launch_simulation("warehouse_sim.world")

# Test robot in simulation
results = api.run_simulation(
    sim_id=sim_id,
    robot_urdf="robot.urdf",
    task=task,
    duration=300  # seconds
)

# Validate design before production
if results.success_rate > 0.95:
    # Proceed to manufacturing
    api.start_production(gripper)
else:
    # Iterate design
    improved = cad.generate_from_task(task, iteration=2)
```

---

## 🧰 Skills

| Skill | Description | Standalone | With NWO API |
|-------|-------------|------------|--------------|
| **CAD** | Parametric 3D modeling | ✅ Full | ✅ Task-aware |
| **URDF** | Robot kinematics | ✅ Full | ✅ Auto-configured |
| **SDF** | Simulation environments (Gazebo/Ignition) | ✅ Full | ✅ Task-matched |
| **Assembly** | Build sequences | ✅ Manual | ✅ Robot-executed |
| **Production** | Manufacturing | ✅ Estimation | ✅ Live control |

---

## 📦 Installation

### From PyPI (Recommended)

```bash
# Core functionality
pip install nwo-text-cad

# With NWO Robotics integration
pip install nwo-text-cad[nwo]

# Development dependencies
pip install nwo-text-cad[dev]

# All features
pip install nwo-text-cad[all]
```

### From Source

```bash
git clone https://github.com/RedCiprianPater/nwo-text-cad.git
cd nwo-text-cad
pip install -e .
```

---

## 🚀 Quick Start

### Standalone Mode

```python
from nwo_text_cad import CADGenerator

# Initialize
cad = CADGenerator()

# Generate part
part = cad.generate("Motor mount for NEMA 17, 3mm wall thickness")

# Export
part.export_step("mount.step")
part.export_stl("mount.stl")
```

### With NWO Robotics

```python
import os
from nwo_text_cad import CADGenerator
from nwo_robotics import RobotAPI

# Configure
os.environ["NWO_API_KEY"] = "your_api_key"

# Initialize
api = RobotAPI()
cad = CADGenerator(api_key=os.getenv("NWO_API_KEY"))

# Get task
task = api.get_task("task_001")

# Design and produce
component = cad.generate_from_task(task)
component.export_step("component.step")

# Send to production
api.submit_for_manufacturing("component.step")
```

---

## 🛠️ CLI Usage

### CAD Generation

```bash
# Generate from description
nwo-cad generate "L-bracket 100x50x5mm" -o bracket.step

# Motor mount
nwo-cad motor-mount --type NEMA17 --material aluminum -o mount.step

# Gearbox
nwo-cad gearbox --type planetary --ratio 10 -o gearbox.step

# From NWO task
nwo-cad from-task task_001 --api-key $NWO_API_KEY
```

### URDF Generation

```bash
# Manipulator
nwo-urdf manipulator --dof 6 --reach 1.0 --payload 5 -o arm.urdf

# Mobile robot
nwo-urdf mobile --type mecanum --wheel-dia 0.1 -o rover.urdf

# From task
nwo-urdf from-task task_001 --api-key $NWO_API_KEY
```

### SDF Generation

```bash
# World environment
nwo-sdf world --type warehouse --size 50x30 -o warehouse.world

# Robot model
nwo-sdf robot --type mobile --sensors camera,lidar -o robot.sdf

# From URDF
nwo-sdf from-urdf robot.urdf -o robot.sdf

# From task
nwo-sdf from-task task_001 --api-key $NWO_API_KEY
```

### Assembly Planning

```bash
# Generate plan
nwo-assembly plan --parts "*.step" --mode robot -o plan.json

# Export instructions
nwo-assembly instructions --plan plan.json --format pdf
```

### Production

```bash
# Cost estimate
nwo-production cost --parts "*.step" --quantity 10

# Generate CNC code
nwo-production cnc --input part.step --machine 5-axis -o part.nc

# Full package
nwo-production package --project my_robot -o production/
```

---

## 📚 Documentation

- [Integration Guide](INTEGRATION.md) - Complete API integration examples
- [CAD Skill](skills/cad/SKILL.md) - Mechanical design patterns
- [URDF Skill](skills/urdf/SKILL.md) - Robot kinematics
- [SDF Skill](skills/sdf/SKILL.md) - Simulation environments
- [Assembly Skill](skills/assembly/SKILL.md) - Build planning
- [Production Skill](skills/production/SKILL.md) - Manufacturing

---

## 🔧 Requirements

- Python 3.11+
- build123d >= 0.15.0
- OpenCASCADE >= 7.7.0
- numpy >= 1.24.0

Optional:
- nwo-robotics >= 1.0.0 (for API integration)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     NWO Text-to-CAD                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   CAD    │  │  URDF    │  │ Assembly │  │Production│   │
│  │ Generator│  │ Generator│  │ Planner  │  │ Planner  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│       └─────────────┴──────┬──────┴─────────────┘          │
│                            │                               │
│                    ┌──────────────┐                        │
│                    │ NWO Robotics │                        │
│                    │     API      │                        │
│                    └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing

```bash
# Run tests
pytest tests/

# With coverage
pytest --cov=nwo_text_cad tests/

# Specific test
pytest tests/test_cad_generator.py
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 🔗 Links

- Repository: https://github.com/RedCiprianPater/nwo-text-cad
- PyPI: https://pypi.org/project/nwo-text-cad/
- Documentation: https://github.com/RedCiprianPater/nwo-text-cad#readme
- Issues: https://github.com/RedCiprianPater/nwo-text-cad/issues

---

## 🙏 Acknowledgments

Based on [text-to-cad](https://github.com/earthtojake/text-to-cad) by earthtojake.
Enhanced with NWO Robotics ecosystem integration.

---

**Built for autonomous robot self-production** 🤖⚡
