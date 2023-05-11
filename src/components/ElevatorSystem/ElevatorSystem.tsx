import React, { useEffect, useState } from 'react'
import ElevatorManager from '../../services/ElevatorManager'
import './ElevatorSystem.css'

type Floor = {
	number: number
	pickupUp: boolean
	pickupDown: boolean
}

const initElevatorCount = 3
const initMinFloor = -2
const initMaxFloor = 7

const elevatorSystem = new ElevatorManager()

function ElevatorSystem() {
	const [elevatorCount, setElevatorCount] = useState<number>(initElevatorCount)
	const [floorsInput, setfloorsInput] = useState<string>(`${initMinFloor}:${initMaxFloor}`)
	const [floors, setfloors] = useState<Floor[]>([])

	const updateFloors = () => {
		const minFloor = parseInt(floorsInput.split(':')[0])
		const maxFloor = parseInt(floorsInput.split(':')[1])
		const floorsArray: Floor[] = []
		for (let i = minFloor; i <= maxFloor; i++) {
			let pickupUp = false
			let pickupDown = false
			elevatorSystem.getAllTasks().forEach((t) => {
				if (t.floor !== i) return
				if (t.direction === 'up') pickupUp = true
				if (t.direction === 'down') pickupDown = true
			})
			floorsArray.push({ number: i, pickupDown, pickupUp })
		}
		floorsArray.reverse()
		setfloors(floorsArray)
	}

	useEffect(() => {
		const minFloor = parseInt(floorsInput.split(':')[0])
		const maxFloor = parseInt(floorsInput.split(':')[1])
		elevatorSystem.setFloorLimits({ top: maxFloor, bottom: minFloor })
		updateFloors()
	}, [floorsInput]) // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		elevatorSystem.setElevatorCount(elevatorCount)
		updateFloors()
	}, [elevatorCount]) // eslint-disable-line react-hooks/exhaustive-deps

	const simulationStep = () => {
		elevatorSystem.step()
		updateFloors()
	}

	return (
		<div className="main">
			<div className="headerBar">
				Elevators:{' '}
				<input type="number" min="0" step="1" value={elevatorCount} onChange={(e) => setElevatorCount(parseInt(e.target.value))} />
				Floors: <input type="text" value={floorsInput} onChange={(e) => setfloorsInput(e.target.value)} />
				<button className="stepBtn" onClick={() => simulationStep()}>
					STEP
				</button>
			</div>
			<div className="displayWrapper">
				<table>
					<tbody>
						{floors.map((floor) => (
							<tr key={floor.number}>
								<td>{floor.number}</td>
								<td>
									<button
										className={floor.pickupUp ? 'btPressed' : undefined}
										onClick={() => {
											elevatorSystem.pickup(floor.number, 'up')
											updateFloors()
										}}
										disabled={floor.number === elevatorSystem.floorLimits?.top}
									>
										UP
									</button>

									<button
										className={floor.pickupDown ? 'btPressed' : undefined}
										onClick={() => {
											elevatorSystem.pickup(floor.number, 'down')
											updateFloors()
										}}
										disabled={floor.number === elevatorSystem.floorLimits?.bottom}
									>
										DOWN
									</button>
								</td>
								{elevatorSystem.elevators.map((el) => (
									<td
										className={`floorField  ${el.currentFloor === floor.number ? `elevator-${el.status}` : 'activeBtn'}`}
										key={el.id}
										onClick={() => {
											elevatorSystem.selectFloor(el.id, floor.number)
											updateFloors()
										}}
									>
										{el.destinations.has(floor.number) && 'X'}
										{el.currentDestination === floor.number && ' <---'}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="legend">
				<h4>Controls:</h4>
				<ul>
					<li>
						Press <b>UP/DOWN</b> buttons to simulate calling the elevator to the specified floor.
					</li>
					<li>Press on any of the floors in elevator's column, to simulate selecting that floor on that elevator's internal panel.</li>
				</ul>
				<h4>Legend:</h4>
				<ul>
					<li>
						<b>X</b> - This floor has been selected from this elevator's panel. The elevator will stop there to let people out.
					</li>
					<li>
						<b>&lt;---</b> - This floor is this elevator's current destination.
					</li>
					<li>
						<div className="floorField legend-field elevator-idle"></div> - Elevator is idle at this floor because it has nothing to do.
					</li>
					<li>
						<div className="floorField legend-field elevator-stopped"></div> - Elevator is stopped at this floor to let people in or out. It
						will get moving in the next simulation step.
					</li>
					<li>
						<div className="floorField legend-field elevator-moving"></div> - Elevator is moving through this floor.
					</li>
				</ul>
				<h4>Implementation notes:</h4>
				<ul>
					<li>
						The system assumes elevator speeds are fast and the stops are slows, so it prioritises utilising idle elevators over adding
						multiple groups of people to the same elevator passing by.
					</li>
					<li>Whenever elevator simulates stopping on the floor and opening doors, it will change its status to "stopped" for one step.</li>
					<li>
						If an elevator arrives at the floor it was called to pickup people from, but receives no input during the "stop" step, it
						assumes no-one entered or no button was pressed and the system might assign it another pickup task.
					</li>
					<li>
						The elevator doesn't block in any way situations where someone calls it with "up" input and decides to go down (or the reverse).
						However, it will prioritise going in the declared direction if multiple floors are selected on its panel after a pickup.
					</li>
					<li>
						If both "up" and "down" are pressed on the same floor, the system is likely to send two separate elevators and assumes people
						will only enter the elevator matching their chosen travel direction.
					</li>
					<li>If there's only one elevator in the system, it will complete all pickups from all floor it passes.</li>
				</ul>
			</div>
		</div>
	)
}

export default ElevatorSystem
