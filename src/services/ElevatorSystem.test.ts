import ElevatorManager from './ElevatorManager'
import { ElevatorSystem } from './ElevatorSystem'

// a few very generic non-implementation specific tests on the interface
describe('ElevatorSystem implementation', () => {
	/**
	 * Wait until all elevators in the system are idle for 3 steps in row
	 * @returns the amount of steps it took until everything became idle
	 * */
	const stepUntilAllIdle = (system: ElevatorSystem): number => {
		let stepCount = 0
		let idleInRow = 0
		while (true) {
			if (system.status().every((el) => el.status === 'idle')) idleInRow++
			else idleInRow = 0
			if (idleInRow > 2) break
			system.step()
			stepCount++
		}
		return stepCount - 2
	}

	it('allows setting elevator position', () => {
		const system: ElevatorSystem = new ElevatorManager(16)

		// position each elevator on floor matching its id
		system.status().forEach((e) => {
			system.setElevator(e.id, e.id)
		})

		system.status().forEach((e) => {
			expect(e.id).toEqual(e.floor)
		})
	})

	it('completes all pickups and dropoffs', () => {
		const system: ElevatorSystem = new ElevatorManager(5, { top: 10, bottom: -5 })

		system.selectFloor(1, 7)
		system.selectFloor(1, 8)
		system.selectFloor(2, 1)
		system.selectFloor(2, -5)
		system.pickup(10, 'down')
		system.pickup(9, 'down')
		system.pickup(8, 'down')

		stepUntilAllIdle(system)

		expect(system.tasks().length).toEqual(0)
		system.status().forEach((el) => expect(el.destination).toEqual(el.floor))
	})

	it('is faster than FCFS', () => {
		const system: ElevatorSystem = new ElevatorManager(1, { top: 10, bottom: 0 })

		system.pickup(10, 'down')
		system.step()
		system.pickup(4, 'up')
		system.step()
		system.pickup(3, 'up')
		system.step()
		system.pickup(5, 'up')
		system.step()

		// 4 steps executed above
		const totalSteps = 4 + stepUntilAllIdle(system)

		// it would take 24 steps to stop at each of those floors in FCFS order
		expect(totalSteps).toBeLessThan(24)
	})

	it('respects declared direction after pickup', () => {
		const system: ElevatorSystem = new ElevatorManager(1, { top: 15, bottom: 0 })

		system.pickup(5, 'up')

		do system.step()
		while (system.status()[0].status !== 'stopped')

		system.selectFloor(0, 4)
		system.selectFloor(0, 15)

		system.step()

		expect(system.status()[0].destination).toEqual(15) // elevator chose destination matching declared direction, instead of the closest
	})
})
