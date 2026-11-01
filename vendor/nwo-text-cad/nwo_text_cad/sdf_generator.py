#!/usr/bin/env python3
"""
SDF Generator - Simulation Description Format for Gazebo/Ignition
"""

import os
from typing import Optional, Dict, Any, List
from pathlib import Path
import xml.etree.ElementTree as ET


class SDFGenerator:
    """Generate SDF simulation files."""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize SDF generator.
        
        Args:
            api_key: NWO Robotics API key
        """
        self.api_key = api_key or os.getenv("NWO_API_KEY")
        self._api = None
        
        if self.api_key:
            try:
                from nwo_robotics import RobotAPI
                self._api = RobotAPI(api_key=self.api_key)
            except ImportError:
                pass
    
    def generate_world(self, world_type: str = "empty", 
                      size: Optional[tuple] = None,
                      **kwargs) -> "SDFWorld":
        """
        Generate simulation world.
        
        Args:
            world_type: Type of world (empty, warehouse, outdoor)
            size: World dimensions (width, depth) in meters
            **kwargs: Additional world parameters
            
        Returns:
            SDFWorld object
        """
        return SDFWorld(world_type=world_type, size=size, **kwargs)
    
    def generate_robot(self, robot_type: str = "mobile",
                      name: str = "robot",
                      sensors: Optional[List[str]] = None,
                      **kwargs) -> "SDFModel":
        """
        Generate robot SDF model.
        
        Args:
            robot_type: Type of robot (mobile, manipulator, quadruped)
            name: Robot name
            sensors: List of sensors to include
            **kwargs: Additional robot parameters
            
        Returns:
            SDFModel object
        """
        return SDFModel(
            name=name,
            robot_type=robot_type,
            sensors=sensors or [],
            **kwargs
        )
    
    def generate_for_task(self, task_spec: Dict[str, Any]) -> "SDFWorld":
        """
        Generate simulation environment for NWO task.
        
        Args:
            task_spec: Task specification from NWO API
            
        Returns:
            SDFWorld configured for task
        """
        task_type = task_spec.get("task_type", "general")
        
        if task_type == "pick_place":
            return self._generate_pick_place_world(task_spec)
        elif task_type == "navigation":
            return self._generate_navigation_world(task_spec)
        elif task_type == "inspection":
            return self._generate_inspection_world(task_spec)
        else:
            return self.generate_world("empty")
    
    def _generate_pick_place_world(self, spec: Dict[str, Any]) -> "SDFWorld":
        """Generate pick-and-place workspace."""
        world = SDFWorld(world_type="warehouse", size=(10, 10))
        
        # Add conveyor if specified
        if spec.get("conveyor"):
            world.add_model("conveyor", pose=(0, -2, 0.5))
        
        # Add bins
        bins = spec.get("bins", 5)
        for i in range(bins):
            world.add_model("bin", pose=(2 + i*0.5, 0, 0))
        
        # Add objects to pick
        for obj in spec.get("objects", ["box"]):
            world.add_model(obj, pose=(0, 0, 0.5))
        
        return world
    
    def _generate_navigation_world(self, spec: Dict[str, Any]) -> "SDFWorld":
        """Generate navigation environment."""
        env_type = spec.get("environment", "warehouse")
        
        if env_type == "warehouse":
            world = SDFWorld(world_type="warehouse", size=(50, 30))
            
            # Add shelves
            shelves = spec.get("shelves", 10)
            for i in range(shelves):
                x = 5 + (i % 5) * 8
                y = 5 + (i // 5) * 10
                world.add_model("shelf", pose=(x, y, 0))
        else:
            world = SDFWorld(world_type="outdoor", size=(100, 100))
        
        return world
    
    def _generate_inspection_world(self, spec: Dict[str, Any]) -> "SDFWorld":
        """Generate inspection environment."""
        target = spec.get("target", "generic")
        
        world = SDFWorld(world_type="industrial", size=(20, 20))
        world.add_model(target, pose=(5, 5, 2))
        
        return world
    
    def from_urdf(self, urdf_file: str, **kwargs) -> "SDFModel":
        """
        Convert URDF to SDF.
        
        Args:
            urdf_file: Path to URDF file
            **kwargs: Additional SDF parameters
            
        Returns:
            SDFModel converted from URDF
        """
        # Simplified conversion - would parse URDF and create SDF
        return SDFModel(
            name=Path(urdf_file).stem,
            robot_type="generic",
            **kwargs
        )


class SDFWorld:
    """Represents an SDF simulation world."""
    
    def __init__(self, world_type: str = "empty", 
                 size: Optional[tuple] = None,
                 **kwargs):
        self.world_type = world_type
        self.size = size or (10, 10)
        self.physics_engine = kwargs.get("physics", "ode")
        self.models: List[Dict] = []
        self.plugins: List[Dict] = []
        
        # Add ground plane
        self.add_model("ground_plane", pose=(0, 0, 0))
    
    def add_model(self, name: str, pose: tuple = (0, 0, 0),
                  model_type: str = "static"):
        """Add a model to the world."""
        self.models.append({
            "name": name,
            "pose": pose,
            "type": model_type
        })
    
    def add_plugin(self, name: str, filename: str, **params):
        """Add a plugin to the world."""
        self.plugins.append({
            "name": name,
            "filename": filename,
            "params": params
        })
    
    def save(self, filepath: str):
        """Save SDF world to file."""
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        
        sdf_content = self._generate_sdf()
        with open(filepath, 'w') as f:
            f.write(sdf_content)
    
    def _generate_sdf(self) -> str:
        """Generate SDF XML content."""
        root = ET.Element("sdf", version="1.6")
        world = ET.SubElement(root, "world", name="nwo_world")
        
        # Physics
        physics = ET.SubElement(world, "physics", type=self.physics_engine)
        ET.SubElement(physics, "real_time_update_rate").text = "1000"
        ET.SubElement(physics, "max_step_size").text = "0.001"
        
        # Scene
        scene = ET.SubElement(world, "scene")
        ambient = ET.SubElement(scene, "ambient")
        ambient.text = "0.4 0.4 0.4 1"
        background = ET.SubElement(scene, "background")
        background.text = "0.7 0.7 0.7 1"
        
        # Models
        for model in self.models:
            include = ET.SubElement(world, "include")
            uri = ET.SubElement(include, "uri")
            uri.text = f"model://{model['name']}"
            pose = ET.SubElement(include, "pose")
            pose.text = f"{model['pose'][0]} {model['pose'][1]} {model['pose'][2]} 0 0 0"
        
        # Plugins
        for plugin in self.plugins:
            plugin_elem = ET.SubElement(world, "plugin", 
                                       name=plugin["name"],
                                       filename=plugin["filename"])
            for key, value in plugin["params"].items():
                param = ET.SubElement(plugin_elem, key)
                param.text = str(value)
        
        return ET.tostring(root, encoding='unicode', method='xml')


class SDFModel:
    """Represents an SDF robot model."""
    
    def __init__(self, name: str, robot_type: str,
                 sensors: Optional[List[str]] = None,
                 **kwargs):
        self.name = name
        self.robot_type = robot_type
        self.sensors = sensors or []
        self.links: List[Dict] = []
        self.joints: List[Dict] = []
        self.plugins: List[Dict] = []
        
        self._build_structure(**kwargs)
    
    def _build_structure(self, **kwargs):
        """Build model structure based on type."""
        # Base link
        self.links.append({
            "name": "base_link",
            "collision": {"geometry": "box", "size": [0.5, 0.3, 0.1]},
            "visual": {"geometry": "box", "size": [0.5, 0.3, 0.1]}
        })
        
        if self.robot_type == "mobile":
            self._build_mobile(**kwargs)
        elif self.robot_type == "manipulator":
            self._build_manipulator(**kwargs)
    
    def _build_mobile(self, **kwargs):
        """Build mobile robot structure."""
        # Add wheels
        for i, side in enumerate(["left", "right"]):
            self.links.append({
                "name": f"{side}_wheel",
                "collision": {"geometry": "cylinder", "radius": 0.05, "length": 0.03}
            })
            self.joints.append({
                "name": f"{side}_wheel_joint",
                "type": "revolute",
                "parent": "base_link",
                "child": f"{side}_wheel",
                "axis": [0, 1, 0]
            })
    
    def _build_manipulator(self, **kwargs):
        """Build manipulator structure."""
        dof = kwargs.get("dof", 6)
        
        for i in range(dof):
            self.links.append({
                "name": f"link_{i+1}",
                "collision": {"geometry": "cylinder", "radius": 0.05, "length": 0.15}
            })
            self.joints.append({
                "name": f"joint_{i+1}",
                "type": "revolute",
                "parent": "base_link" if i == 0 else f"link_{i}",
                "child": f"link_{i+1}",
                "axis": [0, 0, 1] if i % 2 == 0 else [0, 1, 0],
                "limits": {"lower": -3.14, "upper": 3.14, "effort": 10, "velocity": 1}
            })
    
    def add_sensor(self, sensor_type: str, name: str, **params):
        """Add sensor to model."""
        self.sensors.append({
            "type": sensor_type,
            "name": name,
            "params": params
        })
    
    def save(self, filepath: str):
        """Save SDF model to file."""
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        
        sdf_content = self._generate_sdf()
        with open(filepath, 'w') as f:
            f.write(sdf_content)
    
    def _generate_sdf(self) -> str:
        """Generate SDF XML content."""
        root = ET.Element("sdf", version="1.6")
        model = ET.SubElement(root, "model", name=self.name)
        
        # Links
        for link in self.links:
            link_elem = ET.SubElement(model, "link", name=link["name"])
            
            if "collision" in link:
                collision = ET.SubElement(link_elem, "collision", name="collision")
                geom = ET.SubElement(collision, "geometry")
                if link["collision"]["geometry"] == "box":
                    box = ET.SubElement(geom, "box")
                    size = ET.SubElement(box, "size")
                    size.text = " ".join(map(str, link["collision"]["size"]))
                elif link["collision"]["geometry"] == "cylinder":
                    cyl = ET.SubElement(geom, "cylinder")
                    radius = ET.SubElement(cyl, "radius")
                    radius.text = str(link["collision"]["radius"])
                    length = ET.SubElement(cyl, "length")
                    length.text = str(link["collision"]["length"])
        
        # Joints
        for joint in self.joints:
            joint_elem = ET.SubElement(model, "joint", name=joint["name"], type=joint["type"])
            parent = ET.SubElement(joint_elem, "parent")
            parent.text = joint["parent"]
            child = ET.SubElement(joint_elem, "child")
            child.text = joint["child"]
            axis = ET.SubElement(joint_elem, "axis")
            xyz = ET.SubElement(axis, "xyz")
            xyz.text = " ".join(map(str, joint["axis"]))
            if "limits" in joint:
                limits = ET.SubElement(axis, "limit")
                for key, value in joint["limits"].items():
                    elem = ET.SubElement(limits, key)
                    elem.text = str(value)
        
        # Sensors
        for sensor in self.sensors:
            sensor_elem = ET.SubElement(model, "sensor", name=sensor["name"], type=sensor["type"])
            for key, value in sensor["params"].items():
                param = ET.SubElement(sensor_elem, key)
                param.text = str(value)
        
        return ET.tostring(root, encoding='unicode', method='xml')
