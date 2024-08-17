interface Goal {
  desiredWorldState: State;
}

interface Action {
  name: string;
  preconditions: Array<Precondition>;
  effects: Array<StateEntry<StateEntryType>>;
  priority: number;
}

class State extends Set<StateEntry<StateEntryType>> {


    constructor(iterable: Iterable<StateEntry<StateEntryType>> | null | undefined) {
        super(iterable);
    }

    private getRawSet() {
        return new Set(Array.from(this.values()).map((stateEntry) => {
            return `${stateEntry.name}=${stateEntry.value}`
        }));
    }

    isSupersetOf(other: State): boolean {
        return this.getRawSet().isSupersetOf(other.getRawSet());
    }

    stateDifference(other: State): State {
      const newRawSet = this.getRawSet().difference(other.getRawSet());
      const newStateArray = Array.from(newRawSet).map((rawValue) => {
        const [name, value] = rawValue.split("=");
        return new StateEntry(name, value);
      });

      return new State(newStateArray);
    }

}

type StateEntryType = boolean | string;

class StateEntry<T> {
  name: string;
  value: T;

  constructor(name: string, value: T) {
    this.name = name;
    this.value = value;
  }
}

class Precondition {
    stateEntry: StateEntry<StateEntryType>;
    value: StateEntryType | (() => StateEntryType);

    constructor(name: string, value: StateEntryType | (() => StateEntryType)) {
        const resolvedValue = (typeof value === 'function') ? 'UNRESOLVED' : value;
        this.stateEntry = new StateEntry(name, resolvedValue);

        this.value = value;
    }

}

interface WorldStateNode {
  edge: string;
  cost: number;
  state: State;
  parent?: WorldStateNode;
}

type WithWorldStateNode = Required<WorldStateNode>;

const WORLD_STATE: State = new State([
  new StateEntry("NEARBY_COVER", true),
  new StateEntry("HAS_AMMO", false),
  new StateEntry("IN_COVER", false),
]);

const EXAMPLE_ACTIONS: Array<Action> = [
  {
    name: "SHOOT",
    preconditions: [new Precondition("HAS_AMMO", true)], 
    effects: [new StateEntry("HURT_TARGET", true)], 
    priority: 50, 
  },
  {
    name: "SHOOT_FROM_COVER",
    preconditions: [
      new Precondition("HAS_AMMO", true),
      new Precondition("IN_COVER", true),
    ],
    effects: [new StateEntry("HURT_TARGET", true)],
    priority: 75,
  },
  {
    name: "RELOAD",
    preconditions: [new Precondition("HAS_AMMO", false)],
    effects: [new StateEntry("HAS_AMMO", true)],
    priority: 25,
  },
  {
    name: "RELOAD_FROM_COVER",
    preconditions: [
      new Precondition("IN_COVER", true),
      new Precondition("HAS_AMMO", false),
    ],
    effects: [new StateEntry("HAS_AMMO", true)],
    priority: 50,
  },
  {
    name: "GOTO_COVER",
    preconditions: [
        new Precondition("NEARBY_COVER", () => checkCover()),
        new Precondition("IN_COVER", false),
    ],
    effects: [new StateEntry("IN_COVER", true)],
    priority: 50,
  },
];

function checkCover() {
    return true;
}

function printPath(node: WorldStateNode) {
  const nodes = [];

  let curr = node;
  while (curr.parent) {
    nodes.push(curr);
    curr = curr.parent;
  }

  console.log("\n---FINAL PATH---");
  console.log(nodes.reverse().map((node) => node.edge).join(" -> "));
}


function findNeighbors(node: WorldStateNode, goal: State): Array<WorldStateNode> {
  return EXAMPLE_ACTIONS
    .filter((action) => action.name !== node.edge)
    .map((action) => {
      const actionCost = 100 - action.priority;
      const actionSet = new State(action.effects);
      const distanceToGoal = goal.stateDifference(actionSet).size;
      const totalCost = actionCost + distanceToGoal;

      const stateMap = new Map<string, StateEntry<StateEntryType>>();
      node.state.forEach((state) => {
        stateMap.set(state.name, state);
      });

      action.effects.forEach((state) => {
        stateMap.set(state.name, state)
      });

      const newState = new State(stateMap.values());

      // Check if this is actually traversable
      const actionPreconditions = new State(action.preconditions.map((precondition) => {
        const stateEntry = precondition.stateEntry;
        if (stateEntry.value === "UNRESOLVED") {
            if (typeof precondition.value === 'function') {
                stateEntry.value = precondition.value();
            }
        }
        return precondition.stateEntry
    }));
      if (node.state.isSupersetOf(actionPreconditions)) {
        return {
          edge: action.name,
          cost: totalCost,
          state: newState,
          parent: node,
        };
      } else {
        return null;
      }
    }).filter((node): node is WithWorldStateNode => !!node);
}

function findPath(
  startState: State,
  goal: State,
): WorldStateNode | undefined {
  const open: Map<State, WorldStateNode> = new Map([]);
  const closed: Map<State, WorldStateNode> = new Map([]);

  const startNode = { edge: "", cost: 0, state: startState };
  open.set(startNode.state, startNode);

  while (open.size > 0) {
    const nodeArr = Array.from(open.values());
    const smallestNode = nodeArr.reduce((prev, curr) => {
      return (curr.cost < prev.cost) ? curr : prev;
    });
    const current = smallestNode;
    closed.set(smallestNode.state, smallestNode);
    open.delete(smallestNode.state);

    if (current.state.isSupersetOf(goal)) {
      return current;
    }

    const neighbors = findNeighbors(current, goal);
    neighbors.forEach((neighbor) => {
      if (closed.has(neighbor.state)) {
        return;
      }

      const openNeighbor = open.get(neighbor.state);
      if (!openNeighbor || (neighbor.cost < openNeighbor.cost)) {
        if (openNeighbor) {
          openNeighbor.cost = neighbor.cost;
          openNeighbor.parent = current;
          openNeighbor.edge = neighbor.edge;
        }

        if (!openNeighbor) {
          open.set(neighbor.state, neighbor);
        }
      }
    });
  }
}

const path = findPath(WORLD_STATE, new State([new StateEntry("HURT_TARGET", true)]));
if (path) {
  printPath(path);
}
