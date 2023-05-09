import React, { useEffect, useState } from 'react'
import ElevatorManager from '../../services/ElevatorSystem'
import './ElevatorSystem.css'

type Floor = {
	number: number
	pickupUp: boolean
	pickupDown: boolean
}

const elevatorSystem = new ElevatorManager()

function ElevatorSystem() {
	const [elevatorCount, setElevatorCount] = useState<number>(3)
	const [floorsInput, setfloorsInput] = useState<string>('-2:7')
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

	useEffect(() => updateFloors(), [floorsInput]) // eslint-disable-line react-hooks/exhaustive-deps

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
				Elevators: <input type="number" value={elevatorCount} onChange={(e) => setElevatorCount(parseInt(e.target.value))} />
				Floors: <input type="text" value={floorsInput} onChange={(e) => setfloorsInput(e.target.value)} />
				<button onClick={() => simulationStep()}>STEP</button>
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
									>
										UP
									</button>
									<button
										className={floor.pickupDown ? 'btPressed' : undefined}
										onClick={() => {
											elevatorSystem.pickup(floor.number, 'down')
											updateFloors()
										}}
									>
										DOWN
									</button>
								</td>
								{elevatorSystem.elevators.map((el) => (
									<td
										className={`floorField ${el.currentFloor === floor.number ? `elevator-${el.status}` : ''}`}
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
		</div>
	)
}

export default ElevatorSystem
