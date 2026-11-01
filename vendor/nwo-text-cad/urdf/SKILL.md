---
name: nwo-urdf
description: Generate URDF robot descriptions for NWO Robotics agents. Creates kinematic models with proper joints, limits, and mesh references. Integrates with NWO API for task-specific robot configurations. Supports RViz, Gazebo, MoveIt2.
---

# NWO URDF Skill

Generate robot descriptions optimized for NWO Robotics tasks.

## Purpose

Create URDF files that define robot kinematics, dynamics, and visual/collision geometry. Integrated with NWO Robotics API to generate task-appropriate robot configurations.

## NWO API Integration

```python
from nwo_text_cad.urdf import URDFGenerator
from nwo_robotics import RobotAPI

# Get task from NWO API
api = RobotAPI(api_key="your_key")
task_spec = api.get_task_specification(task_id)

# Generate robot for task
urdf = URDFGenerator()
robot = urdf.generate_for_task(task_spec)

# Export
robot.save("robot.urdf")
```

## Robot Types

### Manipulator Arms

```bash
# 6-DOF industrial arm
nwo-urdf manipulator --dof 6 --reach 1000mm --payload 10kg

# Collaborative robot
nwo-urdf manipulator --type cobot --dof 7 --reach 800mm --payload 5kg

# Scara for assembly
nwo-urdf scara --reach 400mm --payload 2kg --z-stroke 100mm
```

### Mobile Robots

```bash
# Differential drive
nwo-urdf mobile --type diff-drive --wheel-dia 100mm --track-width 300mm

# Mecanum drive
nwo-urdf mobile --type mecanum --wheel-dia 80mm --chassis 400x300mm

# Ackermann steering
nwo-urdf mobile --type ackermann --wheelbase 250mm --track 200mm
```

### Legged Robots

```bash
# Quadruped
nwo-urdf quadruped --leg-length 200mm --body-size 300x150mm

# Humanoid
nwo-urdf humanoid --height 1200mm --dof 25
```

### Custom from Description

```bash
# Natural language to URDF
nwo-urdf generate "4-wheel rover with rocker-bogie suspension, 10kg payload"
nwo-urdf generate "delta robot with 200mm workspace, 1kg payload"
```

## Task-Aware Generation

The NWO API provides task requirements that inform URDF generation:

```python
task_requirements = {
    "task_type": "pick_place",
    "payload_mass": 5.0,  # kg
    "reach_required": 0.8,  # meters
    "precision": 0.001,  # meters
    "speed": 0.5,  # m/s
    "environment": "warehouse"
}

# Generator selects appropriate configuration
robot = urdf.generate_for_task(task_requirements)
# Results in: 6-DOF arm, 1m reach, 5kg payload, appropriate joints
```

## Joint Types

| Type | Use Case | Example |
|------|----------|---------|
| revolute | Rotational joints | Arm joints, wheels |
| prismatic | Linear motion | Linear actuators, lifts |
| continuous | Infinite rotation | Wheels, rollers |
| fixed | Rigid connection | Base plates, adapters |
| planar | 2D movement | XY tables |
| floating | 6-DOF | Mobile base, drones |

## Commands

### Generate

```bash
python scripts/nwo-urdf generate <description>
python scripts/nwo-urdf generate "6-DOF arm" -o arm.urdf
python scripts/nwo-urdf from-task <task_id> --api-key <key>
```

### Validate

```bash
python scripts/nwo-urdf validate robot.urdf
python scripts/nwo-urdf validate robot.urdf --check-collisions
```

### Convert

```bash
python scripts/nwo-urdf to-sdf robot.urdf -o robot.sdf
python scripts/nwo-urdf to-srdf robot.urdf -o robot.srdf
```

## Frame Conventions

Following ROS/URDF standards:

- **Base link:** `base_link` - Robot root frame
- **Joint axes:** Z-axis is rotation/translation axis
- **Right-hand rule:** Positive rotation is CCW when looking along +Z
- **Units:** meters (length), radians (angle), kilograms (mass)

## Mesh References

URDF files reference meshes for visual and collision:

```xml
<visual>
  <geometry>
    <mesh filename="package://robot_description/meshes/link1.stl"/>
  </geometry>
</visual>
```

The NWO CAD skill generates these meshes alongside URDF.

## Transmission Elements

For ROS Control integration:

```xml
<transmission name="arm_joint_trans">
  <type>transmission_interface/SimpleTransmission</type>
  <joint name="arm_joint">
    <hardwareInterface>hardware_interface/EffortJointInterface</hardwareInterface>
  </joint>
  <actuator name="arm_motor">
    <mechanicalReduction>1</mechanicalReduction>
  </actuator>
</transmission>
```

## Gazebo Extensions

SDF plugins for simulation:

```xml
<gazebo>
  <plugin name="gazebo_ros_control" filename="libgazebo_ros_control.so"/>
</gazebo>
```

## References

- `references/urdf-conventions.md` - URDF best practices
- `references/joint-limits.md` - Typical joint limits by type
- `references/gazebo-plugins.md` - Simulation plugins
