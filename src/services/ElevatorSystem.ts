export interface ElevatorSystem {
	/**
	 * Orders pickup from a specific floor with intention to go in the specified direction.
	 * The system automatically assigns an elevator to complete the pickup.
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
	 * Statuses of all elevators controlled by the system.
	 * Each elevator has its id, current floor, destination, and work status.
	 */
	status(): ElevatorStatus[]

	/**
	 * All pickup requests queued in the system.
	 * Each pickup consists of floor and declared direction
	 */
	tasks(): PickupTask[]

	/**
	 * Allows to set elevator.
	 * Will wipe all elevator's destinations and return it's assigned pickup to the pool to ensure the system won't malfuction.
	 */
	setElevator: (id: number, floor: number) => void
}

export interface PickupTask {
	floor: number
	direction: Direction
}

export type Direction = 'up' | 'down'

export interface ElevatorStatus {
	/** The id of an elevator. It matches elevator's index inside ElevatorSystem#status() array. */
	id: number
	/** The floor this elevator is currently on. */
	floor: number
	/** The floor this elevator is currently going to. If the elevator isn't moving anywhere it will match the "floor" property. */
	destination: number
	/** The current status of the elevator, being "moving" between floors, "stopped" temporarily on a floor, or "idle" because it has nothing to do. */
	status: ElevatorWorkStatus
	/** List of floors selected on elevator's panel that it must visit before becoming idle. */
	dropOffs: number[]
}

/** Elevator is "idle" when it has nothing to do, "stopped" when paused on a floor to let people in or out, and "moving" when it's passing through floors. */
export type ElevatorWorkStatus = 'idle' | 'moving' | 'stopped'
