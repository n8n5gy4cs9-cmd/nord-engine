// Automies — car "cosmetics" (the equivalent of Driver 2's CAR_COSMETICS): power, grip, yaw inertia, dimensions. Edit freely; `hnd` indexes HANDLING in car.js.
//   powerRatio  engine thrust (D2 cars use ~3000-4000)      traction  tyre grip scale (4096 = normal)      twistY  how quickly the car rotates (yaw inertia⁻¹)
//   model       the .glb in assets/models/ (wheel nodes are named wheel-fl / wheel-fr / wheel-bl / wheel-br; steered + spun by the game)   scale  model scale
export const CARS = {
  muscle: { name: 'MUSTANG-ISH', model: 'muscle', scale: 1, powerRatio: 3350, traction: 4096, twistY: 52, hnd: 0, length: 4.7, width: 1.9, wheelbase: 2.85, track: 1.62, mass: 1.15, color: '#d8402c' },
  coupe: { name: 'SPORT COUPE', model: 'coupe', scale: 1, powerRatio: 3300, traction: 4096, twistY: 60, hnd: 2, length: 4.3, width: 1.85, wheelbase: 2.6, track: 1.58, mass: 0.95, color: '#3a7fd8' },
  cop: { name: 'POLICE CRUISER', model: 'cop', scale: 1, powerRatio: 3450, traction: 4096, twistY: 62, hnd: 3, length: 4.8, width: 1.95, wheelbase: 2.9, track: 1.66, mass: 1.2, color: '#222831' },
  taxi: { name: 'CITY CAB', model: 'taxi', scale: 1, powerRatio: 2750, traction: 4096, twistY: 58, hnd: 1, length: 4.6, width: 1.85, wheelbase: 2.8, track: 1.6, mass: 1.0, color: '#f0c020' },
  van: { name: 'DELIVERY VAN', model: 'van', scale: 1, powerRatio: 2500, traction: 4096, twistY: 50, hnd: 1, length: 5.0, width: 2.0, wheelbase: 3.2, track: 1.7, mass: 1.5, color: '#e8e8e8' },
  truckR: { name: 'PICKUP', model: 'kenney:truck-red', scale: 1.5, powerRatio: 2800, traction: 4096, twistY: 54, hnd: 1, length: 4.4, width: 2.2, wheelbase: 2.7, track: 1.6, mass: 1.3, color: '#c0392b' },
  truckG: { name: 'FARM TRUCK', model: 'kenney:truck-green', scale: 1.5, powerRatio: 2700, traction: 4096, twistY: 54, hnd: 1, length: 4.4, width: 2.2, wheelbase: 2.7, track: 1.6, mass: 1.3, color: '#4a9a50' },
  truckP: { name: 'CAMPER', model: 'kenney:truck-purple', scale: 1.5, powerRatio: 2700, traction: 4096, twistY: 54, hnd: 1, length: 4.4, width: 2.2, wheelbase: 2.7, track: 1.6, mass: 1.3, color: '#7a4aa0' },
};
export const CIVILIAN = ['taxi', 'van', 'truckR', 'truckG', 'truckP', 'muscle'];
