#!/usr/bin/env python3
"""
NWO URDF CLI - Command line interface for URDF generation
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from nwo_text_cad import URDFGenerator


def main():
    parser = argparse.ArgumentParser(description="NWO URDF Generator")
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Generate command
    gen_parser = subparsers.add_parser("generate", help="Generate URDF")
    gen_parser.add_argument("description", help="Robot description")
    gen_parser.add_argument("-o", "--output", help="Output file path")
    gen_parser.add_argument("--api-key", help="NWO API key")
    
    # From task
    task_parser = subparsers.add_parser("from-task", help="Generate from NWO task")
    task_parser.add_argument("task_id", help="NWO task ID")
    task_parser.add_argument("--api-key", required=True, help="NWO API key")
    task_parser.add_argument("-o", "--output", help="Output file path")
    
    # Manipulator
    manip_parser = subparsers.add_parser("manipulator", help="Generate manipulator")
    manip_parser.add_argument("--dof", type=int, default=6, help="Degrees of freedom")
    manip_parser.add_argument("--reach", type=float, default=1.0, help="Reach in meters")
    manip_parser.add_argument("--payload", type=float, default=5.0, help="Payload in kg")
    manip_parser.add_argument("-o", "--output", help="Output file path")
    
    # Mobile robot
    mobile_parser = subparsers.add_parser("mobile", help="Generate mobile robot")
    mobile_parser.add_argument("--type", default="diff-drive", 
                              choices=["diff-drive", "mecanum", "ackermann"],
                              help="Drive type")
    mobile_parser.add_argument("--wheel-dia", type=float, default=0.1, 
                              help="Wheel diameter in meters")
    mobile_parser.add_argument("-o", "--output", help="Output file path")
    
    # Validate
    val_parser = subparsers.add_parser("validate", help="Validate URDF")
    val_parser.add_argument("file", help="URDF file to validate")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    generator = URDFGenerator(api_key=getattr(args, 'api_key', None))
    
    if args.command == "generate":
        robot = generator.generate(args.description)
        output = args.output or "robot.urdf"
        robot.save(output)
        print(f"Generated URDF: {output}")
    
    elif args.command == "from-task":
        # Would fetch task from API
        print(f"Generating from task {args.task_id}")
        robot = generator.generate_manipulator()  # Placeholder
        output = args.output or f"task_{args.task_id}_robot.urdf"
        robot.save(output)
        print(f"Generated: {output}")
    
    elif args.command == "manipulator":
        robot = generator.generate_manipulator(
            dof=args.dof,
            reach=args.reach,
            payload=args.payload
        )
        output = args.output or f"manipulator_{args.dof}dof.urdf"
        robot.save(output)
        print(f"Generated manipulator: {output}")
    
    elif args.command == "mobile":
        robot = generator.generate_mobile(
            drive_type=args.type,
            wheel_dia=args.wheel_dia
        )
        output = args.output or f"mobile_{args.type}.urdf"
        robot.save(output)
        print(f"Generated mobile robot: {output}")
    
    elif args.command == "validate":
        # Would load and validate
        print(f"Validating {args.file}")


if __name__ == "__main__":
    main()
