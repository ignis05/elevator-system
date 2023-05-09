export interface ElevatorSystem {
	/**
	 * Orders pickup from a specific floor with intention to go into specified direction.
	 * The system automatically assigns an elevator to complete the pickup.
	 * The system prioritises using idle elevators for pickups over ones already moving with people to utilise as much of its elevators as possible,
	 * and avoid having large groups of people in a single elevator.
	 * Elevators will ignore all other pickup orders when having one assigned to them (avoids issue where no elevator would arrive at top floor, when they keep getting intercepted on lower floors)
	 * Elevators dropping people off will pick up any pickup orders that declared the same direction as the elevator is currently moving in
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

	/**
	 * Returns all pickup requests queued in the system.
	 * This only includes the external requests for any elevator, the destinations queued directly for a specific elevator (from inside) are in the "Elevator" object itself
	 */
	getAllTasks(): PickupTask[]
}

export type Direction = 'up' | 'down'

export interface PickupTask {
	floor: number
	direction: Direction
}

export class Elevator {
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

	// returns next destination based on priority: pickup order > farthest stop in current direction > any stop > current floor
	get currentDestination() {
		if (this.currentPickupTask) return this.currentPickupTask.floor

		if (this.moveDirection === 'up') return Math.max(...this.destinations)
		if (this.moveDirection === 'down') return Math.min(...this.destinations)
		if (this.destinations.size > 0) return this.destinations.values().next().value
		return this.currentFloor
	}

	private updateMoveDirection() {
		if (this.currentDestination === this.currentFloor) throw new Error('attempted to update move direction without any destinations')
		if (this.currentDestination > this.currentFloor) this.moveDirection = 'up'
		else this.moveDirection = 'down'
	}

	// flip move directions if no more stops are in the same direction
	private attemptToFlipMoveDirection() {
		if (this.moveDirection === 'up' && this.currentDestination < this.currentFloor) this.moveDirection = 'down'
		if (this.moveDirection === 'down' && this.currentDestination > this.currentFloor) this.moveDirection = 'up'
	}

	moveFloor() {
		// elevator idling
		if (this.status === 'idle') {
			// idling elevator recived button press from inside
			if (this.hasDestinations) {
				this.status = 'moving'
				this.updateMoveDirection()
			}
			return
		}

		// elevator stopped to let people in or out - clear stopped status this update and move normally on the next
		if (this.status === 'stopped') {
			// no destinations left - set elevator to idle
			if (!this.hasDestinations) {
				this.status = 'idle'
				this.moveDirection = null
				return
			}

			this.status = 'moving'
			this.attemptToFlipMoveDirection()
			if (!this.moveDirection) this.updateMoveDirection() // decide move direction if it wasn't assigned before
			return
		}

		// move elevator based on destination, not direction.
		// that way "pickup" tasks can be set without direction, so stumbling upon any other pickup task will immediately override it
		this.currentFloor += this.currentDestination > this.currentFloor ? 1 : -1

		// check if it reached a destination, remove it and stop elevator if yes
		if (this.destinations.delete(this.currentFloor)) this.status = 'stopped'

		// check if it reached a pickup task, remove it and stop elevator if yes
		if (this.currentPickupTask?.floor === this.currentFloor) {
			this.currentPickupTask = null
			this.status = 'stopped'
		}
	}

	canClearPickupTask(task: PickupTask) {
		return task.floor === this.currentFloor && (task.direction === this.moveDirection || this.moveDirection === null)
	}
}

export default class ElevatorManager implements ElevatorSystem {
	elevatorCount: number
	readonly elevators: Elevator[] = []
	pickupTasks: PickupTask[] = []

	constructor(elevatorCount: number = 3) {
		this.elevatorCount = elevatorCount

		for (let i = 0; i < elevatorCount; i++) {
			this.elevators.push(new Elevator(i))
		}
	}

	pickup(floor: number, direction: Direction) {
		if (!this.pickupTasks.find((p) => p.floor === floor && p.direction === direction)) {
			this.pickupTasks.push({ floor, direction })
		}
	}

	selectFloor(elevatorID: number, floor: number) {
		const elevator = this.elevators.find((e) => e.id === elevatorID)
		if (!elevator) throw new Error('invalid elevator id')

		elevator.destinations.add(floor)
	}

	getAllTasks() {
		let elevatorTasks = this.elevators.map((el) => el.currentPickupTask).filter((t) => t !== null) as PickupTask[]
		return this.pickupTasks.concat(elevatorTasks)
	}

	setElevatorCount(newCount: number) {
		while (newCount > this.elevators.length) this.elevators.push(new Elevator(this.elevators.length))
		if (newCount < this.elevatorCount) {
			this.elevators.splice(newCount)
		}
		this.elevatorCount = newCount
	}

	get activeElevators() {
		return this.elevators.filter((e) => !e.isIdle)
	}

	get idleElevators() {
		return this.elevators.filter((e) => e.isIdle)
	}

	step() {
		// move active elevators
		for (let elevator of this.elevators) {
			elevator.moveFloor() // can cause idle elevators to start moving if they have received a destination

			if (elevator.isIdle) continue

			// check if elevator can complete pickup task here - but only if elevator is not alredy on way to another pickup
			if (elevator.currentPickupTask) continue
			const taskToClearI = this.pickupTasks.findIndex((t) => elevator.canClearPickupTask(t))
			if (taskToClearI > -1) {
				this.pickupTasks.splice(taskToClearI, 1)

				// if elevator was doing another pickup task, return it to the pool
				if (elevator.currentPickupTask) {
					this.pickupTasks.push(elevator.currentPickupTask)
					elevator.currentPickupTask = null
				}
				elevator.status = 'stopped'
			}
		}

		// assign any available pickups to idle elevators
		for (let pickup of this.pickupTasks) {
			if (!this.idleElevators.length) break // no more idle elevators left
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
