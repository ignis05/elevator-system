# Elevator System

System managing multiple elevators in a building that use the same control panel.

## Project setup:

1. Install modules with `npm i`.
2. Web gui can be viewed from dev server launched with `npm run start`.
3. Jest unit tests can be launched with `npm run test`.

Alternatively, web gui is also deployed on github pages: https://ignis05.github.io/elevator-system

## File structure:

- Elevator algorithm - generic interface in `src/services/ElevatorSystem.ts` with implementation class in `src/services/ElevatorManager.ts`
- React component with GUI - `src/components/ElevatorSystem/ElevatorSystem.tsx`
- Unit tests - `src/services/ElevatorManager.test.ts` and `src/services/ElevatorSystem.test.ts`

## System Behavior:

- System operates on two types of elevator jobs: `pickup tasks` and `dropoff destinations`.
- System holds a shared list of `pickup tasks`, where each tasks consists of a floor and a direction.
- Each elevator holds its own list of `dropoff destinations`, which are just numbers of floors selected on its internal panel.
- Each elevator can have a single assigned `pickup task`, which is removed from the shared pool and stored in elevator itself. This prevents elevators from completing tasks assigned to other elevators, for example sending 3 elevators from floor 0 to floors 1,2,3, without having the one going to floor 3 also "steal" pickups from floors 1 and 2.
- Each elevator can be in one of 3 states: `idle`, `moving` or `stopped`. `idle` means that elevator has nothing to do, `moving` that it's currently moving between floors and `stopped` that is is stopped on a floor, but still has tasks to do.
- In each algorithm `step`, each elevator can move one floor up or down. When elevator arrives at a floor where it has a `pickup` or `dropoff`, it will become `stopped` for a single `step`. After that step, it either becomes `moving` or `idle`, depending whether it has more floors it must visit or not.
- System assigns new `pickups` to `idle` elevator only. This ensures each elevator completes all `dropoffs` before being sent to pick up more people.
- When simulating people entering the elevator and choosing floor, the selection must be made while the elevator is `stopped` at that floor. Otherwise system assumes, that no-one actually entered or no selection was made in time, so the elevator becomes idle in the next `step` and might get assigned to another `pickup`.
- System assignes `pickup tasks`, based on "first-come first-serve" and elevator distance. When new task appears it gets assigned to the closest `idle` elevator, or it waits in the shared pool until an elevator becomes `idle`. Once a `task` is assigned, it will not get reassigned to another elevator. This avoids "starvation issue", where for example no elevator reaches floor 20 for a while, because they are all near the bottom and keep getting reassigned to closer tasks that keep appearing.
- Despite assignment working on a simple FCFS, elevators will stop to complete other `pickup tasks` from the shared pool at any floor they passes, hovewer certain conditions must be met:
  - The `task` can't be assigned to another elevator, as that removes it from the public `task` pool.
  - The `task`'s declared direction must match elevator's current move direction. Ex: elevator going from 1->5 won't pick up a task `floor 3 - down`, at least not until it finishes its jobs or comes back around on its way down.
  - If the elevator is going to a `pickup task`, the `task` it passes must also match the elevator's `task`'s' direction. Ex: Elevator going from floor 0 to task `floor 8 - down` won't pick up task `floor 5 - up`, because there's no guarantee that floor 5 doesn't want to go higher than 8.
  - The exception to the above rule can be made by optional constructor parameter or usage of method that limits the range of floors (by default, elevators can be called or sent to any floor within JavaScript's `number` type limits). This allows an elevator to pick up task `floor 5 - up`, while going to `floor 8 - down` when it knows that floor 8 is the top floor and there won't be a conflict between passenger from 5 and passenger on 8. It works in the same way for bottom floor `pickups`.
- Each elevator prefers to travel in the direction matching the declared direction of `pickup` it completed. If elevator receives `destinations` `1` and `10` when stopped completing pickup `floor 3 - up`, it will go to floor 10, despite floor 3 being closer, because that matches the direction declared by `pickup task`. This incentivizes people to wait for an elevator going in their declared direction, instead of entering the first one than arrives.
- After an elevator has completed all `dropoffs` in its direction, its direction will be flipped if there are any in the opposite one and will keep it as new `dropoffs` are declared. This ensure the elevator switches its movement direction as rarely as possible, so it is more likely to pass through and be able to complete more `pickup tasks`, than if it was jiggling up and down between a couple floors.
- If both `up` and `down` are selected for a single floor, the system is likely to complete that using two separate elevators (unless all except one are being really busy for a long time). This assumes people will know they aren't all supposed to enter the first elevator that arrives and wait for elevator in their direction instead.
- Alternatively, method `setSoleElevatorMode` can be used to change this behavior and allow each elevator to complete all `pickups` from all floors it passes. This might be a preferable solution in case the system controls a bilding with one sole elvator where it might be weird to expect people to not enter the elevator and wait for it to come back around. This method is not present on the interface, as it's assumed it will be set between creating the class instance and passing it to the interface, as it's very unlikely this will need to be changed during system's work.
- System does **not** try to predict when an elevator will become idle. For example: there's pickup task `floor 10 - down` and system has two elevators: elevator1 `idle` at floor 0 and elevator2 at floor 13 moving to its one remaining `destination` at floor 11. The system could optimistically predict that elevator2 will be able to finish its `dropoff` at 11, and stil get to the `pickup` at 10 faster than elevator1 going all the way from floor 0. But if someone from elevator2 presses another button, or someone new enters on floor 11, its likely that the `pickup` will have to be completed by elevator1 anyway, but after a considerable delay in expectation of elevator2 being able to complete it.
- Implementation specifics:
  - Generic interface is named `ElevatorSystem`, while its implementation class is named `ElevatorManager`. There's also a couple other simple helper interfaces and declared types, as well as an `Elevator` class responsible for a fair share of the algorightm.
  - `Elevator` class is responsible for individual elevator's position, direction, choosing next destination, handling state change and completing `dropoffs` and assigned `pickup` by just calling `Elevator#moveFloor()` for each elevator once every `step`. Assigning new `pickups` to idle elevators and clearing `pickups` from shared pool as elevators pass them is done in loops inside `ElevatorManager#step()`.
  - Interface methods return clones of objects instead of direct references, to avoid accidentally interfering with the system by accidently modifying objects passed by reference.
