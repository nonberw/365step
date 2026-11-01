#!/usr/bin/env python3
"""
Production Planner - Manufacturing output generation
"""

from typing import List, Dict, Any, Optional
from pathlib import Path
import json


class ProductionPlanner:
    """Plan manufacturing operations."""
    
    def __init__(self):
        self.operations: List[ProductionOperation] = []
    
    def create_production_plan(self, design_id: str,
                              methods: List[str],
                              quantity: int = 1,
                              priority: str = "normal") -> "ProductionPlan":
        """
        Create production plan for a design.
        
        Args:
            design_id: Design identifier
            methods: Manufacturing methods (cnc, 3d_print, etc.)
            quantity: Number of units
            priority: Production priority
            
        Returns:
            ProductionPlan object
        """
        plan = ProductionPlan(design_id=design_id, quantity=quantity)
        
        for method in methods:
            if method == "cnc":
                plan.operations.append(ProductionOperation(
                    type="cnc",
                    description="CNC machining",
                    setup_time=30,  # minutes
                    cycle_time=45,  # minutes per part
                    cost_per_part=25.0
                ))
            elif method == "3d_print":
                plan.operations.append(ProductionOperation(
                    type="3d_print",
                    description="FDM 3D printing",
                    setup_time=10,
                    cycle_time=120,
                    cost_per_part=5.0
                ))
            elif method == "sheet_metal":
                plan.operations.append(ProductionOperation(
                    type="sheet_metal",
                    description="Laser cutting + bending",
                    setup_time=15,
                    cycle_time=20,
                    cost_per_part=15.0
                ))
        
        return plan
    
    def estimate_cost(self, parts: List[str], quantity: int = 1) -> Dict[str, float]:
        """
        Estimate production cost.
        
        Args:
            parts: List of part files
            quantity: Number of units
            
        Returns:
            Cost breakdown
        """
        # Simplified cost model
        material_cost = len(parts) * 10.0 * quantity
        machining_cost = len(parts) * 25.0 * quantity
        assembly_cost = 20.0 * quantity
        
        return {
            "materials": material_cost,
            "machining": machining_cost,
            "assembly": assembly_cost,
            "total": material_cost + machining_cost + assembly_cost,
            "per_unit": (material_cost + machining_cost + assembly_cost) / quantity
        }
    
    def estimate_time(self, plan: "ProductionPlan") -> Dict[str, Any]:
        """
        Estimate production time.
        
        Args:
            plan: Production plan
            
        Returns:
            Time breakdown
        """
        total_setup = sum(op.setup_time for op in plan.operations)
        total_cycle = sum(op.cycle_time for op in plan.operations) * plan.quantity
        
        return {
            "setup_hours": total_setup / 60,
            "cycle_hours": total_cycle / 60,
            "total_hours": (total_setup + total_cycle) / 60,
            "lead_time_days": max(1, int((total_setup + total_cycle) / 60 / 8))
        }
    
    def generate_cnc_program(self, part_file: str, machine: str = "3-axis") -> str:
        """
        Generate CNC G-code.
        
        Args:
            part_file: Part CAD file
            machine: Machine type
            
        Returns:
            G-code string
        """
        gcode = f""; CNC program for {Path(part_file).name}
"
        gcode += "G21 ; Metric units\n"
        gcode += "G90 ; Absolute positioning\n"
        gcode += "G28 ; Home all axes\n"
        gcode += f"; Machine: {machine}\n"
        gcode += "M3 S10000 ; Spindle on\n"
        gcode += "; ... machining operations ...\n"
        gcode += "M5 ; Spindle off\n"
        gcode += "G28 ; Return home\n"
        gcode += "M30 ; Program end\n"
        
        return gcode
    
    def generate_print_settings(self, part_file: str, 
                               material: str = "PETG") -> Dict[str, Any]:
        """
        Generate 3D print settings.
        
        Args:
            part_file: Part STL file
            material: Print material
            
        Returns:
            Slicer settings
        """
        profiles = {
            "PLA": {
                "temperature": 200,
                "bed_temp": 60,
                "speed": 60,
                "layer_height": 0.2,
                "infill": 20
            },
            "PETG": {
                "temperature": 240,
                "bed_temp": 80,
                "speed": 40,
                "layer_height": 0.2,
                "infill": 25
            },
            "ABS": {
                "temperature": 250,
                "bed_temp": 100,
                "speed": 50,
                "layer_height": 0.2,
                "infill": 30
            }
        }
        
        return profiles.get(material, profiles["PLA"])
    
    def create_bom(self, parts: List[str], sourcing: bool = False) -> List[Dict]:
        """
        Create bill of materials.
        
        Args:
            parts: List of part files
            sourcing: Include vendor info
            
        Returns:
            BOM list
        """
        bom = []
        
        for part in parts:
            item = {
                "part_id": Path(part).stem.upper(),
                "description": f"Manufactured part: {Path(part).stem}",
                "quantity": 1,
                "material": "6061-T6 Aluminum",
                "source": "in_house"
            }
            
            if sourcing:
                item["vendor"] = "NWO Manufacturing"
                item["cost"] = 25.0
                item["lead_time"] = "2 days"
            
            bom.append(item)
        
        # Add standard hardware
        bom.append({
            "part_id": "HW-M3-001",
            "description": "M3x10 Socket Head Cap Screw",
            "quantity": 20,
            "material": "A2-70 Stainless",
            "source": "purchased",
            "vendor": "McMaster-Carr" if sourcing else None,
            "cost": 0.05 if sourcing else None
        })
        
        return bom


class ProductionPlan:
    """Represents a production plan."""
    
    def __init__(self, design_id: str, quantity: int = 1):
        self.design_id = design_id
        self.quantity = quantity
        self.operations: List[ProductionOperation] = []
    
    def save(self, filepath: str):
        """Save plan to file."""
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        
        data = {
            "design_id": self.design_id,
            "quantity": self.quantity,
            "operations": [op.to_dict() for op in self.operations]
        }
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    def export_package(self, output_dir: str):
        """Export complete production package."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Save plan
        self.save(output_path / "production_plan.json")
        
        # Create README
        with open(output_path / "README.txt", 'w') as f:
            f.write(f"Production Package for {self.design_id}\n")
            f.write(f"Quantity: {self.quantity}\n")
            f.write(f"Operations: {len(self.operations)}\n")
            f.write("\nOperations:\n")
            for op in self.operations:
                f.write(f"  - {op.type}: {op.description}\n")


class ProductionOperation:
    """Represents a production operation."""
    
    def __init__(self, type: str, description: str,
                 setup_time: float = 0,
                 cycle_time: float = 0,
                 cost_per_part: float = 0):
        self.type = type
        self.description = description
        self.setup_time = setup_time
        self.cycle_time = cycle_time
        self.cost_per_part = cost_per_part
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "type": self.type,
            "description": self.description,
            "setup_time": self.setup_time,
            "cycle_time": self.cycle_time,
            "cost_per_part": self.cost_per_part
        }
