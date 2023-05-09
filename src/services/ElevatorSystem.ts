export interface ElevatorSystem {
	/**
	 * Orders pickup from a specific floor with intention to go into specified direction.
	 * The system automatically assigns an elevator to complete the pickup.
	 * The system prioritises using idle elevators for pickups over ones already moving with people to utilise as much of its elevators as possible,
	 * and avoid having large groups of people in a single elevator.
	 * Elevators will complete any pickup orders that declared the direction matching its current direction and its order's direction
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
		return this.destinations.size > 0 || this.currentPickupTask
	}

	// returns next destination based on priority: pickup order > farthest stop in current direction > any stop > current floor
	get currentDestination() {
		if (this.currentPickupTask) return this.currentPickupTask.floor

		if (this.moveDirection === 'up') return Math.max(...this.destinations)
		if (this.moveDirection === 'down') return Math.min(...this.destinations)
		if (this.destinations.size > 0) return this.destinations.values().next().value
		return this.currentFloor
	}

	updateMoveDirection() {
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
				// received the same destination as the floor it's currently on - stop it for one step
				if (this.destinations.delete(this.currentFloor)) {
					this.status = 'stopped'
					return
				}
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

		this.currentFloor += this.currentDestination > this.currentFloor ? 1 : -1

		// check if it reached a destination, remove it and stop elevator if yes
		if (this.destinations.delete(this.currentFloor)) this.status = 'stopped'

		// if elevator reached a pickup task, remove it and stop elevator, set direction to task direction
		if (this.currentPickupTask?.floor === this.currentFloor) {
			this.moveDirection = this.currentPickupTask.direction
			this.currentPickupTask = null
			this.status = 'stopped'
		}
	}

	// can only do pickup tasks on the way if it doesn't have one alredy or if the one it has matches directions
	canClearPickupTask(task: PickupTask, limits?: FloorLimits) {
		if (task.floor !== this.currentFloor) return false // not on the current floor
		if (task.direction !== this.moveDirection) return false // not moving in the same direcion

		// has assigned pickup
		if (this.currentPickupTask) {
			// complete any "up" pickups when going to top floor and "down" pickups for bottom floor
			if (this.currentPickupTask.floor === limits?.top && task.direction === 'up') return true
			else if (this.currentPickupTask.floor === limits?.bottom && task.direction === 'down') return true

			if (this.currentPickupTask.direction !== task.direction) return false // will not be moving in the same direction after completing assigned pickup
		}

		return true
	}
}

export type FloorLimits = { top: number; bottom: number } | null

export default class ElevatorManager implements ElevatorSystem {
	elevatorCount: number
	readonly elevators: Elevator[] = []
	pickupTasks: PickupTask[] = []
	floorLimits: FloorLimits

	constructor(elevatorCount: number = 3, floorLimits: FloorLimits = null) {
		this.elevatorCount = elevatorCount

		for (let i = 0; i < elevatorCount; i++) {
			this.elevators.push(new Elevator(i))
		}

		this.floorLimits = floorLimits
	}

	pickup(floor: number, direction: Direction) {
		if (!this.isWithinLimits(floor)) throw new Error('specified floor is outside of set limits')
		if (!this.pickupTasks.find((p) => p.floor === floor && p.direction === direction)) {
			this.pickupTasks.push({ floor, direction })
		}
	}

	selectFloor(elevatorID: number, floor: number) {
		if (!this.isWithinLimits(floor)) throw new Error('specified floor is outside of set limits')
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

	// pass null to disable floor limits
	setFloorLimits(newLimits: FloorLimits) {
		this.floorLimits = newLimits
	}

	private isWithinLimits(floor: number) {
		if (!this.floorLimits) return true
		return floor <= this.floorLimits.top && floor >= this.floorLimits.bottom
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

			// check if elevator can complete a pickup task here
			const taskToClearI = this.pickupTasks.findIndex((t) => elevator.canClearPickupTask(t, this.floorLimits))
			if (taskToClearI > -1) {
				this.pickupTasks.splice(taskToClearI, 1)
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
			closestIdleElevator.updateMoveDirection()
		}
	}
}
