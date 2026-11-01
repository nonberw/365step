#!/usr/bin/env python3
"""
NWO Production CLI - Command line interface for production planning
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from nwo_text_cad.production import ProductionPlanner


def main():
    parser = argparse.ArgumentParser(description="NWO Production Planner")
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Cost command
    cost_parser = subparsers.add_parser("cost", help="Estimate cost")
    cost_parser.add_argument("--parts", required=True, help="Part files")
    cost_parser.add_argument("--quantity", type=int, default=1, help="Quantity")
    
    # CNC command
    cnc_parser = subparsers.add_parser("cnc", help="Generate CNC code")
    cnc_parser.add_argument("--input", required=True, help="Input CAD file")
    cnc_parser.add_argument("--machine", default="3-axis", help="Machine type")
    cnc_parser.add_argument("-o", "--output", help="Output file")
    
    # Print command
    print_parser = subparsers.add_parser("print", help="Generate print settings")
    print_parser.add_argument("--input", required=True, help="Input STL file")
    print_parser.add_argument("--material", default="PLA", help="Material")
    
    # Package command
    pkg_parser = subparsers.add_parser("package", help="Create production package")
    pkg_parser.add_argument("--project", required=True, help="Project name")
    pkg_parser.add_argument("--methods", default="cnc,3d_print", help="Methods")
    pkg_parser.add_argument("--quantity", type=int, default=1, help="Quantity")
    pkg_parser.add_argument("-o", "--output", help="Output directory")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    planner = ProductionPlanner()
    
    if args.command == "cost":
        import glob
        parts = glob.glob(args.parts)
        costs = planner.estimate_cost(parts, quantity=args.quantity)
        print(f"Cost estimate for {args.quantity} units:")
        print(f"  Materials: ${costs['materials']:.2f}")
        print(f"  Machining: ${costs['machining']:.2f}")
        print(f"  Assembly: ${costs['assembly']:.2f}")
        print(f"  Total: ${costs['total']:.2f}")
        print(f"  Per unit: ${costs['per_unit']:.2f}")
    
    elif args.command == "cnc":
        gcode = planner.generate_cnc_program(args.input, machine=args.machine)
        output = args.output or args.input.replace(".step", ".nc")
        with open(output, 'w') as f:
            f.write(gcode)
        print(f"Generated CNC code: {output}")
    
    elif args.command == "print":
        settings = planner.generate_print_settings(args.input, material=args.material)
        print(f"Print settings for {args.material}:")
        for key, value in settings.items():
            print(f"  {key}: {value}")
    
    elif args.command == "package":
        methods = args.methods.split(",")
        plan = planner.create_production_plan(
            design_id=args.project,
            methods=methods,
            quantity=args.quantity
        )
        output = args.output or f"{args.project}_production"
        plan.export_package(output)
        print(f"Created production package: {output}")


if __name__ == "__main__":
    main()
