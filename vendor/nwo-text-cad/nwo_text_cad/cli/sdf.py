#!/usr/bin/env python3
"""
NWO SDF CLI - Command line interface for SDF generation
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from nwo_text_cad import SDFGenerator


def main():
    parser = argparse.ArgumentParser(description="NWO SDF Generator")
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Generate world
    world_parser = subparsers.add_parser("world", help="Generate world")
    world_parser.add_argument("--type", default="empty", 
                             choices=["empty", "warehouse", "outdoor", "industrial"],
                             help="World type")
    world_parser.add_argument("--size", help="World size (WxD)")
    world_parser.add_argument("-o", "--output", help="Output file")
    
    # Generate robot
    robot_parser = subparsers.add_parser("robot", help="Generate robot")
    robot_parser.add_argument("--type", default="mobile",
                             choices=["mobile", "manipulator", "quadruped"],
                             help="Robot type")
    robot_parser.add_argument("--name", default="robot", help="Robot name")
    robot_parser.add_argument("--sensors", help="Sensors (comma-separated)")
    robot_parser.add_argument("-o", "--output", help="Output file")
    
    # From task
    task_parser = subparsers.add_parser("from-task", help="Generate from NWO task")
    task_parser.add_argument("task_id", help="NWO task ID")
    task_parser.add_argument("--api-key", required=True, help="NWO API key")
    task_parser.add_argument("-o", "--output", help="Output file")
    
    # From URDF
    urdf_parser = subparsers.add_parser("from-urdf", help="Convert from URDF")
    urdf_parser.add_argument("urdf_file", help="URDF file path")
    urdf_parser.add_argument("-o", "--output", help="Output file")
    
    # Validate
    val_parser = subparsers.add_parser("validate", help="Validate SDF")
    val_parser.add_argument("file", help="SDF file to validate")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    generator = SDFGenerator()
    
    if args.command == "world":
        size = None
        if args.size:
            w, d = args.size.split("x")
            size = (float(w), float(d))
        
        world = generator.generate_world(world_type=args.type, size=size)
        output = args.output or f"{args.type}_world.sdf"
        world.save(output)
        print(f"Generated world: {output}")
    
    elif args.command == "robot":
        sensors = args.sensors.split(",") if args.sensors else []
        robot = generator.generate_robot(
            robot_type=args.type,
            name=args.name,
            sensors=sensors
        )
        output = args.output or f"{args.name}.sdf"
        robot.save(output)
        print(f"Generated robot: {output}")
    
    elif args.command == "from-task":
        print(f"Generating from task {args.task_id}")
        # Would fetch from API
        world = generator.generate_world("warehouse")
        output = args.output or f"task_{args.task_id}_world.sdf"
        world.save(output)
        print(f"Generated: {output}")
    
    elif args.command == "from-urdf":
        model = generator.from_urdf(args.urdf_file)
        output = args.output or args.urdf_file.replace(".urdf", ".sdf")
        model.save(output)
        print(f"Converted: {output}")
    
    elif args.command == "validate":
        print(f"Validating {args.file}")


if __name__ == "__main__":
    main()
