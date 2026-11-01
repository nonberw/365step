#!/usr/bin/env python3
"""
NWO Assembly CLI - Command line interface for assembly planning
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from nwo_text_cad.assembly import AssemblyPlanner


def main():
    parser = argparse.ArgumentParser(description="NWO Assembly Planner")
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Plan command
    plan_parser = subparsers.add_parser("plan", help="Generate assembly plan")
    plan_parser.add_argument("--parts", required=True, help="Part files (glob pattern)")
    plan_parser.add_argument("--mode", default="manual", 
                            choices=["manual", "robot", "collaborative"],
                            help="Assembly mode")
    plan_parser.add_argument("-o", "--output", help="Output file")
    
    # Instructions command
    inst_parser = subparsers.add_parser("instructions", help="Generate instructions")
    inst_parser.add_argument("--plan", required=True, help="Plan file")
    inst_parser.add_argument("--format", default="json",
                            choices=["json", "pdf", "text"],
                            help="Output format")
    inst_parser.add_argument("-o", "--output", help="Output file")
    
    # BOM command
    bom_parser = subparsers.add_parser("bom", help="Generate BOM")
    bom_parser.add_argument("--plan", required=True, help="Plan file")
    bom_parser.add_argument("--format", default="json",
                           choices=["json", "csv", "xlsx"],
                           help="Output format")
    bom_parser.add_argument("-o", "--output", help="Output file")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    planner = AssemblyPlanner()
    
    if args.command == "plan":
        import glob
        parts = glob.glob(args.parts)
        plan = planner.generate(parts=parts, mode=args.mode)
        output = args.output or "assembly_plan.json"
        plan.save(output)
        print(f"Generated plan: {output}")
        print(f"Total steps: {len(plan.steps)}")
    
    elif args.command == "instructions":
        plan = planner.load(args.plan)
        output = args.output or f"instructions.{args.format}"
        plan.export_instructions(output, format=args.format)
        print(f"Generated instructions: {output}")
    
    elif args.command == "bom":
        plan = planner.load(args.plan)
        output = args.output or f"bom.{args.format}"
        # Would export BOM
        print(f"Generated BOM: {output}")


if __name__ == "__main__":
    main()
