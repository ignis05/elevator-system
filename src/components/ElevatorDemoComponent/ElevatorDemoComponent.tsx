import React, { useEffect, useState } from 'react'
import ElevatorManager from '../../services/ElevatorManager'
import './ElevatorDemoComponent.css'
import { ElevatorSystem } from '../../services/ElevatorSystem'

type Floor = {
	number: number
	pickupUp: boolean
	pickupDown: boolean
	isTopFloor: boolean
	isBottomFloor: boolean
}

const initElevatorCount = 3
const initMinFloor = -2
const initMaxFloor = 7

const systemClass = new ElevatorManager()
const systemInterface: ElevatorSystem = systemClass

function ElevatorDemoComponent() {
	// react inputs
	const [elevatorCount, setElevatorCount] = useState<number>(initElevatorCount)
	const [floorsInput, setFloorsInput] = useState<string>(`${initMinFloor}:${initMaxFloor}`)
	// object being mapped into table that represents floors and elevators
	const [floors, setFloors] = useState<Floor[]>([])

	// fetches new values from system and updates floors array
	const updateFloors = () => {
		const minFloor = parseInt(floorsInput.split(':')[0])
		const maxFloor = parseInt(floorsInput.split(':')[1])
		const floorsArray: Floor[] = []
		for (let i = minFloor; i <= maxFloor; i++) {
			let pickupUp = false
			let pickupDown = false
			systemInterface.tasks().forEach((t) => {
				if (t.floor !== i) return
				if (t.direction === 'up') pickupUp = true
				if (t.direction === 'down') pickupDown = true
			})
			floorsArray.push({ number: i, pickupDown, pickupUp, isTopFloor: i === maxFloor, isBottomFloor: i === minFloor })
		}
		floorsArray.reverse()
		setFloors(floorsArray)
	}

	// update values after simulation step
	const simulationStep = () => {
		systemInterface.step()
		updateFloors()
	}

	// directly updating settings on the class, instead of the interface
	useEffect(() => {
		const minFloor = parseInt(floorsInput.split(':')[0])
		const maxFloor = parseInt(floorsInput.split(':')[1])
		systemClass.setFloorLimits({ top: maxFloor, bottom: minFloor })
		updateFloors()
	}, [floorsInput]) // eslint-disable-line react-hooks/exhaustive-deps
	useEffect(() => {
		systemClass.setElevatorCount(elevatorCount)
		updateFloors()
	}, [elevatorCount]) // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<div className="main">
			<div className="headerBar">
				Elevators:{' '}
				<input type="number" min="0" step="1" value={elevatorCount} onChange={(e) => setElevatorCount(parseInt(e.target.value))} />
				Floors: <input type="text" value={floorsInput} onChange={(e) => setFloorsInput(e.target.value)} />
				<button className="stepBtn" onClick={() => simulationStep()}>
					STEP
				</button>
			</div>
			<div className="displayWrapper">
				<table>
					<tbody>
						{floors.map((floor) => (
							<tr className="tableRow" key={floor.number}>
								<td>{floor.number}</td>
								<td>
									<button
										className={floor.pickupUp ? 'btPressed' : undefined}
										onClick={() => {
											systemInterface.pickup(floor.number, 'up')
											updateFloors()
										}}
										disabled={floor.isTopFloor}
									>
										UP
									</button>

									<button
										className={floor.pickupDown ? 'btPressed' : undefined}
										onClick={() => {
											systemInterface.pickup(floor.number, 'down')
											updateFloors()
										}}
										disabled={floor.isBottomFloor}
									>
										DOWN
									</button>
								</td>
								{systemInterface.status().map((el) => (
									<td
										className={[
											'floorField',
											el.floor === floor.number ? `elevator-${el.status}` : 'activeBtn',
											el.dropOffs.includes(floor.number) ? 'floor-selected' : '',
										].join(' ')}
										key={el.id}
										onClick={() => {
											systemInterface.selectFloor(el.id, floor.number)
											updateFloors()
										}}
									>
										{el.destination === floor.number && 'DEST'}
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
						Press <b>STEP</b> button to simulate one system's step.
					</li>
					<li>
						Press <b>UP/DOWN</b> buttons to simulate calling the elevator to the specified floor.
					</li>
					<li>Press on any of the floors in the elevator columns, to simulate selecting that floor on that elevator's internal panel.</li>
				</ul>
				<h4>Legend:</h4>
				<ul>
					<li>
						<b>DEST</b> - This floor is this elevator's current destination.
					</li>
					<li>
						<div className="floorField legend-field floor-selected"></div> - This floor has been selected from this elevator's panel. The
						elevator will stop there to let people out.
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
					<li>The system prioritises utilising idle elevators over adding multiple groups of people to the same elevator passing by.</li>
					<li>
						Whenever an elevator simulates stopping on the floor and opening doors, it will change its status to "stopped" for one step.
					</li>
					<li>
						If an elevator arrives at the floor it was called to pickup people from, but receives no input during the "stop" step, it
						assumes no-one entered, or no button was pressed, and the system might assign it another pickup task.
					</li>
					<li>
						The system can't prevent, in any way, situations where someone calls an elevator with "up" input and decides to go down (or the
						reverse). However, it will prioritise going in the declared direction if multiple floors are selected on its panel after a
						pickup.
					</li>
					<li>
						If both "up" and "down" are pressed on the same floor, the system is likely to send two separate elevators and assumes people
						know to only enter the elevator matching their chosen travel direction, instead of the first one that arrives.
					</li>
				</ul>
			</div>
		</div>
	)
}

export default ElevatorDemoComponent
