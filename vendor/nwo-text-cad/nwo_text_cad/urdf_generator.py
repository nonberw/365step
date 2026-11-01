#!/usr/bin/env python3
"""
URDF Generator - Robot description generation for NWO Robotics
"""

import os
from typing import Optional, Dict, Any, List
from pathlib import Path
import xml.etree.ElementTree as ET


class URDFGenerator:
    """Generate URDF robot descriptions."""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize URDF generator.
        
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
    
    def generate_manipulator(self, dof: int = 6, reach: float = 1.0, 
                            payload: float = 5.0, **kwargs) -> "URDFRobot":
        """
        Generate manipulator arm URDF.
        
        Args:
            dof: Degrees of freedom
            reach: Reach in meters
            payload: Max payload in kg
            **kwargs: Additional options
            
        Returns:
            URDFRobot object
        """
        return URDFRobot(
            name=f"manipulator_{dof}dof",
            type="manipulator",
            params={"dof": dof, "reach": reach, "payload": payload, **kwargs}
        )
    
    def generate_mobile(self, drive_type: str = "diff-drive",
                       wheel_dia: float = 0.1, **kwargs) -> "URDFRobot":
        """
        Generate mobile robot URDF.
        
        Args:
            drive_type: diff-drive, mecanum, ackermann
            wheel_dia: Wheel diameter in meters
            **kwargs: Additional options
            
        Returns:
            URDFRobot object
        """
        return URDFRobot(
            name=f"mobile_{drive_type}",
            type="mobile",
            params={"drive": drive_type, "wheel_dia": wheel_dia, **kwargs}
        )
    
    def generate_quadruped(self, leg_length: float = 0.2,
                          body_size: tuple = (0.3, 0.15), **kwargs) -> "URDFRobot":
        """
        Generate quadruped robot URDF.
        
        Args:
            leg_length: Leg length in meters
            body_size: Body dimensions (length, width) in meters
            **kwargs: Additional options
            
        Returns:
            URDFRobot object
        """
        return URDFRobot(
            name="quadruped",
            type="legged",
            params={"legs": 4, "leg_length": leg_length, 
                   "body_size": body_size, **kwargs}
        )
    
    def generate_for_task(self, task_spec: Dict[str, Any]) -> "URDFRobot":
        """
        Generate robot optimized for NWO task.
        
        Args:
            task_spec: Task specification from NWO API
            
        Returns:
            URDFRobot optimized for task
        """
        task_type = task_spec.get("task_type", "general")
        
        if task_type == "pick_place":
            return self.generate_manipulator(
                dof=6,
                reach=task_spec.get("reach_required", 0.8),
                payload=task_spec.get("payload_mass", 1.0)
            )
        elif task_type == "navigation":
            return self.generate_mobile(
                drive_type="mecanum",
                payload=task_spec.get("payload_mass", 10.0)
            )
        else:
            return self.generate_manipulator()
    
    def generate(self, description: str, **kwargs) -> "URDFRobot":
        """
        Generate URDF from natural language description.
        
        Args:
            description: Natural language robot description
            **kwargs: Additional parameters
            
        Returns:
            URDFRobot object
        """
        # Parse description for robot type
        desc_lower = description.lower()
        
        if "arm" in desc_lower or "manipulator" in desc_lower:
            return self.generate_manipulator(**kwargs)
        elif "wheel" in desc_lower or "mobile" in desc_lower:
            return self.generate_mobile(**kwargs)
        elif "leg" in desc_lower or "quadruped" in desc_lower:
            return self.generate_quadruped(**kwargs)
        else:
            return URDFRobot(name="robot", type="generic", params=kwargs)


class URDFRobot:
    """Represents a URDF robot model."""
    
    def __init__(self, name: str, type: str, params: Dict[str, Any]):
        self.name = name
        self.type = type
        self.params = params
        self.links: List[Dict] = []
        self.joints: List[Dict] = []
        self._build_structure()
    
    def _build_structure(self):
        """Build robot link/joint structure."""
        # Base link
        self.links.append({
            "name": "base_link",
            "visual": {"geometry": "box", "size": [0.5, 0.3, 0.1]},
            "collision": {"geometry": "box", "size": [0.5, 0.3, 0.1]},
        })
        
        if self.type == "manipulator":
            self._build_manipulator()
        elif self.type == "mobile":
            self._build_mobile()
        elif self.type == "legged":
            self._build_quadruped()
    
    def _build_manipulator(self):
        """Build manipulator link structure."""
        dof = self.params.get("dof", 6)
        
        for i in range(dof):
            self.links.append({
                "name": f"link_{i+1}",
                "visual": {"geometry": "cylinder", "radius": 0.05, "length": 0.15},
            })
            self.joints.append({
                "name": f"joint_{i+1}",
                "type": "revolute",
                "parent": f"link_{i}" if i > 0 else "base_link",
                "child": f"link_{i+1}",
                "axis": [0, 0, 1] if i % 2 == 0 else [0, 1, 0],
                "limits": {"lower": -3.14, "upper": 3.14, "effort": 10, "velocity": 1.0},
            })
    
    def _build_mobile(self):
        """Build mobile robot structure."""
        drive = self.params.get("drive", "diff-drive")
        wheel_dia = self.params.get("wheel_dia", 0.1)
        
        # Add wheels
        for i, side in enumerate(["left", "right"]):
            self.links.append({
                "name": f"{side}_wheel",
                "visual": {"geometry": "cylinder", "radius": wheel_dia/2, "length": 0.05},
            })
            self.joints.append({
                "name": f"{side}_wheel_joint",
                "type": "continuous",
                "parent": "base_link",
                "child": f"{side}_wheel",
                "axis": [0, 1, 0],
            })
    
    def _build_quadruped(self):
        """Build quadruped structure."""
        leg_length = self.params.get("leg_length", 0.2)
        
        for i in range(4):
            leg_name = f"leg_{i+1}"
            self.links.append({
                "name": leg_name,
                "visual": {"geometry": "cylinder", "radius": 0.02, "length": leg_length},
            })
            self.joints.append({
                "name": f"{leg_name}_joint",
                "type": "revolute",
                "parent": "base_link",
                "child": leg_name,
                "axis": [0, 1, 0],
                "limits": {"lower": -0.78, "upper": 0.78, "effort": 5, "velocity": 5.0},
            })
    
    def save(self, filepath: str):
        """Save URDF to file."""
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        
        urdf_content = self._generate_urdf()
        with open(filepath, 'w') as f:
            f.write(urdf_content)
    
    def _generate_urdf(self) -> str:
        """Generate URDF XML content."""
        root = ET.Element("robot", name=self.name)
        
        # Add links
        for link in self.links:
            link_elem = ET.SubElement(root, "link", name=link["name"])
            if "visual" in link:
                visual = ET.SubElement(link_elem, "visual")
                geom = ET.SubElement(visual, "geometry")
                if link["visual"]["geometry"] == "box":
                    ET.SubElement(geom, "box", size=" ".join(map(str, link["visual"]["size"])))
                elif link["visual"]["geometry"] == "cylinder":
                    ET.SubElement(geom, "cylinder", 
                                radius=str(link["visual"]["radius"]),
                                length=str(link["visual"]["length"]))
        
        # Add joints
        for joint in self.joints:
            joint_elem = ET.SubElement(root, "joint", name=joint["name"], type=joint["type"])
            ET.SubElement(joint_elem, "parent", link=joint["parent"])
            ET.SubElement(joint_elem, "child", link=joint["child"])
            ET.SubElement(joint_elem, "axis", xyz=" ".join(map(str, joint["axis"])))
            if "limits" in joint:
                limits = joint["limits"]
                ET.SubElement(joint_elem, "limit",
                            lower=str(limits["lower"]),
                            upper=str(limits["upper"]),
                            effort=str(limits["effort"]),
                            velocity=str(limits["velocity"]))
        
        return ET.tostring(root, encoding='unicode', method='xml')
    
    def validate(self) -> List[str]:
        """Validate URDF structure."""
        errors = []
        
        # Check all joints reference existing links
        link_names = {l["name"] for l in self.links}
        for joint in self.joints:
            if joint["parent"] not in link_names:
                errors.append(f"Joint {joint['name']}: parent {joint['parent']} not found")
            if joint["child"] not in link_names:
                errors.append(f"Joint {joint['name']}: child {joint['child']} not found")
        
        return errors
