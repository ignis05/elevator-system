export interface ElevatorSystem {
	/**
	 * Orders pickup from a specific floor with intention to go into specified direction.
	 * The system automatically assigns an elevator to complete the pickup.
	 * The system prioritises using idle elevators for pickups over ones already moving with people to utilise as much of its elevators as possible,
	 * and avoid having large groups of people in a single elevator.
	 * @param floor the floor to pick up from
	 * @param direction the intended direction
	 */
	pickup: (floor: number, direction: Direction) => void
	/**
	 * Selects a floor for a specified elevator, just like pressing a button on its inside panel would.
	 * This elevator will then have to arrive and stop at the choosen floor, though it might not go there directly if other floors were already selected.
	 * @param elevatorID the id of chosen elevator
	 * @param floor the chosen floor
	 */
	selectFloor: (elevatorID: number, floor: number) => void
	/**
	 * Executes one step of this system's work.
	 * Elevators can move one floor up or down during a single step.
	 * Elevators also stop for a whole step's duration at designated floors when letting people in or out.
	 */
	step: () => void
	/**
	 * Array which holds all elevators controlled by the system. Each elevator has its id, current floor, destination and various other parameters.
	 * The state of each elevator can also be manually modified by its reference from this array.
	 */
	readonly elevators: Elevator[]
}

type Direction = 'up' | 'down'

interface PickupTask {
	floor: number
	direction: Direction
}

class Elevator {
	readonly id: number
	currentFloor: number
	moveDirection: Direction | null = null
	// idle elevator has nothing to do, stopped elevator is stopped at a floor for a moment to let people in/out
	status: 'idle' | 'moving' | 'stopped' = 'idle'
	// floors this elevator has to visit, based on its buttons pressed on-board
	readonly destinations = new Set<number>()
	// if the elevator is moving to pick people up at a specific floor
	currentPickupTask: PickupTask | null = null

	constructor(id: number, currentFloor: number = 0) {
		this.id = id
		this.currentFloor = currentFloor
	}

	get isIdle() {
		return this.status === 'idle'
	}

	get hasDestinations() {
		return this.destinations.size > 0
	}

	get currentDestination() {
		if (this.currentPickupTask) return this.currentPickupTask.floor

		if (this.moveDirection == 'up') return Math.max(...this.destinations)
		if (this.moveDirection == 'down') return Math.min(...this.destinations)
		return this.currentFloor
	}

	moveFloor() {
		// elevator idling
		if (this.status === 'idle') return

		// elevator stopped to let people in or out - clear stopped status this update and move normally on the next
		if (this.status === 'stopped') {
			// no destinations left - set elevator to idle
			if (!this.hasDestinations) {
				this.status = 'idle'
				this.moveDirection = null
				return
			}

			this.status = 'moving'

			// flip move directions if no more stops are in the same direction
			if (this.moveDirection === 'up' && this.currentDestination < this.currentFloor) return (this.moveDirection = 'down')
			if (this.moveDirection === 'down' && this.currentDestination > this.currentFloor) return (this.moveDirection = 'up')
			// decide move direction if it wasn't assigned before
			if (!this.moveDirection) {
				if (this.currentDestination > this.currentFloor) this.moveDirection = 'up'
				else this.moveDirection = 'down'
			}

			return
		}

		// move elevator based on destination, not direction.
		// that way "pickup" tasks can be set without direction, so stumbling upon any other pickup task will immediately override it
		this.currentFloor += this.currentDestination > this.currentFloor ? 1 : -1

		// check if it reached a destination, remove it and stop elevator if yes
		if (this.destinations.delete(this.currentFloor)) this.status = 'stopped'
	}

	canClearPickupTask(task: PickupTask) {
		return task.floor == this.currentFloor && (task.direction == this.moveDirection || this.moveDirection === null)
	}
}

export class ElevatorManager implements ElevatorSystem {
	readonly elevatorCount: number
	readonly elevators: Elevator[] = []
	pickupTasks: PickupTask[] = []

	constructor(elevatorCount: number) {
		this.elevatorCount = elevatorCount

		for (let i = 0; i < elevatorCount; i++) {
			this.elevators.push(new Elevator(i))
		}
	}

	pickup(floor: number, direction: Direction) {
		if (!this.pickupTasks.find((p) => p.floor == floor && p.direction == direction)) {
			this.pickupTasks.push({ floor, direction })
		}
	}

	selectFloor(elevatorID: number, floor: number) {
		const elevator = this.elevators.find((e) => e.id === elevatorID)
		if (!elevator) throw 'invalid elevator id'

		elevator.destinations.add(floor)
	}

	get activeElevators() {
		return this.elevators.filter((e) => !e.isIdle)
	}

	get idleElevators() {
		return this.elevators.filter((e) => e.isIdle)
	}

	step() {
		// move active elevators
		for (let elevator of this.activeElevators) {
			elevator.moveFloor()

			// check if any pickup can be completed at current position
			const taskToClearI = this.pickupTasks.findIndex(elevator.canClearPickupTask)
			if (taskToClearI > -1) {
				const task = this.pickupTasks.splice(taskToClearI, 1)[0]

				// check if this was original task the elevator was going for - if not, return it to the pool
				if (
					elevator.currentPickupTask &&
					(task.floor != elevator.currentPickupTask.floor || task.direction != elevator.currentPickupTask.direction)
				) {
					this.pickupTasks.push(elevator.currentPickupTask)
				}

				elevator.status = 'stopped'
				elevator.currentPickupTask = null
			}
		}

		// assign any available pickups to idle elevators
		for (let pickup of this.pickupTasks) {
			const closestIdleElevator = this.idleElevators.reduce((prev, curr) =>
				Math.abs(curr.currentFloor - pickup.floor) < Math.abs(prev.currentFloor - pickup.floor) ? curr : prev
			)
			this.pickupTasks.splice(this.pickupTasks.indexOf(pickup), 1)
			closestIdleElevator.currentPickupTask = pickup
			closestIdleElevator.status = 'moving'
			closestIdleElevator.moveDirection = null
		}
	}
}
