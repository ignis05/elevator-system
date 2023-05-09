import React, { useEffect, useState } from 'react'
import ElevatorManager, { Direction, Elevator, PickupTask } from '../../services/ElevatorSystem'
import './ElevatorSystem.css'

type Floor = {
	number: number
	pickupUp: boolean
	pickupDown: boolean
}

const elevatorSystem = new ElevatorManager(3)

function ElevatorSystem() {
	// const [elevatorCount, setElevatorCount] = useState<number>(3)

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

	useEffect(() => {
		updateFloors()
	}, [floorsInput])

	const callElevatorHandler = (floor: number, direction: Direction) => {
		elevatorSystem.pickup(floor, direction)
		updateFloors()
	}

	const simulationStep = () => {
		elevatorSystem.step()
		updateFloors()
	}

	return (
		<div className="main">
			<div className="headerBar">
				{/* Elevators: <input type="number" value={elevatorCount} onChange={(e) => setElevatorCount(parseInt(e.target.value))} /> */}
				Floors: <input type="text" value={floorsInput} onChange={(e) => setfloorsInput(e.target.value)} />
				<button onClick={() => simulationStep()}>STEP</button>
			</div>
			<div className="displayWrapper">
				<table>
					<tbody>
						{floors.map((floor) => (
							<tr key={floor.number}>
								<td>
									<span>{floor.number}</span>
									<button className={floor.pickupUp ? 'btPressed' : undefined} onClick={() => callElevatorHandler(floor.number, 'up')}>
										UP
									</button>
									<button className={floor.pickupDown ? 'btPressed' : undefined} onClick={() => callElevatorHandler(floor.number, 'down')}>
										DOWN
									</button>
								</td>
								{elevatorSystem.elevators.map((el) => (
									<td className={`floorField ${el.currentFloor === floor.number ? 'hasElevator' : ''}`} key={el.id}></td>
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
