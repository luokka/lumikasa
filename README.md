# Lumikasa game project

https://luokka.github.io/lumikasa/

A game where you play as a snowball that shoots snowballs. Game engine developed by me.

Stages can be added by dropping image files into the game when stage select window is open
- Opaque pixels are interpreted as collision data
- Fully transparent pixels are interpreted as non-collision data

## Known issues:
- Gamepads might not get reassigned to correct players if multiple identical gamepads are connected
- Adventure mode levels can crash the game on lower-end devices (very large level images)
- Logo drawing does not work on Firefox-android for some reason?
- Adding a large image into stage select can crash the game
- Game audio can break randomly?
- Frame counter inaccurate?

## Incompatible gamepads:
- Microsoft SideWinder Freestyle Pro (incompatible axes)
- Nintendo Switch Pro Controller (incompatible axes)
