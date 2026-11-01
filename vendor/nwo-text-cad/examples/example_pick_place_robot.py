#!/usr/bin/env python3
"""
Example: Design pick-and-place robot from NWO task
"""

import os
from nwo_text_cad import CADGenerator, URDFGenerator, AssemblyPlanner, ProductionPlanner
from nwo_robotics import RobotAPI


def main():
    # Configuration
    API_KEY = os.getenv("NWO_API_KEY", "demo_key")
    TASK_ID = "task_pick_place_001"
    
    print("=" * 60)
    print("NWO Text-to-CAD: Pick-and-Place Robot Design")
    print("=" * 60)
    
    # Initialize
    print("\n1. Initializing generators...")
    api = RobotAPI(api_key=API_KEY)
    cad = CADGenerator(api_key=API_KEY)
    urdf = URDFGenerator(api_key=API_KEY)
    
    # Get task from NWO API
    print(f"\n2. Fetching task {TASK_ID}...")
    task = api.get_task(TASK_ID)
    print(f"   Task: {task.description}")
    print(f"   Payload: {task.payload}kg")
    print(f"   Reach required: {task.reach}m")
    
    # Generate robot URDF
    print("\n3. Generating robot URDF...")
    robot = urdf.generate_manipulator(
        dof=6,
        reach=task.reach,
        payload=task.payload
    )
    robot.save("output/robot.urdf")
    print("   Saved: output/robot.urdf")
    
    # Validate URDF
    errors = robot.validate()
    if errors:
        print(f"   Validation errors: {errors}")
    else:
        print("   ✓ URDF valid")
    
    # Generate custom gripper
    print("\n4. Generating custom gripper...")
    gripper = cad.generate(
        f"Parallel jaw gripper for {task.payload}kg payload, "
        f"80mm opening, force feedback, M6 mounting"
    )
    gripper.export_step("output/gripper.step")
    gripper.export_stl("output/gripper.stl")
    print("   Saved: output/gripper.step")
    print("   Saved: output/gripper.stl")
    
    # Generate motor mounts
    print("\n5. Generating motor mounts...")
    for i, joint in enumerate(["base", "shoulder", "elbow", "wrist"]):
        mount = cad.motor_mount(
            motor_type="NEMA23" if i < 2 else "NEMA17",
            material="6061-T6"
        )
        mount.export_step(f"output/mount_{joint}.step")
        print(f"   Saved: output/mount_{joint}.step")
    
    # Plan assembly
    print("\n6. Planning assembly...")
    planner = AssemblyPlanner()
    parts = [
        "output/robot.urdf",
        "output/gripper.step",
        "output/mount_base.step",
        "output/mount_shoulder.step",
        "output/mount_elbow.step",
        "output/mount_wrist.step",
    ]
    
    assembly = planner.generate(
        parts=parts,
        mode="robot",
        constraints={"max_part_weight": 5}
    )
    assembly.save("output/assembly_plan.json")
    print("   Saved: output/assembly_plan.json")
    print(f"   Total steps: {len(assembly.steps)}")
    
    # Generate production plan
    print("\n7. Creating production plan...")
    prod = ProductionPlanner()
    production_plan = prod.create_production_plan(
        design_id="pick_place_robot_v1",
        methods=["cnc", "3d_print"],
        quantity=1,
        priority="high"
    )
    
    # Estimate costs
    costs = prod.estimate_cost(parts, quantity=1)
    print(f"   Estimated cost: ${costs['total']:.2f}")
    print(f"   - Materials: ${costs['materials']:.2f}")
    print(f"   - Machining: ${costs['machining']:.2f}")
    print(f"   - Assembly: ${costs['assembly']:.2f}")
    
    # Export production package
    production_plan.export_package("output/production/")
    print("   Exported: output/production/")
    
    # Summary
    print("\n" + "=" * 60)
    print("Design complete! Files generated:")
    print("  - Robot URDF: output/robot.urdf")
    print("  - Gripper CAD: output/gripper.step, .stl")
    print("  - Motor mounts: output/mount_*.step")
    print("  - Assembly plan: output/assembly_plan.json")
    print("  - Production package: output/production/")
    print("=" * 60)


if __name__ == "__main__":
    # Create output directory
    os.makedirs("output", exist_ok=True)
    
    # Run example
    try:
        main()
    except Exception as e:
        print(f"\nError: {e}")
        print("\nNote: This example requires NWO Robotics API access.")
        print("Set NWO_API_KEY environment variable to run.")
