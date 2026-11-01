#!/usr/bin/env python3
"""
NWO CAD CLI - Command line interface for CAD generation
"""

import argparse
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from nwo_text_cad import CADGenerator


def main():
    parser = argparse.ArgumentParser(description="NWO CAD Generator")
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Generate command
    gen_parser = subparsers.add_parser("generate", help="Generate CAD model")
    gen_parser.add_argument("description", help="Natural language description")
    gen_parser.add_argument("-o", "--output", help="Output file path")
    gen_parser.add_argument("--material", default="aluminum", help="Material")
    gen_parser.add_argument("--api-key", help="NWO API key")
    
    # Generate from task
    task_parser = subparsers.add_parser("from-task", help="Generate from NWO task")
    task_parser.add_argument("task_id", help="NWO task ID")
    task_parser.add_argument("--api-key", required=True, help="NWO API key")
    task_parser.add_argument("-o", "--output", help="Output file path")
    
    # Motor mount command
    motor_parser = subparsers.add_parser("motor-mount", help="Generate motor mount")
    motor_parser.add_argument("--type", required=True, help="Motor type (NEMA17, NEMA23)")
    motor_parser.add_argument("--material", default="aluminum", help="Material")
    motor_parser.add_argument("-o", "--output", help="Output file path")
    
    # Gearbox command
    gear_parser = subparsers.add_parser("gearbox", help="Generate gearbox")
    gear_parser.add_argument("--type", required=True, help="Gearbox type")
    gear_parser.add_argument("--ratio", type=float, required=True, help="Gear ratio")
    gear_parser.add_argument("-o", "--output", help="Output file path")
    
    # Export command
    export_parser = subparsers.add_parser("export", help="Export CAD model")
    export_parser.add_argument("input", help="Input Python file")
    export_parser.add_argument("--format", required=True, 
                              choices=["step", "stl", "dxf"], help="Export format")
    export_parser.add_argument("-o", "--output", help="Output file path")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Initialize generator
    generator = CADGenerator(api_key=getattr(args, 'api_key', None))
    
    if args.command == "generate":
        model = generator.generate(args.description, material=args.material)
        output = args.output or "output.step"
        model.export(args.format if hasattr(args, 'format') else "step", output)
        print(f"Generated: {output}")
    
    elif args.command == "from-task":
        model = generator.generate_from_task(args.task_id)
        output = args.output or f"task_{args.task_id}.step"
        model.export_step(output)
        print(f"Generated from task {args.task_id}: {output}")
    
    elif args.command == "motor-mount":
        model = generator.motor_mount(args.type, material=args.material)
        output = args.output or f"{args.type}_mount.step"
        model.export_step(output)
        print(f"Generated motor mount: {output}")
    
    elif args.command == "gearbox":
        model = generator.gearbox(args.type, args.ratio)
        output = args.output or f"gearbox_{args.type}_{args.ratio}.step"
        model.export_step(output)
        print(f"Generated gearbox: {output}")
    
    elif args.command == "export":
        # Would load and export actual CAD
        print(f"Exporting {args.input} to {args.format}")


if __name__ == "__main__":
    main()
