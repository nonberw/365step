# Gear Design Reference

## Gear Types

### Spur Gears
- **Teeth**: Straight, parallel to axis
- **Ratio**: N_teeth_driver / N_teeth_driven
- **Module**: m = pitch_diameter / N_teeth (mm)
- **Pressure angle**: 20° standard

### Planetary Gears
- **Stages**: 1-4 typical
- **Ratio per stage**: 3:1 to 12:1
- **Efficiency**: 97-99% per stage
- **Backlash**: Lower than spur gears

### Harmonic Drive
- **Ratio**: 30:1 to 320:1
- **Efficiency**: 70-90%
- **Zero backlash**: High precision
- **Compact**: High torque density

## Materials

| Material | Strength | Wear | Cost |
|----------|----------|------|------|
| Steel | High | Good | Medium |
| Brass | Medium | Good | Low |
| Nylon | Low | Fair | Low |
| POM (Delrin) | Medium | Good | Low |

## Design Rules

- **Minimum teeth**: 12 (spur), 8 (planetary planet)
- **Face width**: 8-12x module
- **Clearance**: 0.25 x module
- **Backlash**: 0.05-0.1mm for precision

## Lubrication

- **Grease**: NLGI #1 or #2
- **Oil**: ISO VG 68-220
- **Maintenance**: Every 1000 hours or annually
