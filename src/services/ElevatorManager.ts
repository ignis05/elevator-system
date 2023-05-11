import { Direction, ElevatorStatus, ElevatorSystem, ElevatorWorkStatus, PickupTask } from './ElevatorSystem'

export class Elevator {
	readonly id: number
	currentFloor: number
	moveDirection: Direction | null = null
	// idle elevator has nothing to do, stopped elevator is stopped at a floor for a moment to let people in/out
	status: ElevatorWorkStatus = 'idle'
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

	/** returns next destination based on priority: pickup order > farthest stop in current direction > any stop > current floor */
	get currentDestination(): number {
		if (this.currentPickupTask) return this.currentPickupTask.floor

		if (this.hasDestinations) {
			if (this.moveDirection === 'up') return Math.max(...this.destinations)
			if (this.moveDirection === 'down') return Math.min(...this.destinations)
			return this.destinations.values().next().value
		}

		return this.currentFloor
	}

	updateMoveDirection() {
		if (this.currentDestination === this.currentFloor) throw new Error('attempted to update move direction without any destinations')
		if (this.currentDestination > this.currentFloor) this.moveDirection = 'up'
		else this.moveDirection = 'down'
	}

	/** flip move directions if no more stops are in the same direction */
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

	/** can only do pickup tasks on the way if it doesn't have one alredy or if the one it has matches directions */
	canClearPickupTask(task: PickupTask, limits?: FloorLimits, isSoleElevator: boolean = false) {
		if (task.floor !== this.currentFloor) return false // not on the current floor
		if (isSoleElevator) return true // sole elevator always picks up everyone from a floor, there's no other elevator to wait for anyway
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
	readonly elevators: Elevator[] = []
	readonly pickupTasks: PickupTask[] = []
	elevatorCount: number
	floorLimits: FloorLimits
	soleElevatorMode: boolean = false

	constructor(elevatorCount: number = 3, floorLimits: FloorLimits = null) {
		this.elevatorCount = elevatorCount

		for (let i = 0; i < elevatorCount; i++) {
			this.elevators.push(new Elevator(i))
		}

		this.floorLimits = floorLimits
	}

	// --- interface methods ---

	public status(): ElevatorStatus[] {
		return this.elevators.map((e) => ({ id: e.id, floor: e.currentFloor, destination: e.currentDestination, status: e.status }))
	}

	public tasks(): PickupTask[] {
		return this.getAllTasks().map((t) => ({ floor: t.floor, direction: t.direction })) // clone objects to ensure not external modification
	}

	public setElevator(id: number, floor: number) {
		const oldElevator = this.elevators.splice(id, 1, new Elevator(id, floor))[0]
		if (oldElevator.currentPickupTask) this.pickupTasks.push(oldElevator.currentPickupTask) // return pickup task it was doing to the pool
	}

	public pickup(floor: number, direction: Direction) {
		if (!this.isWithinLimits(floor)) throw new Error('specified floor is outside of set limits')
		if (!this.pickupTasks.find((p) => p.floor === floor && p.direction === direction)) {
			this.pickupTasks.push({ floor, direction })
		}
	}

	public selectFloor(elevatorID: number, floor: number) {
		if (!this.isWithinLimits(floor)) throw new Error('specified floor is outside of set limits')
		const elevator = this.elevators.find((e) => e.id === elevatorID)
		if (!elevator) throw new Error('invalid elevator id')

		elevator.destinations.add(floor)
	}

	public step() {
		// move active elevators
		for (let elevator of this.elevators) {
			elevator.moveFloor() // can cause idle elevators to start moving if they have received a destination

			if (elevator.isIdle) continue

			// check if elevator can complete a pickup task here
			const taskToClearI = this.pickupTasks.findIndex((t) => elevator.canClearPickupTask(t, this.floorLimits, this.soleElevatorMode))
			if (taskToClearI > -1) {
				this.pickupTasks.splice(taskToClearI, 1)
				elevator.status = 'stopped'
			}
		}

		// assign any available pickups to idle elevators
		while (this.pickupTasks.length > 0 && this.idleElevators.length > 0) {
			const task = this.pickupTasks.shift()!
			const closestIdleElevator = this.idleElevators.reduce((prev, curr) =>
				Math.abs(curr.currentFloor - task.floor) < Math.abs(prev.currentFloor - task.floor) ? curr : prev
			)
			closestIdleElevator.currentPickupTask = task
			closestIdleElevator.status = 'moving'
			closestIdleElevator.updateMoveDirection()
		}
	}

	// --- config methods ---

	/** Can be used to update how many elevators are controlled by the system */
	public setElevatorCount(newCount: number) {
		while (newCount > this.elevators.length) this.elevators.push(new Elevator(this.elevators.length))
		if (newCount < this.elevatorCount) {
			this.elevators.splice(newCount)
		}
		this.elevatorCount = newCount
	}

	/** Pass null to disable floor limits.
	 * When floor limits are set, it enables special behavior when elevator knows it is going to top or bottom floor.*/
	public setFloorLimits(newLimits: FloorLimits) {
		this.floorLimits = newLimits
	}

	/** Enables special behavior, where elevator will pick up all people from each floor it passes, regardless of their declared direction.
	 * This might be desireble if there's only one elevator in the building.
	 * Otherwise it might be weird if elevator receives "up" and "down" simultaniously from the same floor,
	 * and it picks up only the people going up, while the rest waits for it to come back around in the other direction.
	 * This mode can be enabled regardless of how many elevators are actually in the system.*/
	public setSoleElevatorMode(enabled: boolean) {
		this.soleElevatorMode = enabled
	}

	// --- helper methods ---

	public getAllTasks() {
		let elevatorTasks = this.elevators.map((el) => el.currentPickupTask).filter((t) => t !== null) as PickupTask[]
		return this.pickupTasks.concat(elevatorTasks)
	}

	public isWithinLimits(floor: number) {
		if (!this.floorLimits) return true
		return floor <= this.floorLimits.top && floor >= this.floorLimits.bottom
	}

	public get idleElevators() {
		return this.elevators.filter((e) => e.isIdle)
	}
}
