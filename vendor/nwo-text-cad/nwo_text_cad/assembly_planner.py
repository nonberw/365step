#!/usr/bin/env python3
"""
Assembly Planner - Assembly sequence and instruction generation
"""

from typing import List, Dict, Any, Optional
from pathlib import Path
import json


class AssemblyPlanner:
    """Plan and optimize mechanical assemblies."""
    
    def __init__(self):
        self.steps: List[AssemblyStep] = []
        self.bom: List[Dict] = []
    
    def generate(self, parts: List[str], mode: str = "robot",
                constraints: Optional[Dict] = None) -> "AssemblyPlan":
        """
        Generate assembly plan.
        
        Args:
            parts: List of part file paths
            mode: 'robot', 'human', or 'collaborative'
            constraints: Assembly constraints
            
        Returns:
            AssemblyPlan object
        """
        plan = AssemblyPlan()
        
        # Generate steps based on mode
        if mode == "robot":
            plan.steps = self._generate_robot_steps(parts)
        else:
            plan.steps = self._generate_manual_steps(parts)
        
        # Generate BOM
        plan.bom = self._generate_bom(parts)
        
        return plan
    
    def _generate_robot_steps(self, parts: List[str]) -> List["AssemblyStep"]:
        """Generate steps optimized for robot assembly."""
        steps = []
        
        for i, part in enumerate(parts):
            step = AssemblyStep(
                step_number=i + 1,
                action="place" if i > 0 else "pick_and_place",
                part=Path(part).stem,
                target="base" if i == 0 else f"part_{i}",
                fasteners=self._suggest_fasteners(part),
                vision_check=True
            )
            steps.append(step)
        
        return steps
    
    def _generate_manual_steps(self, parts: List[str]) -> List["AssemblyStep"]:
        """Generate steps for manual assembly."""
        steps = []
        
        for i, part in enumerate(parts):
            step = AssemblyStep(
                step_number=i + 1,
                action="attach",
                part=Path(part).stem,
                target="assembly",
                instructions=f"Attach {Path(part).stem} to main assembly"
            )
            steps.append(step)
        
        return steps
    
    def _suggest_fasteners(self, part: str) -> List[str]:
        """Suggest appropriate fasteners for part."""
        # Simple heuristic based on part name
        part_lower = part.lower()
        
        if "motor" in part_lower or "mount" in part_lower:
            return ["M3x10-001", "M3x10-002", "M3x10-003", "M3x10-004"]
        elif "bracket" in part_lower:
            return ["M4x12-001", "M4x12-002"]
        else:
            return ["M3x8-001"]
    
    def _generate_bom(self, parts: List[str]) -> List[Dict]:
        """Generate bill of materials."""
        bom = []
        
        for part in parts:
            part_name = Path(part).stem
            bom.append({
                "part_id": part_name.upper().replace("-", "_"),
                "description": f"CAD part: {part_name}",
                "quantity": 1,
                "source": "manufactured",
                "file": part
            })
        
        # Add fasteners
        bom.append({
            "part_id": "SCR-M3x10",
            "description": "M3x10 Socket Head Cap Screw",
            "quantity": 20,
            "source": "purchased",
            "vendor": "McMaster-Carr"
        })
        
        return bom
    
    def to_robot_commands(self, plan: "AssemblyPlan") -> List[Dict]:
        """Convert plan to NWO Robotics API commands."""
        commands = []
        
        for step in plan.steps:
            if step.action == "pick_and_place":
                commands.append({
                    "command": "pick",
                    "part": step.part,
                    "location": f"kit_{step.part}"
                })
                commands.append({
                    "command": "place",
                    "part": step.part,
                    "target": step.target,
                    "position": [0, 0, 0]
                })
            elif step.fasteners:
                for fastener in step.fasteners:
                    commands.append({
                        "command": "screw",
                        "fastener": fastener,
                        "torque": 2.5
                    })
        
        return commands
    
    def load(self, filepath: str) -> "AssemblyPlan":
        """Load assembly plan from file."""
        with open(filepath, 'r') as f:
            data = json.load(f)
        
        plan = AssemblyPlan()
        plan.steps = [AssemblyStep(**s) for s in data.get("steps", [])]
        plan.bom = data.get("bom", [])
        
        return plan


class AssemblyPlan:
    """Represents an assembly plan."""
    
    def __init__(self):
        self.steps: List[AssemblyStep] = []
        self.bom: List[Dict] = []
    
    def save(self, filepath: str):
        """Save plan to JSON file."""
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        
        data = {
            "steps": [s.to_dict() for s in self.steps],
            "bom": self.bom,
            "total_steps": len(self.steps),
            "total_parts": len(self.bom)
        }
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    def export_instructions(self, filepath: str, format: str = "json"):
        """Export work instructions."""
        if format == "json":
            self.save(filepath)
        elif format == "text":
            with open(filepath, 'w') as f:
                for step in self.steps:
                    f.write(f"{step.step_number}. {step.action.upper()}: {step.part}\n")
                    if step.instructions:
                        f.write(f"   {step.instructions}\n")
                    f.write("\n")


class AssemblyStep:
    """Represents a single assembly step."""
    
    def __init__(self, step_number: int, action: str, part: str,
                 target: Optional[str] = None,
                 fasteners: Optional[List[str]] = None,
                 vision_check: bool = False,
                 instructions: Optional[str] = None):
        self.step_number = step_number
        self.action = action
        self.part = part
        self.target = target
        self.fasteners = fasteners or []
        self.vision_check = vision_check
        self.instructions = instructions
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "step": self.step_number,
            "action": self.action,
            "part": self.part,
            "target": self.target,
            "fasteners": self.fasteners,
            "vision_check": self.vision_check,
            "instructions": self.instructions
        }
