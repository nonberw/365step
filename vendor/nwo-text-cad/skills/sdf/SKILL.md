---
name: nwo-sdf
description: Generate SDF (Simulation Description Format) files for Gazebo, Ignition, and other simulators. Creates physics-based simulation models with sensors, plugins, and world environments. Integrates with NWO Robotics API for task-specific simulation scenarios.
---

# NWO SDF Skill

Generate simulation descriptions for NWO Robotics testing and validation.

## Purpose

Create SDF files that define physics-based simulation environments for testing NWO Robotics agents. Includes robot models, sensors, plugins, and world configurations.

## NWO API Integration

```python
from nwo_text_cad.sdf import SDFGenerator
from nwo_robotics import RobotAPI

# Get task requirements
api = RobotAPI(api_key="your_key")
task = api.get_task("task_001")

# Generate simulation environment
sdf = SDFGenerator()
world = sdf.generate_for_task(task)
world.save("simulation.world")

# Launch simulation
api.launch_simulation("simulation.world")
```

## Simulation Types

### Robot Models

```bash
# Basic mobile robot
nwo-sdf robot --type mobile --name "rover_01" --sensors "camera,lidar,imu"

# Manipulator with physics
nwo-sdf robot --type manipulator --dof 6 --physics ode

# Quadruped with terrain adaptation
nwo-sdf robot --type quadruped --terrain "uneven" --sensors "force,imu"
```

### World Environments

```bash
# Warehouse simulation
nwo-sdf world --type warehouse --size "50x30" --shelves 20

# Outdoor terrain
nwo-sdf world --type outdoor --terrain "hilly" --vegetation

# Pick-and-place workspace
nwo-sdf world --type workspace --conveyor --bins 10
```

### Sensor Configuration

```bash
# Camera setup
nwo-sdf sensor --type camera --resolution "1920x1080" --fov 90

# LiDAR
nwo-sdf sensor --type lidar --range 30 --rate 10

# IMU
nwo-sdf sensor --type imu --noise 0.01

# Force/torque
nwo-sdf sensor --type force --joint "wrist"
```

## Physics Engines

| Engine | Use Case | Features |
|--------|----------|----------|
| ODE | General purpose | Stable, fast |
| Bullet | Collision-heavy | Accurate contacts |
| Simbody | Biomechanics | Accurate joints |
| DART | Robotics research | Flexible constraints |

## Plugins

### ROS 2 Integration

```xml
<plugin name="ros2" filename="libgazebo_ros2_control.so">
  <robot_param>robot_description</robot_param>
  <robot_param_node>robot_state_publisher</robot_param_node>
</plugin>
```

### NWO Agent Plugin

```xml
<plugin name="nwo_agent" filename="libnwo_agent_plugin.so">
  <api_key>${NWO_API_KEY}</api_key>
  <agent_id>agent_001</agent_id>
  <task_queue>tasks</task_queue>
</plugin>
```

## Commands

### Generate

```bash
python scripts/nwo-sdf generate robot --type mobile -o robot.sdf
python scripts/nwo-sdf generate world --type warehouse -o warehouse.world
python scripts/nwo-sdf from-task <task_id> --api-key <key>
```

### Validate

```bash
python scripts/nwo-sdf validate model.sdf
python scripts/nwo-sdf validate world.world --physics ode
```

### Convert

```bash
python scripts/nwo-sdf from-urdf robot.urdf -o robot.sdf
python scripts/nwo-sdf to-ignition model.sdf -o model.ign
```

## SDF Structure

```xml
<?xml version="1.0"?>
<sdf version="1.6">
  <world name="nwo_simulation">
    <!-- Physics -->
    <physics type="ode">
      <real_time_update_rate>1000</real_time_update_rate>
    </physics>
    
    <!-- Scene -->
    <scene>
      <ambient>0.4 0.4 0.4 1</ambient>
      <background>0.7 0.7 0.7 1</background>
    </scene>
    
    <!-- Models -->
    <include>
      <uri>model://ground_plane</uri>
    </include>
    
    <model name="nwo_robot">
      <pose>0 0 0.5 0 0 0</pose>
      <link name="base">
        <collision name="collision">
          <geometry>
            <box><size>0.5 0.3 0.1</size></box>
          </geometry>
        </collision>
      </link>
      
      <plugin name="nwo_control" filename="libnwo_control.so"/>
    </model>
  </world>
</sdf>
```

## Task-Specific Simulations

### Pick-and-Place

```python
task_spec = {
    "task_type": "pick_place",
    "objects": ["box_5kg", "cylinder_2kg"],
    "workspace": "2x2m",
    "conveyor": True
}

world = sdf.generate_for_task(task_spec)
# Includes: conveyor belt, bins, objects, sensors
```

### Navigation

```python
task_spec = {
    "task_type": "navigation",
    "environment": "warehouse",
    "obstacles": "dynamic",
    "shelves": 20
}

world = sdf.generate_for_task(task_spec)
# Includes: warehouse layout, shelves, dynamic obstacles
```

### Inspection

```python
task_spec = {
    "task_type": "inspection",
    "target": "pipeline",
    "sensors": ["camera", "thermal"],
    "environment": "industrial"
}

world = sdf.generate_for_task(task_spec)
# Includes: pipeline model, inspection points, lighting
```

## References

- `references/sdf-spec.md` - SDF specification details
- `references/gazebo-plugins.md` - Available plugins
- `references/physics-tuning.md` - Physics parameter tuning
