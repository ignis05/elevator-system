import ElevatorManager, { Elevator } from './ElevatorManager'

describe('ElevatorManager', () => {
	const doStepsUntilNextStop = (system: ElevatorManager, elevator: Elevator) => {
		do system.step()
		while (elevator.status !== 'stopped')
	}

	it('starts with all elevators idle at floor 0', () => {
		const system = new ElevatorManager(5)
		system.elevators.forEach((elevator) => {
			expect(elevator.currentFloor).toEqual(0)
			expect(elevator.status).toEqual('idle')
		})
	})

	it('sends an elevator to requested floor', () => {
		const system = new ElevatorManager(1)
		const elevator = system.elevators[0]

		expect(elevator.currentFloor).toEqual(0)

		system.pickup(5, 'down')
		while (system.getAllTasks().length > 0) system.step()

		expect(elevator.currentFloor).toEqual(5)
	})

	it('moves one floor per step', () => {
		const system = new ElevatorManager(1)
		const elevator = system.elevators[0]

		expect(elevator.currentFloor).toEqual(0)

		system.pickup(5, 'down')

		for (let i = 0; i <= 5; i++) {
			system.step()
			expect(elevator.currentFloor).toEqual(i)
		}
	})

	it("updates elevator's status and destination as it moves, goes idle when having no task", () => {
		const system = new ElevatorManager(1)
		const elevator = system.elevators[0]

		expect(elevator.status).toEqual('idle')
		expect(elevator.currentDestination).toEqual(elevator.currentFloor)

		system.pickup(5, 'down')
		expect(elevator.status).toEqual('idle')
		expect(elevator.currentDestination).toEqual(elevator.currentFloor)

		system.step()
		expect(elevator.status).toEqual('moving')
		expect(elevator.currentDestination).toEqual(5)

		for (let i = 1; i < 5; i++) {
			system.step()
			expect(elevator.status).toEqual('moving')
		}

		system.step()
		expect(elevator.status).toEqual('stopped')
		expect(elevator.currentDestination).toEqual(5)

		system.step()
		expect(elevator.status).toEqual('idle')
	})

	it('prioritizes going in direction declared when called', () => {
		const system = new ElevatorManager(1)
		const elevator = system.elevators[0]

		system.pickup(5, 'down') // pickup declared to go "down"

		while (elevator.status !== 'stopped') system.step()
		expect(elevator.currentFloor).toEqual(5)

		// receives 3 destinations from people picked up, 2 of them are actually "up"
		system.selectFloor(elevator.id, 6)
		system.selectFloor(elevator.id, -3)
		system.selectFloor(elevator.id, 20)

		system.step()
		expect(elevator.currentDestination).toEqual(-3) // goes for the destination matching declared direction
	})

	it('completes all drop-offs before idling', () => {
		const system = new ElevatorManager(1)
		const elevator = system.elevators[0]

		system.pickup(5, 'up')

		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toEqual(5)

		system.selectFloor(elevator.id, 4)
		system.selectFloor(elevator.id, 10)
		system.selectFloor(elevator.id, -6)

		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toEqual(10)

		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toEqual(4)

		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toEqual(-6)

		system.step()
		expect(elevator.status).toEqual('idle')
	})

	it('completes all drop-offs added on its way', () => {
		const system = new ElevatorManager(1)
		const elevator = system.elevators[0]

		system.selectFloor(elevator.id, 5)
		system.step()
		system.selectFloor(elevator.id, 4)
		system.selectFloor(elevator.id, 3)

		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toEqual(3)
	})

	it('completes all drop-offs before going for another pick-up', () => {
		const system = new ElevatorManager(1)
		const elevator = system.elevators[0]

		system.pickup(2, 'down')
		system.step()
		system.pickup(3, 'up') // receives pickup on 3 while already going for pickup on 2

		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toEqual(2)

		// receives dropoffs on 0 and -1
		system.selectFloor(elevator.id, 0)
		system.selectFloor(elevator.id, -1)

		// completes both drop-offs
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toEqual(0)
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toEqual(-1)

		// back to floor 3 for another pickup
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toEqual(3)
	})

	it('completes all pickups with matching direction on its way', () => {
		const system = new ElevatorManager(1)
		const elevator = system.elevators[0]

		system.pickup(6, 'up') // goes for pickup on 6
		system.step()
		system.pickup(2, 'up') // pickup in matching direction gets added on 2
		system.pickup(3, 'down') // pickup in opposite direction gets added on 3
		system.pickup(4, 'up') // pickup in matching direction gets added on 4
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(2) // elevator stops at floor 2 for the pickup
		system.selectFloor(elevator.id, -1) // people from 2 input "-1", despite their declaration to go up
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(4) // elevator passes through pickup on "3" and ignores dropoff on "-1", as they are in direction opposite than declared.
		system.selectFloor(elevator.id, 5) // people from 4 input "5"
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(5) // elevator drops people off at 5
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(6) // elevator arrives at 6
		system.selectFloor(elevator.id, 20) // people from 6 input "20"
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(20) // despite -1 being closer to 6, elevator goes for floor 20, as it matches declared direction
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(3) // this time elevator stops for pickup at 3, as it has matching travel direction
		system.selectFloor(elevator.id, 0) // people from 3 input "0"
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(0) // elevator drops people off at 0
		system.selectFloor(elevator.id, 5) // floor 5 gets selected, maybe someone entered at floor 0 as people were leaving
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(-1) // elevator continues down, to finally drop off people from 2 at -1
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(5) // elevator goes back up to 5 to complete last drop off
	})

	it('skips pickups based on actual direction and not just declared direction', () => {
		const system = new ElevatorManager(1)
		const elevator = system.elevators[0]

		system.pickup(6, 'down') // goes for "down" pickup on 6
		system.step()
		// more pickups are requested
		system.pickup(4, 'down') // can't complete this "down" pickup, as it's actually going up at the moment
		system.pickup(5, 'up') // can't complete this "up" pickup, as it will go down after arriving at 6

		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(6) // elevator skips both pickups and arrives directly at 6
		system.selectFloor(elevator.id, 0) // floor 0 gets selected
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(4) // elevator skips 5 again, but this time it can pick up 4 on its way
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(0) // elevator arrives at 0. No extra buttons were pressed, people from 4 probably wanted to go to 0 too.
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(5) // finally, elevator goes to the pickup on 5
	})

	it('completes all "up" pickups when going to top floor, and all "down" when going to bottom floor', () => {
		const system = new ElevatorManager(1)
		system.setFloorLimits({ bottom: -1, top: 10 })
		const elevator = system.elevators[0]

		system.pickup(10, 'down') // gets requested at top floor to go down
		system.step()
		system.pickup(5, 'up') // another request to go up from floor 5 gets added

		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(5) // elevator completes pickup at floor 5, despite the declared direction being opposite
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(10) // elevator arrives at 10

		system.pickup(-1, 'up') // now there's request to go up from bottom floor
		system.step()
		system.pickup(5, 'down') // another request to go down from floor 5 gets added

		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(5) // elevator completes pickup at floor 5, despite the declared direction being opposite
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toBe(-1) // elevator arrives at -1
	})

	it('completes all pickups on its way is "sole elevator" mode', () => {
		const system = new ElevatorManager(1)
		const elevator = system.elevators[0]

		system.setSoleElevatorMode(true)

		system.pickup(1, 'up')
		system.step()
		// receives a bunch of extra pickups
		system.pickup(2, 'down')
		system.pickup(2, 'up')
		system.pickup(4, 'up')
		system.step()

		// people picked up from 1 select floor 5
		system.selectFloor(elevator.id, 5)

		// picks up all pickups on it's way to 5
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toEqual(2)
		system.step()
		system.selectFloor(elevator.id, 1) // ignores new destination in opposite direction, even if it's closer, keeps going to original one
		doStepsUntilNextStop(system, elevator)
		expect(elevator.currentFloor).toEqual(4)
	})

	it('handles multiple pickups with multiple elevators', () => {
		const system = new ElevatorManager(2)
		const [elevator1, elevator2] = system.elevators

		// system receives 2 pickups from 1 and -1
		system.pickup(1, 'up')
		system.pickup(-1, 'down')
		system.step()

		// system assigns one pickup for each elevator
		// (for the same positions, it assigns in order of an array, so it's predictable which elevator will get assigned which task)
		expect(elevator1.currentDestination).toEqual(1)
		expect(elevator2.currentDestination).toEqual(-1)
	})

	it('handles multiple pickups from the same floor with multiple elevators', () => {
		const system = new ElevatorManager(2)
		const [elevator1, elevator2] = system.elevators

		// system receives 2 pickups "up" and "down" from the same floor
		system.pickup(1, 'up')
		system.pickup(1, 'down')
		system.step()

		// system assigns one pickup for each
		expect(elevator1.currentDestination).toEqual(1)
		expect(elevator1.currentPickupTask?.direction).toEqual('up')
		expect(elevator2.currentDestination).toEqual(1)
		expect(elevator2.currentPickupTask?.direction).toEqual('down')
	})

	it('uses the closest elevator for a pickup', () => {
		const system = new ElevatorManager(2)
		const [elevator1, elevator2] = system.elevators

		// send elevator2 to floor 4 and wait for it to idle
		system.selectFloor(elevator2.id, 4)
		doStepsUntilNextStop(system, elevator2)
		system.step()

		system.pickup(3, 'up')
		system.step()

		// task got assigned to elevator2 because it was closer
		expect(elevator1.status).toEqual('idle')
		expect(elevator2.status).toEqual('moving')
	})

	it('elevators skip past pickups that other elevators are going for', () => {
		const system = new ElevatorManager(3)
		const [elevator1, elevator2, elevator3] = system.elevators

		system.pickup(3, 'up')
		system.pickup(2, 'up')
		system.pickup(1, 'up')

		system.step()

		expect(elevator1.currentDestination).toEqual(3)
		expect(elevator2.currentDestination).toEqual(2)
		expect(elevator3.currentDestination).toEqual(1)

		system.step()

		expect(elevator1.status).toEqual('moving') // even though elevator1 is the first one in update order, it didn't clear the pickup from floor one and goes directly to 3
		expect(elevator2.status).toEqual('moving')
		expect(elevator3.status).toEqual('stopped')

		system.step()

		expect(elevator1.status).toEqual('moving') // same thing when passing through floor 2
		expect(elevator2.status).toEqual('stopped')
		expect(elevator3.status).toEqual('idle')

		system.step()

		expect(elevator1.status).toEqual('stopped')
		expect(elevator2.status).toEqual('idle')
		expect(elevator3.status).toEqual('idle')
	})
})
